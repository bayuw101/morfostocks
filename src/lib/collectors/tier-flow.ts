import type {
    DailyBidOfferEntry,
    RunningTradeApiResponse,
    RunningTradeRaw,
    TradeSequence,
    TierAggregated,
    TierSideAggregated,
    TierSideBrokerDetail,
    TierDefinition,
    TierId,
    ZoneAggregated,
    BigplayerRetailDirection,
} from "./tier-flow-types";

const EXODUS_BASE_URL = "https://exodus.stockbit.com/order-trade/running-trade";
const PAGE_LIMIT = 100;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseNumberFromString(input: string): number {
    if (!input) return 0;
    return Number(input.replace(/,/g, "").trim()) || 0;
}

function parseBrokerCode(raw: string): string {
    if (!raw) return "";
    const trimmed = raw.trim();
    const firstPart = trimmed.split(" ")[0];
    return firstPart.toUpperCase();
}

/**
 * Fetch running trade with rate limit handling (SERVER ONLY)
 */
export async function fetchAllRunningTradesForDate(
    symbol: string,
    date: string,
    token: string,
    onProgress?: (tradeNumber: string, totalCount: number) => void
): Promise<RunningTradeRaw[]> {
    const allTrades: RunningTradeRaw[] = [];

    let tradeNumber: string | undefined;
    let safetyCounter = 0;
    let retryCount = 0;
    const MAX_RETRIES = 4;
    const RETRY_DELAY_MS = 8_000;

    while (true) {
        const url = new URL(EXODUS_BASE_URL);
        url.searchParams.set("sort", "DESC");
        url.searchParams.set("limit", String(PAGE_LIMIT));
        url.searchParams.set("order_by", "RUNNING_TRADE_ORDER_BY_TIME");
        url.searchParams.append("symbols[]", symbol);
        url.searchParams.set("action_type", "RUNNING_TRADE_ACTION_TYPE_ALL");
        url.searchParams.set("date", date);
        if (tradeNumber) url.searchParams.set("trade_number", tradeNumber);

        let res: Response | null = null;
        let localRetries = 0;

        while (localRetries < MAX_RETRIES) {
            try {
                res = await fetch(url.toString(), {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/json",
                        Referer: "https://stockbit.com/",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    },
                    cache: "no-store",
                });
                break; // fetch succeeded (even if 400/500, we got a response)
            } catch (err: any) {
                localRetries++;
                console.warn(`[TierFlow] Network error for ${symbol} on page ${safetyCounter}. Retry ${localRetries}/${MAX_RETRIES}. Waiting ${RETRY_DELAY_MS / 1000}s...`, err.message);
                if (localRetries < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
            }
        }

        if (!res) {
            console.warn(`[TierFlow] All ${MAX_RETRIES} network retries failed for ${symbol} page ${safetyCounter}. Skipping this page.`);
            break; // Skip instead of throwing — move to next symbol
        }

        // Rate limit handling
        if (res.status > 300 && res.status !== 401 && res.status !== 403) {
            retryCount++;
            console.warn(`[TierFlow] HTTP ${res.status} for ${symbol} on page ${safetyCounter}. Retry ${retryCount}/${MAX_RETRIES}. Waiting ${RETRY_DELAY_MS / 1000}s...`);
            if (retryCount > MAX_RETRIES) {
                console.warn(`[TierFlow] All ${MAX_RETRIES} retries exhausted for ${symbol} ${date}. Skipping.`);
                break; // Skip instead of throwing
            }
            await sleep(RETRY_DELAY_MS);
            continue;
        }

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) throw new Error("Invalid Stockbit token (Unauthorized)");
            const text = await res.text().catch(() => "");
            throw new Error(`Exodus error for ${symbol} ${date}: ${res.status} ${res.statusText} ${text}`);
        }

        retryCount = 0;

        const json = (await res.json()) as RunningTradeApiResponse;
        const chunk = json?.data?.running_trade ?? [];

        if (chunk.length === 0) break;

        allTrades.push(...chunk);
        console.log(`[TierFlow] ${symbol} - Fetched ${allTrades.length} trades...`);

        const last = chunk[chunk.length - 1];
        if (!last?.trade_number) break;
        if (tradeNumber === last.trade_number) break;
        tradeNumber = last.trade_number;

        if (onProgress) {
            onProgress(tradeNumber, allTrades.length);
        }

        safetyCounter++;
        if (safetyCounter > 10_000) break; // Infinite loop escape hatch
    }

    return allTrades;
}

/**
 * Group trades into sequences using Consecutive Broker Grouping
 */
export function groupConsecutiveTrades(
    trades: RunningTradeRaw[],
    date: string,
    mode: "AGGRESSIVE" | "PASSIVE"
): TradeSequence[] {
    const sequences: TradeSequence[] = [];
    if (trades.length === 0) return sequences;

    let currentSeq: TradeSequence | null = null;

    for (const t of trades) {
        const price = parseNumberFromString(t.price);
        const lot = parseNumberFromString(t.lot);
        const value = lot * price * 100; // Assuming 1 lot = 100 shares

        const aggressorBroker = t.action === "buy" ? parseBrokerCode(t.buyer) : parseBrokerCode(t.seller);
        const counterBroker = t.action === "buy" ? parseBrokerCode(t.seller) : parseBrokerCode(t.buyer);

        let keyBroker = "";
        if (mode === "AGGRESSIVE") {
            keyBroker = aggressorBroker;
        } else {
            keyBroker = counterBroker;
        }

        if (
            !currentSeq ||
            currentSeq.action !== t.action ||
            (mode === "AGGRESSIVE"
                ? currentSeq.aggressorBroker !== keyBroker
                : currentSeq.counterBroker !== keyBroker)
        ) {
            if (currentSeq) sequences.push(currentSeq);

            currentSeq = {
                date,
                time: t.time,
                code: t.code,
                price,
                action: t.action,
                sequenceLot: lot,
                sequenceValue: value,
                aggressorBroker: aggressorBroker,
                counterBroker: counterBroker,
                buyerRaw: t.buyer,
                sellerRaw: t.seller,
                tradeNumbers: [t.trade_number],
            };
        } else {
            currentSeq.sequenceLot += lot;
            currentSeq.sequenceValue += value;
            currentSeq.tradeNumbers.push(t.trade_number);

            if (mode === "AGGRESSIVE") {
                if (currentSeq.counterBroker !== "MIXED" && currentSeq.counterBroker !== counterBroker) currentSeq.counterBroker = "MIXED";
            } else {
                if (currentSeq.aggressorBroker !== "MIXED" && currentSeq.aggressorBroker !== aggressorBroker) currentSeq.aggressorBroker = "MIXED";
            }
        }
    }

    if (currentSeq) sequences.push(currentSeq);
    return sequences;
}

function buildEmptyTierSide(): TierSideAggregated {
    return { frequency: 0, value: 0, lot: 0, brokers: [], details: [] };
}

function aggregateTierSide(sequences: TradeSequence[], mode: "AGGRESSIVE" | "PASSIVE"): TierSideAggregated {
    if (sequences.length === 0) return buildEmptyTierSide();

    let totalValue = 0;
    let totalLot = 0;

    const brokerMap = new Map<string, { frequency: number; value: number; lot: number; }>();

    for (const seq of sequences) {
        totalValue += seq.sequenceValue;
        totalLot += seq.sequenceLot;

        let mainBroker = mode === "AGGRESSIVE" ? seq.aggressorBroker : seq.counterBroker;
        mainBroker = mainBroker || "UNKNOWN";

        let b = brokerMap.get(mainBroker);
        if (!b) {
            b = { frequency: 0, value: 0, lot: 0 };
            brokerMap.set(mainBroker, b);
        }
        b.frequency += 1;
        b.value += seq.sequenceValue;
        b.lot += seq.sequenceLot;
    }

    const brokers = Array.from(brokerMap.keys()).sort();
    const details: TierSideBrokerDetail[] = [];

    for (const [broker, info] of brokerMap.entries()) {
        details.push({ broker, frequency: info.frequency, value: info.value, lot: info.lot });
    }

    details.sort((a, b) => b.value - a.value);

    return { frequency: sequences.length, value: totalValue, lot: totalLot, brokers, details };
}

function aggregateTier(
    aggressiveSequences: TradeSequence[],
    passiveSequences: TradeSequence[]
): TierAggregated {
    const aggBuy = aggressiveSequences.filter(s => s.action === "buy");
    const aggSell = aggressiveSequences.filter(s => s.action === "sell");

    const passBuy = passiveSequences.filter(s => s.action === "sell"); // Absorbing sells
    const passSell = passiveSequences.filter(s => s.action === "buy"); // Absorbing buys

    const aggressive_buy = aggregateTierSide(aggBuy, "AGGRESSIVE");
    const aggressive_sell = aggregateTierSide(aggSell, "AGGRESSIVE");
    const passive_buy = aggregateTierSide(passBuy, "PASSIVE");
    const passive_sell = aggregateTierSide(passSell, "PASSIVE");

    const totalBuyValue = aggressive_buy.value + passive_buy.value;
    const totalSellValue = aggressive_sell.value + passive_sell.value;
    const net_value = totalBuyValue - totalSellValue;

    const totalBuyLot = aggressive_buy.lot + passive_buy.lot;
    const totalSellLot = aggressive_sell.lot + passive_sell.lot;
    const net_lot = totalBuyLot - totalSellLot;

    let net_direction: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
    if (net_value > 0) net_direction = "BUY";
    else if (net_value < 0) net_direction = "SELL";

    return { aggressive_buy, aggressive_sell, passive_buy, passive_sell, net_value, net_lot, net_direction };
}

// 10 Tier definitions
const TIER_DEFINITIONS: TierDefinition[] = [
    { id: "T1", label: "Ultra Whale", min: 5_000_000_000, max: null, reason: "Hanya bisa eksekusi di bluechip LQ45 dengan likuiditas tinggi" },
    { id: "T2", label: "Mega Whale", min: 2_000_000_000, max: 5_000_000_000, reason: "Masih perlu algorithmic execution" },
    { id: "T3", label: "Major Insto", min: 1_000_000_000, max: 2_000_000_000, reason: "Bisa navigasi mid-cap stocks" },
    { id: "T4", label: "Big Insto", min: 500_000_000, max: 1_000_000_000, reason: "Optimal untuk diversifikasi 10-20 saham" },
    { id: "T5", label: "Mid Insto", min: 200_000_000, max: 500_000_000, reason: "Sweet spot untuk trading aktif" },
    { id: "T6", label: "Strong Player", min: 100_000_000, max: 200_000_000, reason: "Size cukup meaningful untuk impact positif" },
    { id: "T7", label: "Active Retail", min: 50_000_000, max: 100_000_000, reason: "Retail sophisticated" },
    { id: "T8", label: "Medium Retail", min: 10_000_000, max: 50_000_000, reason: "Typical retail size di Indonesia" },
    { id: "T9", label: "Micro Retail", min: 1_000_000, max: 10_000_000, reason: "Harus fokus di 1-3 saham saja" },
    { id: "T10", label: "Small Retail", min: 0, max: 1_000_000, reason: "Lot trading dominan" }
];

const BIGPLAYER_TIERS: TierId[] = ["T1", "T2", "T3", "T4"];
const TRANSITION_TIERS: TierId[] = ["T5", "T6"];
const RETAIL_TIERS: TierId[] = ["T7", "T8", "T9", "T10"];

/**
 * Parses raw trades into the final structured JSON representation.
 */
export function buildDailyEntry(
    symbol: string,
    date: string,
    rawTrades: RunningTradeRaw[]
): DailyBidOfferEntry {

    const rgTrades = rawTrades.filter(t => {
        if (t.market_board !== "RG") return false;
        if (t.time < "09:00:00") return false;
        if (t.time >= "15:50:00") return false;
        return true;
    });

    const aggSequences = groupConsecutiveTrades(rgTrades, date, "AGGRESSIVE");
    const passSequences = groupConsecutiveTrades(rgTrades, date, "PASSIVE");

    const tierBucketsAgg: Record<TierId, TradeSequence[]> = { T1: [], T2: [], T3: [], T4: [], T5: [], T6: [], T7: [], T8: [], T9: [], T10: [] };
    const tierBucketsPass: Record<TierId, TradeSequence[]> = { T1: [], T2: [], T3: [], T4: [], T5: [], T6: [], T7: [], T8: [], T9: [], T10: [] };

    const distributeToTiers = (seqs: TradeSequence[], buckets: Record<TierId, TradeSequence[]>) => {
        for (const s of seqs) {
            const value = s.sequenceValue;
            const tier = TIER_DEFINITIONS.find((def) => {
                const geMin = value >= def.min;
                const ltMax = def.max == null ? true : value < def.max;
                return geMin && ltMax;
            });
            if (!tier) buckets.T10.push(s);
            else buckets[tier.id].push(s);
        }
    };

    distributeToTiers(aggSequences, tierBucketsAgg);
    distributeToTiers(passSequences, tierBucketsPass);

    const tiers: Record<TierId, TierAggregated> = {
        T1: aggregateTier(tierBucketsAgg.T1, tierBucketsPass.T1),
        T2: aggregateTier(tierBucketsAgg.T2, tierBucketsPass.T2),
        T3: aggregateTier(tierBucketsAgg.T3, tierBucketsPass.T3),
        T4: aggregateTier(tierBucketsAgg.T4, tierBucketsPass.T4),
        T5: aggregateTier(tierBucketsAgg.T5, tierBucketsPass.T5),
        T6: aggregateTier(tierBucketsAgg.T6, tierBucketsPass.T6),
        T7: aggregateTier(tierBucketsAgg.T7, tierBucketsPass.T7),
        T8: aggregateTier(tierBucketsAgg.T8, tierBucketsPass.T8),
        T9: aggregateTier(tierBucketsAgg.T9, tierBucketsPass.T9),
        T10: aggregateTier(tierBucketsAgg.T10, tierBucketsPass.T10),
    };

    const computeZone = (tierIds: TierId[]): ZoneAggregated => {
        let aggressive_buy_value = 0, aggressive_sell_value = 0, passive_buy_value = 0, passive_sell_value = 0;
        let aggressive_buy_lot = 0, aggressive_sell_lot = 0, passive_buy_lot = 0, passive_sell_lot = 0;

        for (const id of tierIds) {
            const t = tiers[id];
            aggressive_buy_value += t.aggressive_buy.value;
            aggressive_sell_value += t.aggressive_sell.value;
            passive_buy_value += t.passive_buy.value;
            passive_sell_value += t.passive_sell.value;

            aggressive_buy_lot += t.aggressive_buy.lot;
            aggressive_sell_lot += t.aggressive_sell.lot;
            passive_buy_lot += t.passive_buy.lot;
            passive_sell_lot += t.passive_sell.lot;
        }

        const totalBuyValue = aggressive_buy_value + passive_buy_value;
        const totalSellValue = aggressive_sell_value + passive_sell_value;
        const totalBuyLot = aggressive_buy_lot + passive_buy_lot;
        const totalSellLot = aggressive_sell_lot + passive_sell_lot;

        return {
            tiers: tierIds,
            aggressive_buy_value, aggressive_sell_value, passive_buy_value, passive_sell_value,
            aggressive_buy_lot, aggressive_sell_lot, passive_buy_lot, passive_sell_lot,
            net_value: totalBuyValue - totalSellValue,
            net_lot: totalBuyLot - totalSellLot,
        };
    };

    const bigplayerZone = computeZone(BIGPLAYER_TIERS);
    const transitionZone = computeZone(TRANSITION_TIERS);
    const retailZone = computeZone(RETAIL_TIERS);

    const total_aggressive_buy_value = Object.values(tiers).reduce((acc, t) => acc + t.aggressive_buy.value, 0);
    const total_aggressive_sell_value = Object.values(tiers).reduce((acc, t) => acc + t.aggressive_sell.value, 0);
    const total_passive_buy_value = Object.values(tiers).reduce((acc, t) => acc + t.passive_buy.value, 0);
    const total_passive_sell_value = Object.values(tiers).reduce((acc, t) => acc + t.passive_sell.value, 0);

    const total_aggressive_buy_lot = Object.values(tiers).reduce((acc, t) => acc + t.aggressive_buy.lot, 0);
    const total_aggressive_sell_lot = Object.values(tiers).reduce((acc, t) => acc + t.aggressive_sell.lot, 0);
    const total_passive_buy_lot = Object.values(tiers).reduce((acc, t) => acc + t.passive_buy.lot, 0);
    const total_passive_sell_lot = Object.values(tiers).reduce((acc, t) => acc + t.passive_sell.lot, 0);

    const total_net_value = (total_aggressive_buy_value + total_passive_buy_value) - (total_aggressive_sell_value + total_passive_sell_value);
    const total_net_lot = (total_aggressive_buy_lot + total_passive_buy_lot) - (total_aggressive_sell_lot + total_passive_sell_lot);

    const bigplayer_net_value = bigplayerZone.net_value;
    const bigplayer_net_lot = bigplayerZone.net_lot;
    const retail_net_value = retailZone.net_value;
    const retail_net_lot = retailZone.net_lot;

    let bigplayer_share_pct = 0, retail_share_pct = 0;
    if (total_net_value !== 0) {
        bigplayer_share_pct = Number(((bigplayer_net_value / Math.abs(total_net_value)) * 100).toFixed(2));
        retail_share_pct = Number(((retail_net_value / Math.abs(total_net_value)) * 100).toFixed(2));
    }

    let bigplayer_vs_retail_direction: BigplayerRetailDirection = "NEUTRAL";
    if (bigplayer_net_value > 0 && retail_net_value < 0) bigplayer_vs_retail_direction = "ACCUM";
    else if (bigplayer_net_value < 0 && retail_net_value > 0) bigplayer_vs_retail_direction = "DIST";

    const total_sequences = aggSequences.length + passSequences.length;
    const total_buy_sequences = aggSequences.filter(s => s.action === "buy").length;
    const total_sell_sequences = aggSequences.filter(s => s.action === "sell").length;

    return {
        symbol,
        date,
        tiers,
        zones: { bigplayer: bigplayerZone, transition: transitionZone, retail: retailZone },
        summary: {
            total_aggressive_buy_value, total_aggressive_sell_value, total_passive_buy_value, total_passive_sell_value,
            total_aggressive_buy_lot, total_aggressive_sell_lot, total_passive_buy_lot, total_passive_sell_lot,
            total_net_value, total_net_lot, bigplayer_net_value, bigplayer_net_lot, retail_net_value, retail_net_lot,
            bigplayer_share_pct, retail_share_pct, bigplayer_vs_retail_direction,
        },
        meta: {
            total_sequences, total_buy_sequences, total_sell_sequences,
            generated_at: new Date().toISOString(),
        },
    };
}
