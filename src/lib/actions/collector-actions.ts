"use server";

import prisma from "@/lib/prisma";
import { exec } from "child_process";
import util from "util";
import fs from "fs";
import os from "os";
import path from "path";

const execAsync = util.promisify(exec);

import {
    eachDayOfInterval,
    parseISO,
    parse,
    isSaturday,
    isSunday,
    subDays,
    format,
    getHours,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { fetchAllRunningTradesForDate, buildDailyEntry } from "@/lib/collectors/tier-flow";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://exodus.stockbit.com";
const PER_PAGE = 50;
const TZ = "Asia/Jakarta";
const MARKET_CLOSE_HOUR = 16;

export type OhlcRow = {
    date: string;
    close: number;
    change: number;
    value: number;
    volume: number;
    frequency: number;
    foreign_buy: number;
    foreign_sell: number;
    net_foreign: number;
    open: number;
    high: number;
    low: number;
    average: number;
    change_percentage: number;
};

function nowInWIB(): Date {
    return toZonedTime(new Date(), TZ);
}

function todayWIB(): string {
    return format(nowInWIB(), "yyyy-MM-dd");
}

function isMarketClosedWIB(): boolean {
    return getHours(nowInWIB()) >= MARKET_CLOSE_HOUR;
}

function ymdWIB(d: Date): string {
    return format(toZonedTime(d, TZ), "yyyy-MM-dd");
}

const RETRY_DELAY_MS = 8_000;
const MAX_RETRIES = 4;

async function fetchWithRetry(
    url: string,
    options: RequestInit,
    label: string
): Promise<Response | null> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const res = await fetch(url, options);

            if (res.status === 401 || res.status === 403) {
                // Auth errors should not be retried
                return res;
            }

            if (res.ok) return res;

            console.warn(`[${label}] Attempt ${attempt}/${MAX_RETRIES} failed: HTTP ${res.status}. Waiting ${RETRY_DELAY_MS / 1000}s...`);
        } catch (err: any) {
            console.warn(`[${label}] Attempt ${attempt}/${MAX_RETRIES} network error: ${err.message}. Waiting ${RETRY_DELAY_MS / 1000}s...`);
        }

        if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        }
    }

    console.warn(`[${label}] All ${MAX_RETRIES} attempts failed. Skipping.`);
    return null; // Signals caller to skip
}

export async function syncSymbolOhlcAction(
    symbol: string,
    token: string,
    from?: string,
    to?: string
) {
    if (!token) {
        return { ok: false, error: "Authentication token required. Set it via API Keys." };
    }

    // Get exiting dates from DB to figure out what to fetch
    const existing = await prisma.oHLC.findMany({
        where: { stockSymbol: symbol },
        orderBy: { date: "desc" },
        select: { date: true },
    });

    const now = new Date();
    const endDate = to ? parseISO(to) : now;
    const startDate = from ? parseISO(from) : subDays(endDate, 320);

    const range = eachDayOfInterval({ start: startDate, end: endDate });

    const existingDates = new Set(existing.map((r) => format(r.date, "yyyy-MM-dd")));
    const lastDateStr = existing.length ? format(existing[0].date, "yyyy-MM-dd") : null;

    const todayStr = todayWIB();
    const marketClosed = isMarketClosedWIB();

    const fetchDates: string[] = [];
    for (const d of range) {
        if (isSaturday(d) || isSunday(d)) continue;
        const ds = format(d, "yyyy-MM-dd");
        if (!existingDates.has(ds) || ds === lastDateStr) {
            fetchDates.push(ds);
        }
    }

    if (lastDateStr && lastDateStr === todayStr && !marketClosed) {
        const i = fetchDates.indexOf(lastDateStr);
        if (i !== -1) fetchDates.splice(i, 1);
    }
    if (lastDateStr && lastDateStr === todayStr && marketClosed) {
        if (!fetchDates.includes(lastDateStr)) fetchDates.push(lastDateStr);
    }

    if (!fetchDates.length) {
        return { ok: true, skipped: true, reason: "Up-to-date", symbol };
    }

    const chunks: string[][] = [];
    for (let i = 0; i < fetchDates.length; i += PER_PAGE) {
        chunks.push(fetchDates.slice(i, i + PER_PAGE));
    }

    const collected: OhlcRow[] = [];
    let page = 1;

    if (symbol === "IHSG") {
        console.log(`[IHSG DEBUG] fetchDates:`, fetchDates);
        console.log(`[IHSG DEBUG] chunks:`, chunks.length);
    }

    for (const _chunk of chunks) {
        const url =
            `${API_BASE}/company-price-feed/historical/summary/${symbol}` +
            `?period=HS_PERIOD_DAILY&limit=${PER_PAGE}&page=${page++}`;

        const fetchOpts: RequestInit = {
            headers: {
                Authorization: `Bearer ${token}`,
                Referer: "https://stockbit.com/",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        };

        const res = await fetchWithRetry(url, fetchOpts, `OHLC:${symbol}`);

        if (!res) continue; // All retries failed, skip this chunk

        if (res.status === 401 || res.status === 403) {
            return { ok: false, error: "Invalid Stockbit token (Unauthorized)", symbol };
        }

        try {
            const json = await res.json();
            const result = json?.data?.result ?? [];

            if (symbol === "IHSG") {
                console.log(`[IHSG DEBUG] URL: ${url}`);
                console.log(`[IHSG DEBUG] Result length: ${result.length}`);
                if (result.length > 0) {
                    console.log(`[IHSG DEBUG] First item:`, result[0]);
                }
            }

            if (Array.isArray(result) && result.length > 0) {
                collected.push(...result);
            }
        } catch (err: any) {
            console.error(`[${symbol}] JSON parse error:`, err);
            continue;
        }
    }

    if (collected.length === 0) {
        return { ok: false, error: "No data fetched from API", symbol };
    }

    const today = ymdWIB(new Date());

    // We fetched PER_PAGE entries, but only want the explicitly missing `fetchDates`
    const fetchDatesSet = new Set(fetchDates);

    const pruned = collected.filter((r) => {
        // Drop incomplete today bar if market is still open
        if (r.date === today && !marketClosed) return false;

        // Ensure we only insert dates we actually requested
        return fetchDatesSet.has(r.date);
    });

    if (symbol === "IHSG") {
        console.log(`[IHSG DEBUG] Pruned length (to be inserted): ${pruned.length}`);
        if (pruned.length === 0 && collected.length > 0) {
            console.log(`[IHSG DEBUG] Collected dates:`, collected.slice(0, 5).map(r => r.date));
            console.log(`[IHSG DEBUG] Requested dates (first 5):`, Array.from(fetchDatesSet).slice(0, 5));
        }
    }

    if (pruned.length === 0) {
        return { ok: true, skipped: true, reason: "Market still open / Data up-to-date", symbol };
    }

    try {
        // Check if the stock exists before inserting to avoid foreign key errors
        const stockExists = await prisma.stock.findUnique({ where: { symbol } });
        if (!stockExists) {
            // Optionally auto-create the stock if it's missing just so foreign keys pass
            await prisma.stock.create({ data: { symbol } });
        }

        // Upsert into DB
        const upsertPromises = pruned.map(row => {
            const dbDate = new Date(row.date);
            return prisma.oHLC.upsert({
                where: {
                    stockSymbol_date: {
                        stockSymbol: symbol,
                        date: dbDate,
                    }
                },
                update: {
                    open: Number(row.open || 0),
                    high: Number(row.high || 0),
                    low: Number(row.low || 0),
                    close: Number(row.close || 0),
                    volume: BigInt(row.volume || 0),
                    value: BigInt(row.value || 0),
                    frequency: row.frequency || 0,
                    foreignBuy: BigInt(row.foreign_buy || 0),
                    foreignSell: BigInt(row.foreign_sell || 0),
                    netForeign: BigInt(row.net_foreign || 0),
                },
                create: {
                    stockSymbol: symbol,
                    date: dbDate,
                    open: Number(row.open || 0),
                    high: Number(row.high || 0),
                    low: Number(row.low || 0),
                    close: Number(row.close || 0),
                    volume: BigInt(row.volume || 0),
                    value: BigInt(row.value || 0),
                    frequency: row.frequency || 0,
                    foreignBuy: BigInt(row.foreign_buy || 0),
                    foreignSell: BigInt(row.foreign_sell || 0),
                    netForeign: BigInt(row.net_foreign || 0),
                }
            });
        });

        await prisma.$transaction(upsertPromises);

        return { ok: true, fetched: collected.length, inserted: pruned.length, symbol };
    } catch (error: any) {
        console.error("DB Insert Error", error);
        if (symbol === "IHSG") {
            console.error("[IHSG DEBUG] Full DB Error:", error);
        }
        // Explicitly format the error message as a plain string so we don't accidentally send BigInts in nested objects
        const errorMsg = error?.message || String(error);
        return { ok: false, error: "Database error: " + errorMsg, symbol };
    }
}

export async function syncBrokerAction(
    brokerCode: string,
    token: string,
    from?: string,
    to?: string
) {
    if (!token) return { ok: false, error: "Authentication token required." };

    const now = new Date();
    const endDate = to ? parseISO(to) : now;
    const startDate = from ? parseISO(from) : subDays(endDate, 7);
    const range = eachDayOfInterval({ start: startDate, end: endDate });

    const fetchDates: string[] = [];
    for (const d of range) {
        if (isSaturday(d) || isSunday(d)) continue;
        fetchDates.push(format(d, "yyyy-MM-dd"));
    }

    if (!fetchDates.length) return { ok: true, skipped: true, reason: "No valid weekdays in date range" };

    const summariesData: any[] = [];
    const transactionsData: any[] = [];

    // Helper to get active symbols available in DB
    const validStocks = await prisma.stock.findMany({ select: { symbol: true } });
    const validSymbols = new Set(validStocks.map((s) => s.symbol));

    function parseNumber(val: any) {
        if (!val) return 0;
        const n = Number(val);
        return isNaN(n) ? 0 : n;
    }

    let errorMsg = null;
    let fetchedCount = 0;

    for (const dateStr of fetchDates) {
        // We fetch Total and Foreign
        for (const invType of ["INVESTOR_TYPE_ALL", "INVESTOR_TYPE_FOREIGN"]) {
            const mappedType = invType === "INVESTOR_TYPE_ALL" ? "Total" : "Foreign";
            const url = `${API_BASE}/findata-view/marketdetectors/activity/${brokerCode}/detail?page=1&limit=1200&from=${dateStr}&to=${dateStr}&transaction_type=TRANSACTION_TYPE_NET&market_board=MARKET_BOARD_REGULER&investor_type=${invType}`;

            try {
                const fetchOpts: RequestInit = {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Referer: "https://stockbit.com/",
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    },
                };

                const res = await fetchWithRetry(url, fetchOpts, `Broker:${brokerCode}:${mappedType}`);

                if (!res) continue; // All retries failed, skip

                if (res.status === 401 || res.status === 403) {
                    throw new Error("Invalid Stockbit token (Unauthorized)");
                }

                const parsed = await res.json();
                const data = parsed.data;
                if (!data) continue;

                fetchedCount++;

                // 1. BrokerSummary
                const bandarDet = data.bandar_detector || {};
                summariesData.push({
                    brokerCode,
                    date: new Date(dateStr),
                    investorType: mappedType,
                    value: BigInt(Math.round(bandarDet.value || 0)),
                    volume: BigInt(Math.round(bandarDet.volume || 0)),
                    frequency: 0,
                    bandarDetector: bandarDet
                });

                // 2. BrokerTransactions
                const brokersBuy = (data.broker_summary && data.broker_summary.brokers_buy) || [];
                const brokersSell = (data.broker_summary && data.broker_summary.brokers_sell) || [];
                const txMap = new Map();

                for (const b of brokersBuy) {
                    const sym = b.netbs_stock_code;
                    if (!validSymbols.has(sym)) continue;
                    if (!txMap.has(sym)) txMap.set(sym, { buyVol: BigInt(0), buyVal: BigInt(0), buyAvg: 0, sellVol: BigInt(0), sellVal: BigInt(0), sellAvg: 0 });
                    const t = txMap.get(sym);
                    t.buyVol += BigInt(Math.round(parseNumber(b.blot)));
                    t.buyVal += BigInt(Math.round(parseNumber(b.bval)));
                    t.buyAvg = parseNumber(b.netbs_buy_avg_price);
                }

                for (const s of brokersSell) {
                    const sym = s.netbs_stock_code;
                    if (!validSymbols.has(sym)) continue;
                    if (!txMap.has(sym)) txMap.set(sym, { buyVol: BigInt(0), buyVal: BigInt(0), buyAvg: 0, sellVol: BigInt(0), sellVal: BigInt(0), sellAvg: 0 });
                    const t = txMap.get(sym);
                    t.sellVol += BigInt(Math.round(Math.abs(parseNumber(s.slot))));
                    t.sellVal += BigInt(Math.round(Math.abs(parseNumber(s.sval))));
                    t.sellAvg = Math.abs(parseNumber(s.netbs_sell_avg_price));
                }

                for (const [sym, t] of txMap.entries()) {
                    if (t.buyVol > BigInt(0)) {
                        transactionsData.push({
                            brokerCode, date: new Date(dateStr), stockSymbol: sym,
                            investorType: mappedType, action: 'BUY',
                            volume: t.buyVol, value: t.buyVal, avgPrice: t.buyAvg
                        });
                    }
                    if (t.sellVol > BigInt(0)) {
                        transactionsData.push({
                            brokerCode, date: new Date(dateStr), stockSymbol: sym,
                            investorType: mappedType, action: 'SELL',
                            volume: t.sellVol, value: t.sellVal, avgPrice: t.sellAvg
                        });
                    }
                }

            } catch (err: any) {
                errorMsg = err.message;
                break; // Stop fetching if unauthorized or severe error
            }
        }
        if (errorMsg && errorMsg.includes("Unauthorized")) break;
    }

    if (errorMsg) return { ok: false, error: errorMsg, brokerCode };
    if (!summariesData.length && !transactionsData.length) {
        return { ok: true, skipped: true, reason: "No data found for requested range", brokerCode };
    }

    try {
        await prisma.$transaction(async (tx) => {
            for (const sum of summariesData) {
                await tx.brokerSummary.upsert({
                    where: { brokerCode_date_investorType: { brokerCode: sum.brokerCode, date: sum.date, investorType: sum.investorType } },
                    update: { value: sum.value, volume: sum.volume, frequency: sum.frequency, bandarDetector: sum.bandarDetector },
                    create: { brokerCode: sum.brokerCode, date: sum.date, investorType: sum.investorType, value: sum.value, volume: sum.volume, frequency: sum.frequency, bandarDetector: sum.bandarDetector }
                });
            }

            // Simple block-delete and insert for transactions to avoid complex manual UPSERT checks via single ID
            const datesToClear = Array.from(new Set(summariesData.map(s => s.date)));
            if (datesToClear.length > 0) {
                await tx.brokerTransaction.deleteMany({
                    where: { brokerCode, date: { in: datesToClear } }
                });
            }
            if (transactionsData.length > 0) {
                await tx.brokerTransaction.createMany({
                    data: transactionsData,
                    skipDuplicates: true
                });
            }
        });

        return { ok: true, summariesInserted: summariesData.length, txInserted: transactionsData.length, brokerCode };
    } catch (err: any) {
        console.error("Broker DB Insert Error:", err);
        return { ok: false, error: "Database error: " + (err?.message || String(err)), brokerCode };
    }
}

export async function syncBidOfferAction(
    symbol: string,
    token: string,
    from?: string,
    to?: string
) {
    if (!token) return { ok: false, error: "Authentication token required.", symbol };

    const now = new Date();
    const endDate = to ? parseISO(to) : now;
    const startDate = from ? parseISO(from) : subDays(endDate, 7);
    const range = eachDayOfInterval({ start: startDate, end: endDate });

    const fetchDates: string[] = [];
    for (const d of range) {
        if (isSaturday(d) || isSunday(d)) continue;
        fetchDates.push(format(d, "yyyy-MM-dd"));
    }

    if (!fetchDates.length) return { ok: true, skipped: true, reason: "No valid weekdays", symbol };

    let totalFetched = 0;

    for (const dateStr of fetchDates) {
        try {
            const rawTrades = await fetchAllRunningTradesForDate(symbol, dateStr, token);

            if (rawTrades.length === 0) {
                continue;
            }

            const entry = buildDailyEntry(symbol, dateStr, rawTrades);
            totalFetched++;

            // Ensure stock exists because BidOffer requires foreign key
            const stockExists = await prisma.stock.findUnique({ where: { symbol } });
            if (!stockExists) {
                await prisma.stock.create({ data: { symbol } });
            }

            // Store pure JSON representation inside `tiers` column
            await prisma.bidOffer.upsert({
                where: {
                    stockSymbol_date: {
                        stockSymbol: symbol,
                        date: new Date(dateStr)
                    }
                },
                update: { tiers: entry as any },
                create: { stockSymbol: symbol, date: new Date(dateStr), tiers: entry as any }
            });

        } catch (err: any) {
            console.error(`Error processing BidOffer for ${symbol} on ${dateStr}:`, err);
            const errorMsg = err?.message || String(err);
            // Stockbit token mismatch
            if (errorMsg.includes("Unauthorized") || errorMsg.includes("rate limit")) {
                return { ok: false, error: errorMsg, symbol };
            }
        }
    }

    if (totalFetched === 0) {
        return { ok: true, skipped: true, reason: "Market still open / Data up-to-date", symbol };
    }

    return { ok: true, fetched: totalFetched, symbol };
}

export async function syncFundamentalAction(
    symbol: string,
    token: string
) {
    if (!token) return { ok: false, error: "Authentication token required.", symbol };

    const url = `https://exodus.stockbit.com/keystats/ratio/v1/${symbol}?year_limit=10`;

    try {
        const fetchOpts: RequestInit = {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Referer: "https://stockbit.com/",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            cache: "no-store",
        };

        const res = await fetchWithRetry(url, fetchOpts, `Fundamental:${symbol}`);

        if (!res) return { ok: false, error: "Failed after retries", symbol };

        if (res.status === 401 || res.status === 403) {
            return { ok: false, error: "Invalid Stockbit token (Unauthorized)", symbol };
        }

        const data = await res.json();

        if (!data || typeof data !== 'object') {
            console.error(`[Fundamental] ${symbol} returned invalid JSON:`, data);
            return { ok: false, error: "Invalid JSON response from API", symbol };
        }

        const dataSize = JSON.stringify(data).length;
        console.log(`[Fundamental] Synced ${symbol}. Data size: ${dataSize} bytes`);

        // Manual upsert: findUnique then update or create
        try {
            const existing = await prisma.fundamental.findFirst({
                where: { stockSymbol: symbol }
            });

            if (existing) {
                const result = await prisma.fundamental.update({
                    where: { id: existing.id },
                    data: { data: data as any }
                });
                return { ok: true, symbol, id: result.id, operation: 'updated' };
            } else {
                const result = await prisma.fundamental.create({
                    data: {
                        stockSymbol: symbol,
                        data: data as any
                    }
                });
                return { ok: true, symbol, id: result.id, operation: 'created' };
            }
        } catch (dbErr: any) {
            console.error(`[Fundamental DB Error] ${symbol}:`, dbErr.message);
            return { ok: false, error: "Database error: " + dbErr.message, symbol };
        }
    } catch (err: any) {
        console.error(`Error syncing fundamentals for ${symbol}:`, err);
        return { ok: false, error: "Database or network error: " + (err?.message || String(err)), symbol };
    }
}

import PdfParser from "pdf2json";

function parseOwnershipRow(line: string) {
    const parts = line.trim().split(/\s{2,}/);
    // Minimal parts: Date, Symbol, Issuer, InvestorName, Scripless, Scrip, Total, Pct (8 parts)
    if (parts.length < 8) return null;

    const pctStr = parts.pop()!;
    let percentage = parseFloat(pctStr.replace(',', '.'));
    if (isNaN(percentage)) return null;

    const totalRawStr = parts.pop()!;
    const scripRawStr = parts.pop()!;
    const scriplessRawStr = parts.pop()!;

    const totalRaw = totalRawStr.replace(/\./g, '');
    const scripRaw = scripRawStr.replace(/\./g, '');
    const scriplessRaw = scriplessRawStr.replace(/\./g, '');

    if (isNaN(Number(totalRaw)) || isNaN(Number(scripRaw)) || isNaN(Number(scriplessRaw))) {
        return null;
    }

    // Attempt to extract optional columns: Domicile, Nationality, Local/Foreign, InvestorType
    // These are often missing or merged in the PDF if empty.
    let domicile = "UNKNOWN";
    let nationality = "UNKNOWN";
    let localForeign = "L";
    let investorType = "UNKNOWN";

    // Logic for optional columns if we have enough parts left
    // Expected order from end: Domicile, [Nationality], Local/Foreign, InvestorType
    if (parts.length >= 6) {
        // We have metadata. Let's try to locate 'L' or 'A'
        let potentialLF = parts[parts.length - 1]; // Could be Domicile if LF is shifted
        let potentialLF2 = parts[parts.length - 2];
        let potentialLF3 = parts[parts.length - 3];

        if (potentialLF === 'L' || potentialLF === 'A') {
            localForeign = parts.pop()!;
            investorType = parts.pop()!;
        } else if (potentialLF2 === 'L' || potentialLF2 === 'A') {
            domicile = parts.pop()!;
            localForeign = parts.pop()!;
            investorType = parts.pop()!;
        } else if (potentialLF3 === 'L' || potentialLF3 === 'A') {
            domicile = parts.pop()!;
            nationality = parts.pop()!;
            localForeign = parts.pop()!;
            investorType = parts.pop()!;
        }
    }

    const dateStr = parts.shift()!;
    const stockSymbol = parts.shift()!;
    const issuerName = parts.shift()!;

    return {
        dateStr,
        stockSymbol,
        investorName: parts.join(' ').trim(),
        investorType,
        localForeign,
        nationality,
        domicile,
        scrip: BigInt(scripRaw),
        scripless: BigInt(scriplessRaw),
        total: BigInt(totalRaw),
        percentage
    };
}

export async function syncOwnershipIdxAction(dateFrom: string, dateTo: string) {
    try {
        console.log(`[IdxSync] Starting sync: ${dateFrom} to ${dateTo}`);
        const idxApiUrl = `https://www.idx.co.id/primary/ListedCompany/GetAnnouncement?kodeEmiten=&emitenType=*&indexFrom=0&pageSize=10&dateFrom=${dateFrom}&dateTo=${dateTo}&lang=id&keyword=pemegang+1%25`;

        let idxData: any;

        try {
            const idxRes = await fetch(idxApiUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json"
                }
            });

            if (idxRes.status === 403 || !idxRes.ok) {
                throw new Error(`IDX API HTTP ${idxRes.status}`);
            }
            idxData = await idxRes.json();
        } catch (fetchErr: any) {
            console.warn(`[IdxSync] Primary API fetch failed (${fetchErr.message}). Attempting Playwright fallback...`);
            const scriptPath = path.join(process.cwd(), "src/lib/scripts/idx_playwright_fetch.mjs");
            const { stdout, stderr } = await execAsync(`node ${scriptPath} "${idxApiUrl}"`);
            const parsedOutput = JSON.parse(stdout);

            if (!parsedOutput.ok) {
                return { ok: false, error: `Playwright fallback failed with status ${parsedOutput.status}: ${stderr}` };
            }
            idxData = parsedOutput.data;
        }
        const replies = idxData?.Replies || [];

        // Find the specific announcement "Pemegang Saham di atas 1% (KSEI)"
        const targetAnnouncement = replies.find((r: any) =>
            r.pengumuman?.JudulPengumuman?.toLowerCase().includes("pemegang saham di atas 1%")
        );

        if (!targetAnnouncement) {
            return { ok: true, details: "No 1% ownership announcement found for this date range.", count: 0 };
        }

        // Find the correct PDF attachment. Usually lampiran 1 or similar.
        // The API returns multiple attachments (cover letter + actual data lampiran)
        // Usually the lampiran has "lamp" in the original filename or IsAttachment is true
        const attachments = targetAnnouncement.attachments || [];
        const dataAttachment = attachments.find((a: any) =>
            a.IsAttachment === true || a.OriginalFilename?.toLowerCase().includes("lamp")
        ) || attachments[0];

        if (!dataAttachment || !dataAttachment.FullSavePath) {
            return { ok: false, error: "Announcement found but PDF attachment is missing." };
        }

        const pdfUrl = dataAttachment.FullSavePath;
        const pdfFilename = dataAttachment.PDFFilename || pdfUrl.split('/').pop();
        const announcementDateStr = targetAnnouncement.pengumuman.TglPengumuman; // e.g. "2026-03-03T16:04:48"
        const announcementDate = new Date(announcementDateStr);

        console.log(`[IdxSync] Found PDF: ${pdfUrl}`);

        // Deduplication Check
        const existingMeta = await prisma.ownershipSyncMeta.findFirst({
            where: { lastPdfName: pdfFilename }
        });

        if (existingMeta) {
            console.log(`[IdxSync] PDF ${pdfFilename} already processed. Skipping.`);
            return { ok: true, details: `PDF already synced on ${existingMeta.updatedAt.toISOString()}`, count: 0, skipped: true };
        }

        // Fetch or download the PDF File
        let buffer: Buffer;

        try {
            const pdfRes = await fetch(pdfUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                }
            });

            if (pdfRes.status === 403 || !pdfRes.ok) {
                throw new Error(`IDX PDF download returned HTTP ${pdfRes.status}`);
            }

            const arrayBuffer = await pdfRes.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
        } catch (pdfErr: any) {
            console.warn(`[IdxSync] Primary PDF download failed (${pdfErr.message}). Attempting Playwright fallback...`);
            const scriptPath = path.join(process.cwd(), "src/lib/scripts/idx_playwright_fetch.mjs");
            const tempPdfPath = path.join(os.tmpdir(), `idx_pdf_${Date.now()}.pdf`);

            const { stdout } = await execAsync(`node ${scriptPath} --download "${pdfUrl}" "${tempPdfPath}"`);
            const parsedOutput = JSON.parse(stdout);

            if (!parsedOutput.ok) {
                return { ok: false, error: `Playwright PDF download failed with status ${parsedOutput.status}` };
            }

            buffer = fs.readFileSync(tempPdfPath);
            // Cleanup the temporary PDF
            fs.unlinkSync(tempPdfPath);
        }

        // --- Execute PDF Parsing Logic ---
        const pdfParser = new PdfParser();
        const parsePromise = new Promise((resolve, reject) => {
            pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
            pdfParser.on("pdfParser_dataReady", (pdfData: any) => resolve(pdfData));
        });

        pdfParser.parseBuffer(buffer);
        const pdfData: any = await parsePromise;

        const extractedRows: ReturnType<typeof parseOwnershipRow>[] = [];
        let expectedDatePattern = /^\d{2}-[a-zA-Z]{3}-\d{4}$/;

        pdfData.Pages.forEach((page: any, pageIndex: number) => {
            let clusters: { y: number, elements: any[] }[] = [];

            page.Texts.forEach((textItem: any) => {
                let text = "";
                try { text = decodeURIComponent(textItem.R[0].T); }
                catch { text = textItem.R[0].T; }
                text = text.trim();

                if (!text || text === "No." || text.includes("Pemegang Saham") || text.includes("Pendidikan") || text.includes("This file is") || text.includes("electronically generated")) {
                    return;
                }

                const y = textItem.y;
                const x = textItem.x;
                const w = textItem.w;

                let found = false;
                for (let c of clusters) {
                    if (Math.abs(c.y - y) <= 0.3) {
                        c.elements.push({ text, x, w });
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    clusters.push({ y: y, elements: [{ text, x, w }] });
                }
            });

            // Sort clusters vertically (Top to Bottom)
            clusters.sort((a, b) => a.y - b.y);

            for (let cluster of clusters) {
                // Sort elements horizontally in the row
                cluster.elements.sort((a, b) => a.x - b.x);

                let rowText = "";
                let prevItem: any = null;

                for (let item of cluster.elements) {
                    if (!prevItem) {
                        rowText = item.text;
                    } else {
                        const endX = prevItem.x + (prevItem.w / 16.1);
                        const gap = item.x - endX;

                        // Force a column break (double space) if we cross the Investor Name anchor (x ~10.1)
                        const crossedInvestorAnchor = prevItem.x < 10.1 && item.x >= 10.1;

                        // Gap > 0.2 indicates column separation.
                        // ALSO, if gap is negative (item starts BEFORE previous item ends), 
                        // it's likely a distinct column piece that overlapped in coordinates in the PDF.
                        if (crossedInvestorAnchor || gap > 0.2 || gap < 0) {
                            rowText += "  " + item.text;
                        } else {
                            rowText += " " + item.text; // Same column word piece
                        }
                    }
                    prevItem = item;
                }

                const firstToken = rowText.split(' ')[0];
                if (expectedDatePattern.test(firstToken)) {
                    const rowData = parseOwnershipRow(rowText);
                    if (rowData) {
                        extractedRows.push(rowData);
                    }
                }
            }
        });

        if (extractedRows.length === 0) {
            return { ok: false, error: "No valid data rows extracted. PDF format might have changed." };
        }

        // Map and parse the date string to Date objects
        // and ensure required string/number fields are non-undefined for TS
        const nonNullRows = extractedRows.filter((row): row is NonNullable<typeof row> => row !== null);
        const mappedRows = nonNullRows.map((row) => {
            const date = parse(row.dateStr, "dd-MMM-yyyy", new Date());
            return {
                ...row,
                date,
                stockSymbol: row.stockSymbol || "",
                investorName: row.investorName || "",
                investorType: row.investorType || "",
                localForeign: row.localForeign || "",
                nationality: row.nationality || "",
                domicile: row.domicile || "",
                scrip: row.scrip ?? BigInt(0),
                scripless: row.scripless ?? BigInt(0),
                total: row.total ?? BigInt(0),
                percentage: row.percentage ?? 0
            };
        }).filter(row => !isNaN(row.date.getTime()) && row.stockSymbol !== "");

        // --- De-duplicate Parsed Rows ---
        const uniqueKeySet = new Set<string>();
        const parsedRows: typeof mappedRows = [];
        for (const row of mappedRows) {
            const key = `${row.date.toISOString()}_${row.stockSymbol}_${row.investorName}`;
            if (!uniqueKeySet.has(key)) {
                uniqueKeySet.add(key);
                parsedRows.push(row);
            }
        }

        if (parsedRows.length === 0) {
            return { ok: false, error: "No valid unique rows to process." };
        }

        // Ensure stocks exist
        const uniqueSymbols = Array.from(new Set(parsedRows.map(r => r.stockSymbol)));
        if (uniqueSymbols.length === 0) {
            return { ok: false, error: "No valid stock symbols found in the PDF" };
        }

        const existingStocks = await prisma.stock.findMany({
            where: { symbol: { in: uniqueSymbols.filter(s => s !== undefined) as string[] } },
            select: { symbol: true }
        });
        const existingSymbolSet = new Set(existingStocks.map(s => s.symbol));
        const missingSymbols = uniqueSymbols.filter(s => s && !existingSymbolSet.has(s));

        if (missingSymbols.length > 0) {
            await prisma.stock.createMany({
                data: missingSymbols.map(sym => ({ symbol: sym as string })),
                skipDuplicates: true
            });
        }

        // --- Database Insertion ---
        const BATCH_SIZE = 1000;
        let insertedCount = 0;

        for (let i = 0; i < parsedRows.length; i += BATCH_SIZE) {
            const chunk = parsedRows.slice(i, i + BATCH_SIZE);

            await prisma.$transaction(async (tx) => {
                const existingOwnerships = await Promise.all(
                    chunk.map(row =>
                        tx.ownership.findUnique({
                            where: {
                                date_stockSymbol_investorName: {
                                    date: row.date,
                                    stockSymbol: row.stockSymbol,
                                    investorName: row.investorName
                                }
                            }
                        })
                    )
                );

                const baselineOwnerships = await Promise.all(
                    chunk.map(row =>
                        tx.ownership.findFirst({
                            where: {
                                stockSymbol: row.stockSymbol,
                                investorName: row.investorName,
                                date: { lte: row.date }
                            },
                            orderBy: { date: 'desc' }
                        })
                    )
                );

                const ownershipChanges = [];
                for (let j = 0; j < chunk.length; j++) {
                    const row = chunk[j];
                    const baseline = baselineOwnerships[j];

                    if (baseline) {
                        const hasTotalChanged = baseline.total !== row.total;
                        const hasPctChanged = baseline.percentage !== row.percentage;
                        const hasScripChanged = baseline.scrip !== row.scrip;
                        const hasScriplessChanged = baseline.scripless !== row.scripless;

                        if (hasTotalChanged || hasPctChanged || hasScripChanged || hasScriplessChanged) {
                            ownershipChanges.push({
                                date: row.date,
                                stockSymbol: row.stockSymbol,
                                investorName: row.investorName,
                                previousTotal: baseline.total,
                                newTotal: row.total,
                                changeTotal: row.total - baseline.total,
                                previousScrip: baseline.scrip,
                                newScrip: row.scrip,
                                changeScrip: row.scrip - baseline.scrip,
                                previousScripless: baseline.scripless,
                                newScripless: row.scripless,
                                changeScripless: row.scripless - baseline.scripless,
                                previousPct: baseline.percentage,
                                newPct: row.percentage,
                                changePct: Number((row.percentage - baseline.percentage).toFixed(2))
                            });
                        }
                    }
                }

                for (const row of chunk) {
                    await tx.ownership.upsert({
                        where: {
                            date_stockSymbol_investorName: {
                                date: row.date,
                                stockSymbol: row.stockSymbol,
                                investorName: row.investorName
                            }
                        },
                        update: {
                            investorType: row.investorType,
                            localForeign: row.localForeign,
                            nationality: row.nationality,
                            domicile: row.domicile,
                            scrip: row.scrip,
                            scripless: row.scripless,
                            total: row.total,
                            percentage: row.percentage
                        },
                        create: {
                            date: row.date,
                            stockSymbol: row.stockSymbol,
                            investorName: row.investorName,
                            investorType: row.investorType,
                            localForeign: row.localForeign,
                            nationality: row.nationality,
                            domicile: row.domicile,
                            scrip: row.scrip,
                            scripless: row.scripless,
                            total: row.total,
                            percentage: row.percentage
                        }
                    });
                    insertedCount++;
                }

                if (ownershipChanges.length > 0) {
                    await tx.ownershipChange.createMany({
                        data: ownershipChanges
                    });
                }
            });
        }

        // Record the Sync Meta on Success
        await prisma.ownershipSyncMeta.create({
            data: {
                lastDate: announcementDate,
                lastPdfName: pdfFilename
            }
        });

        return { ok: true, details: `Successfully fetched and processed ${insertedCount} ownership records from IDX.`, count: insertedCount };

    } catch (err: unknown) {
        console.error("IDX Sync Error:", err);
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
