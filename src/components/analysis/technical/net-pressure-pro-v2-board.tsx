"use client";

import { memo, useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useStockbitWebSocket } from "@/hooks/use-stockbit-ws";
import { MarketDataParser } from "@/lib/market-data-parser";
import { ProtobufUtil } from "@/lib/proto";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Activity, TrendingUp, Filter, Zap, Eye, EyeOff, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import localforage from "localforage";

// --- Types ---
interface RankingStats {
    symbol: string;
    buyVolume: number;
    sellVolume: number;
    netVolume: number;
    totalVolume: number;
    buyPressure: number;
    lastPrice: number;
    buyValue: number;
    sellValue: number;
    netValue: number;
    totalValue: number;
    whaleBuyValue: number;
    whaleSellValue: number;
    retailBuyValue: number;
    retailSellValue: number;
    whaleBuyLot: number;
    whaleSellLot: number;
    retailBuyLot: number;
    retailSellLot: number;
    whaleHakaPct: number;
    whaleHakiPct: number;
    retailHakaPct: number;
    retailHakiPct: number;
    topBuyPrice: number;
    topBuyLots: number;
    duration?: string; // Formatted duration string (e.g., "5m 20s")
}

interface Trade {
    time: string;
    symbol: string;
    price: number;
    volume: number;
    side: "BUY" | "SELL";
    timestamp: number;
}

interface PerfStats {
    ingestMs: number;
    uiMs: number;
    batchSize: number;
    parsedTrades: number;
    bufferDepth: number;
}

type LinerKey = "first_liner" | "second_liner" | "third_liner";

type LinerApiResponse = {
    symbolToLiner: Record<string, LinerKey>;
};

type PreviousCloseApiResponse = {
    symbolToPrevClose: Record<string, number>;
};

const normalizeSymbolKey = (symbol: string) =>
    symbol.trim().toUpperCase().replace(/\..*$/, "");

const formatVolume = (vol: number) => {
    return vol.toLocaleString('id-ID');
};

const formatValue = (val: number) => {
    const absVal = Math.abs(val);
    if (absVal >= 1e9) return (val / 1e9).toFixed(2) + 'B';
    if (absVal >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    if (absVal >= 1e3) return (val / 1e3).toFixed(2) + 'K';
    return Math.floor(val).toLocaleString('id-ID');
};

const formatPrice = (price: number) => {
    if (!price || Number.isNaN(price)) return "-";
    return price.toLocaleString("id-ID");
};

const formatPct = (pct: number | null) => {
    if (pct === null || Number.isNaN(pct)) return "-";
    return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
};

const FLOW_CUTOFF_BY_LINER: Record<LinerKey, number> = {
    first_liner: 1_200_000_000,
    second_liner: 140_000_000,
    third_liner: 15_000_000,
};

const CLUSTER_IDLE_MS = 900;
const CLUSTER_MAX_MS = 6_000;

type FlowCluster = {
    symbol: string;
    side: "BUY" | "SELL";
    firstTimestamp: number;
    lastTimestamp: number;
    lastPrice: number;
    totalValue: number;
    totalLots: number;
};

type SessionFlowStats = {
    whaleBuyValue: number;
    whaleSellValue: number;
    retailBuyValue: number;
    retailSellValue: number;
    whaleBuyLot: number;
    whaleSellLot: number;
    retailBuyLot: number;
    retailSellLot: number;
};

type TopBuyPoint = {
    price: number;
    lots: number;
};

type FlowEvent = SessionFlowStats & {
    symbol: string;
    timestamp: number;
};

type FlowWindowData = {
    events: FlowEvent[];
    startIdx: number;
    stats: Record<string, SessionFlowStats>;
};

const EMPTY_SESSION_FLOW: SessionFlowStats = {
    whaleBuyValue: 0,
    whaleSellValue: 0,
    retailBuyValue: 0,
    retailSellValue: 0,
    whaleBuyLot: 0,
    whaleSellLot: 0,
    retailBuyLot: 0,
    retailSellLot: 0,
};

const resolveLiner = (symbol: string, linerMap: Record<string, LinerKey>): LinerKey => {
    return linerMap[normalizeSymbolKey(symbol)] ?? "second_liner";
};

const linerDigitByKey: Record<LinerKey, "1" | "2" | "3"> = {
    first_liner: "1",
    second_liner: "2",
    third_liner: "3",
};

const linerClassByKey: Record<LinerKey, string> = {
    first_liner: "text-emerald-600 dark:text-emerald-400",
    second_liner: "text-gray-900 dark:text-gray-100",
    third_liner: "text-red-500 dark:text-red-400",
};

const getLinerBadge = (symbol: string, linerMap: Record<string, LinerKey>) => {
    const liner = resolveLiner(symbol, linerMap);
    return {
        digit: linerDigitByKey[liner],
        className: linerClassByKey[liner],
    };
};

const getFlowPercentages = (flow: SessionFlowStats) => {
    const whaleTotal = flow.whaleBuyValue + flow.whaleSellValue;
    const retailTotal = flow.retailBuyValue + flow.retailSellValue;

    return {
        whaleHakaPct: whaleTotal > 0 ? (flow.whaleBuyValue / whaleTotal) * 100 : 0,
        whaleHakiPct: whaleTotal > 0 ? (flow.whaleSellValue / whaleTotal) * 100 : 0,
        retailHakaPct: retailTotal > 0 ? (flow.retailBuyValue / retailTotal) * 100 : 0,
        retailHakiPct: retailTotal > 0 ? (flow.retailSellValue / retailTotal) * 100 : 0,
    };
};

// --- Helper Functions (Module Scope) ---
const initStat = (symbol: string): RankingStats => ({
    symbol, buyVolume: 0, sellVolume: 0, netVolume: 0, totalVolume: 0, buyPressure: 0, lastPrice: 0,
    buyValue: 0, sellValue: 0, netValue: 0, totalValue: 0,
    whaleBuyValue: 0, whaleSellValue: 0, retailBuyValue: 0, retailSellValue: 0,
    whaleBuyLot: 0, whaleSellLot: 0, retailBuyLot: 0, retailSellLot: 0,
    whaleHakaPct: 0, whaleHakiPct: 0, retailHakaPct: 0, retailHakiPct: 0,
    topBuyPrice: 0, topBuyLots: 0
});

const updateStat = (stat: RankingStats, trade: Trade) => {
    const tradeValue = trade.volume * 100 * trade.price;

    if (trade.side === "BUY") {
        stat.buyVolume += trade.volume;
        stat.buyValue += tradeValue;
    } else if (trade.side === "SELL") {
        stat.sellVolume += trade.volume;
        stat.sellValue += tradeValue;
    }

    stat.totalVolume += trade.volume;
    stat.totalValue += tradeValue;
    stat.lastPrice = trade.price || stat.lastPrice;
    stat.netVolume = stat.buyVolume - stat.sellVolume;
    stat.netValue = stat.buyValue - stat.sellValue;
    stat.buyPressure = stat.totalVolume > 0 ? (stat.buyVolume / stat.totalVolume) * 100 : 0;
};

const addToStat = (stats: Record<string, RankingStats>, trade: Trade) => {
    if (!stats[trade.symbol]) stats[trade.symbol] = initStat(trade.symbol);
    updateStat(stats[trade.symbol], trade);
};

const subtractFromStat = (stats: Record<string, RankingStats>, trade: Trade) => {
    if (!stats[trade.symbol]) return;
    const tradeValue = trade.volume * 100 * trade.price;

    if (trade.side === "BUY") {
        stats[trade.symbol].buyVolume -= trade.volume;
        stats[trade.symbol].buyValue -= tradeValue;
    } else if (trade.side === "SELL") {
        stats[trade.symbol].sellVolume -= trade.volume;
        stats[trade.symbol].sellValue -= tradeValue;
    }

    stats[trade.symbol].totalVolume -= trade.volume;
    stats[trade.symbol].totalValue -= tradeValue;
    stats[trade.symbol].netVolume = stats[trade.symbol].buyVolume - stats[trade.symbol].sellVolume;
    stats[trade.symbol].netValue = stats[trade.symbol].buyValue - stats[trade.symbol].sellValue;
    stats[trade.symbol].buyPressure = stats[trade.symbol].totalVolume > 0 ? (stats[trade.symbol].buyVolume / stats[trade.symbol].totalVolume) * 100 : 0;

    if (stats[trade.symbol].totalVolume <= 0) {
        delete stats[trade.symbol];
    }
};

type WindowData = {
    trades: Trade[];
    startIdx: number;
    stats: Record<string, RankingStats>;
};

const pruneWindow = (windowData: WindowData, cutoffTimestamp: number) => {
    const trades = windowData.trades;
    while (windowData.startIdx < trades.length && trades[windowData.startIdx].timestamp < cutoffTimestamp) {
        subtractFromStat(windowData.stats, trades[windowData.startIdx]);
        windowData.startIdx++;
    }

    if (windowData.startIdx > 0 && (windowData.startIdx > 1000 || windowData.startIdx > trades.length / 2)) {
        windowData.trades = trades.slice(windowData.startIdx);
        windowData.startIdx = 0;
    }
};

const ensureFlowStats = (stats: Record<string, SessionFlowStats>, symbol: string) => {
    if (!stats[symbol]) {
        stats[symbol] = {
            whaleBuyValue: 0,
            whaleSellValue: 0,
            retailBuyValue: 0,
            retailSellValue: 0,
            whaleBuyLot: 0,
            whaleSellLot: 0,
            retailBuyLot: 0,
            retailSellLot: 0,
        };
    }
    return stats[symbol];
};

const addFlowEventToStats = (stats: Record<string, SessionFlowStats>, event: FlowEvent) => {
    const flow = ensureFlowStats(stats, event.symbol);
    flow.whaleBuyValue += event.whaleBuyValue;
    flow.whaleSellValue += event.whaleSellValue;
    flow.retailBuyValue += event.retailBuyValue;
    flow.retailSellValue += event.retailSellValue;
    flow.whaleBuyLot += event.whaleBuyLot;
    flow.whaleSellLot += event.whaleSellLot;
    flow.retailBuyLot += event.retailBuyLot;
    flow.retailSellLot += event.retailSellLot;
};

const subtractFlowEventFromStats = (stats: Record<string, SessionFlowStats>, event: FlowEvent) => {
    const flow = stats[event.symbol];
    if (!flow) return;

    flow.whaleBuyValue -= event.whaleBuyValue;
    flow.whaleSellValue -= event.whaleSellValue;
    flow.retailBuyValue -= event.retailBuyValue;
    flow.retailSellValue -= event.retailSellValue;
    flow.whaleBuyLot -= event.whaleBuyLot;
    flow.whaleSellLot -= event.whaleSellLot;
    flow.retailBuyLot -= event.retailBuyLot;
    flow.retailSellLot -= event.retailSellLot;

    if (
        flow.whaleBuyValue <= 0 &&
        flow.whaleSellValue <= 0 &&
        flow.retailBuyValue <= 0 &&
        flow.retailSellValue <= 0 &&
        flow.whaleBuyLot <= 0 &&
        flow.whaleSellLot <= 0 &&
        flow.retailBuyLot <= 0 &&
        flow.retailSellLot <= 0
    ) {
        delete stats[event.symbol];
    }
};

const addFlowEventToWindow = (windowData: FlowWindowData, event: FlowEvent) => {
    windowData.events.push(event);
    addFlowEventToStats(windowData.stats, event);
};

const pruneFlowWindow = (windowData: FlowWindowData, cutoffTimestamp: number) => {
    const events = windowData.events;
    while (windowData.startIdx < events.length && events[windowData.startIdx].timestamp < cutoffTimestamp) {
        subtractFlowEventFromStats(windowData.stats, events[windowData.startIdx]);
        windowData.startIdx++;
    }

    if (windowData.startIdx > 0 && (windowData.startIdx > 1000 || windowData.startIdx > events.length / 2)) {
        windowData.events = events.slice(windowData.startIdx);
        windowData.startIdx = 0;
    }
};

const getMetric = (stat: RankingStats, isValue: boolean) => (isValue ? stat.netValue : stat.netVolume);

const insertTop = (top: RankingStats[], candidate: RankingStats, isValue: boolean, limit: number) => {
    const candidateMetric = getMetric(candidate, isValue);
    let left = 0;
    let right = top.length;

    while (left < right) {
        const mid = (left + right) >> 1;
        if (candidateMetric > getMetric(top[mid], isValue)) {
            right = mid;
        } else {
            left = mid + 1;
        }
    }

    if (left >= limit) return;

    top.splice(left, 0, candidate);
    if (top.length > limit) top.pop();
};

const getTop50 = (stats: Record<string, RankingStats>, isValue: boolean) => {
    const top: RankingStats[] = [];
    for (const symbol in stats) {
        insertTop(top, stats[symbol], isValue, 50);
    }
    return top;
};

const areRankingRowsEqual = (
    prev: RankingStats[],
    next: RankingStats[],
    isValue: boolean,
    withDuration = false,
    withFlow = false
) => {
    if (prev.length !== next.length) return false;
    for (let i = 0; i < prev.length; i++) {
        const p = prev[i];
        const n = next[i];
        if (p.symbol !== n.symbol) return false;
        if (p.lastPrice !== n.lastPrice) return false;
        if (isValue ? p.netValue !== n.netValue : p.netVolume !== n.netVolume) return false;
        if (p.buyPressure !== n.buyPressure) return false;
        if (p.topBuyPrice !== n.topBuyPrice) return false;
        if (p.topBuyLots !== n.topBuyLots) return false;
        if (withDuration && p.duration !== n.duration) return false;
        if (withFlow) {
            if (p.whaleBuyValue !== n.whaleBuyValue) return false;
            if (p.whaleSellValue !== n.whaleSellValue) return false;
            if (p.retailBuyValue !== n.retailBuyValue) return false;
            if (p.retailSellValue !== n.retailSellValue) return false;
            if (p.whaleBuyLot !== n.whaleBuyLot) return false;
            if (p.whaleSellLot !== n.whaleSellLot) return false;
            if (p.retailBuyLot !== n.retailBuyLot) return false;
            if (p.retailSellLot !== n.retailSellLot) return false;
            if (p.whaleHakaPct !== n.whaleHakaPct) return false;
            if (p.whaleHakiPct !== n.whaleHakiPct) return false;
            if (p.retailHakaPct !== n.retailHakaPct) return false;
            if (p.retailHakiPct !== n.retailHakiPct) return false;
        }
    }
    return true;
};

const areSymbolColorsEqual = (prev: Record<string, string>, next: Record<string, string>) => {
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);
    if (prevKeys.length !== nextKeys.length) return false;

    for (let i = 0; i < prevKeys.length; i++) {
        const key = prevKeys[i];
        if (prev[key] !== next[key]) return false;
    }
    return true;
};

export function NetPressureProV2Board() {
    // --- State ---
    const [isPlaying, setIsPlaying] = useState(false);

    // UI State (Throttled Updates)
    const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
    const [stats1m, setStats1m] = useState<RankingStats[]>([]);
    const [stats5m, setStats5m] = useState<RankingStats[]>([]);
    const [stats15m, setStats15m] = useState<RankingStats[]>([]);
    const [statsSession, setStatsSession] = useState<RankingStats[]>([]);
    const [symbolColors, setSymbolColors] = useState<Record<string, string>>({});
    const [linerMap, setLinerMap] = useState<Record<string, LinerKey>>({});
    const [previousCloseMap, setPreviousCloseMap] = useState<Record<string, number>>({});
    const [perfStats, setPerfStats] = useState<PerfStats>({
        ingestMs: 0,
        uiMs: 0,
        batchSize: 0,
        parsedTrades: 0,
        bufferDepth: 0,
    });

    // --- High Performance Mutable Refs ---
    const linerMapRef = useRef<Record<string, LinerKey>>({});
    const window1m = useRef<WindowData>({ trades: [], startIdx: 0, stats: {} });
    const window5m = useRef<WindowData>({ trades: [], startIdx: 0, stats: {} });
    const window15m = useRef<WindowData>({ trades: [], startIdx: 0, stats: {} });
    const flowWindow1m = useRef<FlowWindowData>({ events: [], startIdx: 0, stats: {} });
    const flowWindow5m = useRef<FlowWindowData>({ events: [], startIdx: 0, stats: {} });
    const sessionStatsRef = useRef<Record<string, RankingStats>>({});
    const sessionEntryTimes = useRef<Record<string, number>>({});
    const sessionFlowRef = useRef<Record<string, SessionFlowStats>>({});
    const sessionBuyLotsByPriceRef = useRef<Record<string, Map<number, number>>>({});
    const sessionTopBuyRef = useRef<Record<string, TopBuyPoint>>({});
    const activeClustersRef = useRef<Record<string, FlowCluster>>({});
    const latestPriceRef = useRef<Record<string, number>>({});
    const perfRef = useRef<PerfStats>({
        ingestMs: 0,
        uiMs: 0,
        batchSize: 0,
        parsedTrades: 0,
        bufferDepth: 0,
    });

    const recentTradesBuffer = useRef<Trade[]>([]);

    // UI State
    const [showRunningTrades, setShowRunningTrades] = useState(false);
    const [filter, setFilter] = useState("");
    const [showValue, setShowValue] = useState(false);
    const [showWhaleRetailPressure, setShowWhaleRetailPressure] = useState(true);
    const [show15mPressure, setShow15mPressure] = useState(false);

    // Timer State
    const [startTime, setStartTime] = useState<number | null>(null);
    const [duration, setDuration] = useState("00:00:00");

    // Credentials State
    const [token, setToken] = useState("");
    const [wsKey, setWsKey] = useState("");
    const [userId, setUserId] = useState("3103273");

    // --- WebSocket ---
    const {
        connect,
        disconnect,
        sendMessage,
        lastBatch,
        status,
    } = useStockbitWebSocket({
        token: token,
        defaultUrl: "wss://wss-jkt.trading.stockbit.com/ws"
    });

    const buildFlowEventFromCluster = useCallback((cluster: FlowCluster): FlowEvent => {
        const liner = resolveLiner(cluster.symbol, linerMapRef.current);
        const whaleCutoff = FLOW_CUTOFF_BY_LINER[liner];
        const isWhale = cluster.totalValue >= whaleCutoff;
        const flowEvent: FlowEvent = {
            symbol: cluster.symbol,
            timestamp: cluster.lastTimestamp,
            whaleBuyValue: 0,
            whaleSellValue: 0,
            retailBuyValue: 0,
            retailSellValue: 0,
            whaleBuyLot: 0,
            whaleSellLot: 0,
            retailBuyLot: 0,
            retailSellLot: 0,
        };

        if (cluster.side === "BUY") {
            if (isWhale) {
                flowEvent.whaleBuyValue = cluster.totalValue;
                flowEvent.whaleBuyLot = cluster.totalLots;
            } else {
                flowEvent.retailBuyValue = cluster.totalValue;
                flowEvent.retailBuyLot = cluster.totalLots;
            }
        } else {
            if (isWhale) {
                flowEvent.whaleSellValue = cluster.totalValue;
                flowEvent.whaleSellLot = cluster.totalLots;
            } else {
                flowEvent.retailSellValue = cluster.totalValue;
                flowEvent.retailSellLot = cluster.totalLots;
            }
        }
        return flowEvent;
    }, []);

    const flushCluster = useCallback((key: string) => {
        const cluster = activeClustersRef.current[key];
        if (!cluster) return;
        const flowEvent = buildFlowEventFromCluster(cluster);
        addFlowEventToStats(sessionFlowRef.current, flowEvent);
        addFlowEventToWindow(flowWindow1m.current, flowEvent);
        addFlowEventToWindow(flowWindow5m.current, flowEvent);
        delete activeClustersRef.current[key];
    }, [buildFlowEventFromCluster]);

    const flushStaleClusters = useCallback((now: number) => {
        const clusters = activeClustersRef.current;
        const keys = Object.keys(clusters);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (now - clusters[key].lastTimestamp > CLUSTER_IDLE_MS) {
                flushCluster(key);
            }
        }
    }, [flushCluster]);

    const flushAllClusters = useCallback(() => {
        const keys = Object.keys(activeClustersRef.current);
        for (let i = 0; i < keys.length; i++) {
            flushCluster(keys[i]);
        }
    }, [flushCluster]);

    const mergeTradeIntoCluster = useCallback((trade: Trade) => {
        const key = `${trade.symbol}|${trade.side}`;
        const existing = activeClustersRef.current[key];
        const tradeValue = trade.volume * 100 * trade.price;
        const tradeLots = trade.volume;

        if (!existing) {
            activeClustersRef.current[key] = {
                symbol: trade.symbol,
                side: trade.side,
                firstTimestamp: trade.timestamp,
                lastTimestamp: trade.timestamp,
                lastPrice: trade.price,
                totalValue: tradeValue,
                totalLots: tradeLots,
            };
            return;
        }

        const gapMs = trade.timestamp - existing.lastTimestamp;
        const clusterAgeMs = trade.timestamp - existing.firstTimestamp;
        const monotonicPrice =
            trade.side === "BUY"
                ? trade.price >= existing.lastPrice
                : trade.price <= existing.lastPrice;

        if (gapMs > CLUSTER_IDLE_MS || clusterAgeMs > CLUSTER_MAX_MS || !monotonicPrice) {
            flushCluster(key);
            activeClustersRef.current[key] = {
                symbol: trade.symbol,
                side: trade.side,
                firstTimestamp: trade.timestamp,
                lastTimestamp: trade.timestamp,
                lastPrice: trade.price,
                totalValue: tradeValue,
                totalLots: tradeLots,
            };
            return;
        }

        existing.lastTimestamp = trade.timestamp;
        existing.lastPrice = trade.price;
        existing.totalValue += tradeValue;
        existing.totalLots += tradeLots;
    }, [flushCluster]);

    const handlePlayToggle = () => {
        if (isPlaying) {
            flushAllClusters();
            setIsPlaying(false);
            setStartTime(null);
            setDuration("00:00:00");
            return;
        }

        if (!token || !wsKey) {
            toast.error("Credentials Missing", { description: "Please set Token & WS Key in the header using the Key icon." });
            return;
        }

        setStartTime(Date.now());
        setDuration("00:00:00");
        setIsPlaying(true);
    };

    // --- Effects ---

    // Timer Interval
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPlaying && startTime) {
            interval = setInterval(() => {
                const now = Date.now();
                const diff = Math.floor((now - startTime) / 1000);
                const h = Math.floor(diff / 3600).toString().padStart(2, '0');
                const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
                const s = (diff % 60).toString().padStart(2, '0');
                setDuration(`${h}:${m}:${s}`);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isPlaying, startTime]);

    // 0. Fetch Credentials from IndexedDB (localforage)
    useEffect(() => {
        const store = localforage.createInstance({
            name: "morfostocks",
            storeName: "credentials",
        });

        const loadCredentials = async () => {
            try {
                const savedToken = await store.getItem<string>("stockbit_token");
                const savedWsKey = await store.getItem<string>("stockbit_ws_key");

                if (savedToken) {
                    setToken(savedToken);
                    try {
                        const payload = JSON.parse(atob(savedToken.split('.')[1]));
                        if (payload.data?.uid) setUserId(String(payload.data.uid));
                    } catch { }
                }
                if (savedWsKey) setWsKey(savedWsKey);
            } catch (error) {
                console.error("Failed to load credentials from IndexedDB:", error);
                toast.error("Failed to load your credentials from secure storage.");
            }
        };

        loadCredentials();
    }, []);

    // 0b. Fetch liner mapping
    useEffect(() => {
        fetch("/api/analysis/liners", { cache: "no-store" })
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error(`Liner map request failed with status ${res.status}`);
                }
                return res.json() as Promise<LinerApiResponse>;
            })
            .then((data) => {
                if (!data || !data.symbolToLiner || typeof data.symbolToLiner !== "object") {
                    throw new Error("Invalid liner map payload.");
                }

                const normalizedMap: Record<string, LinerKey> = {};
                for (const [symbol, liner] of Object.entries(data.symbolToLiner)) {
                    if (liner !== "first_liner" && liner !== "second_liner" && liner !== "third_liner") {
                        continue;
                    }
                    const key = normalizeSymbolKey(symbol);
                    if (key) normalizedMap[key] = liner;
                }

                linerMapRef.current = normalizedMap;
                setLinerMap(normalizedMap);

                if (Object.keys(normalizedMap).length === 0) {
                    toast.warning("Liner map empty, using fallback classification.");
                }
            })
            .catch((error) => {
                console.error("Failed to fetch liner map:", error);
                toast.warning("Liner map unavailable, using fallback classification.");
            });
    }, []);

    // 0c. Fetch previous close mapping (latest OHLC close per symbol)
    useEffect(() => {
        fetch("/api/analysis/previous-close", { cache: "no-store" })
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error(`Previous close request failed with status ${res.status}`);
                }
                return res.json() as Promise<PreviousCloseApiResponse>;
            })
            .then((data) => {
                if (!data || !data.symbolToPrevClose || typeof data.symbolToPrevClose !== "object") {
                    throw new Error("Invalid previous close payload.");
                }

                const normalizedMap: Record<string, number> = {};
                for (const [symbol, close] of Object.entries(data.symbolToPrevClose)) {
                    if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) continue;
                    const key = normalizeSymbolKey(symbol);
                    if (key) normalizedMap[key] = close;
                }

                setPreviousCloseMap(normalizedMap);

                if (Object.keys(normalizedMap).length === 0) {
                    toast.warning("Previous close map empty, Chg% may show '-'");
                }
            })
            .catch((error) => {
                console.error("Failed to fetch previous close map:", error);
                toast.warning("Previous close map unavailable, Chg% may show '-'");
            });
    }, []);

    // 1. Play/Pause Logic
    useEffect(() => {
        if (isPlaying) {
            if (status === "CLOSED" || status === "ERROR") {
                connect();
            }
        } else {
            if (status === "OPEN" || status === "CONNECTING") {
                disconnect();
            }
        }
    }, [isPlaying, connect, disconnect, status]);

    // 2. Auto-Subscribe
    useEffect(() => {
        if (isPlaying && status === "OPEN" && token && wsKey) {
            try {
                const bytes = ProtobufUtil.encodeRunningTrade(userId, "*", wsKey, token);
                sendMessage(bytes);
                toast.success("Monitor Started");
            } catch (e) {
                console.error("Proto encode error", e);
                disconnect();
                toast.error("Failed to subscribe running trade feed");
            }
        } else if (isPlaying && (!token || !wsKey)) {
            disconnect();
        }
    }, [status, isPlaying, sendMessage, token, wsKey, userId, disconnect]);

    // 3. High-Frequency Data Ingestion
    useEffect(() => {
        if (!lastBatch || lastBatch.length === 0) return;

        const ingestStart = performance.now();
        const now = Date.now();
        const displayTime = new Date(now).toLocaleTimeString('id-ID', { hour12: false });
        const newTrades: Trade[] = [];

        for (let i = 0; i < lastBatch.length; i++) {
            const msg = lastBatch[i] as { data?: unknown; timestamp?: unknown };
            if (typeof msg.data !== "string") continue;

            const update = MarketDataParser.parse(msg.data);
            if (update && update.type === "TRADE" && typeof update.price === "number" && (update.side === "BUY" || update.side === "SELL")) {
                const volLot = Math.round((update.volume || 0) / 100);
                if (volLot > 0) {
                    newTrades.push({
                        volume: volLot,
                        symbol: update.symbol,
                        price: update.price,
                        side: update.side,
                        timestamp: typeof msg.timestamp === "number" ? msg.timestamp : now,
                        time: displayTime
                    });
                }
            }
        }

        if (newTrades.length > 0) {
            newTrades.forEach(trade => {
                const symbolKey = normalizeSymbolKey(trade.symbol);
                latestPriceRef.current[trade.symbol] = trade.price;
                mergeTradeIntoCluster(trade);

                window1m.current.trades.push(trade);
                addToStat(window1m.current.stats, trade);

                window5m.current.trades.push(trade);
                addToStat(window5m.current.stats, trade);

                window15m.current.trades.push(trade);
                addToStat(window15m.current.stats, trade);

                addToStat(sessionStatsRef.current, trade);

                if (trade.side === "BUY") {
                    const priceMap =
                        sessionBuyLotsByPriceRef.current[symbolKey] ??
                        (sessionBuyLotsByPriceRef.current[symbolKey] = new Map<number, number>());
                    const nextLots = (priceMap.get(trade.price) ?? 0) + trade.volume;
                    priceMap.set(trade.price, nextLots);

                    const currentTop = sessionTopBuyRef.current[symbolKey];
                    if (
                        !currentTop ||
                        nextLots > currentTop.lots ||
                        (nextLots === currentTop.lots && trade.price > currentTop.price)
                    ) {
                        sessionTopBuyRef.current[symbolKey] = {
                            price: trade.price,
                            lots: nextLots,
                        };
                    }
                }
            });

            recentTradesBuffer.current.push(...newTrades);
        }

        perfRef.current.ingestMs = performance.now() - ingestStart;
        perfRef.current.batchSize = lastBatch.length;
        perfRef.current.parsedTrades = newTrades.length;
        perfRef.current.bufferDepth = recentTradesBuffer.current.length;
    }, [lastBatch, mergeTradeIntoCluster]);

    // 4. UI Update Interval
    useEffect(() => {
        if (!isPlaying) return;

        const interval = setInterval(() => {
            const uiStart = performance.now();
            const now = Date.now();

            pruneWindow(window1m.current, now - 60 * 1000);
            pruneWindow(window5m.current, now - 5 * 60 * 1000);
            pruneWindow(window15m.current, now - 15 * 60 * 1000);
            pruneFlowWindow(flowWindow1m.current, now - 60 * 1000);
            pruneFlowWindow(flowWindow5m.current, now - 5 * 60 * 1000);
            flushStaleClusters(now);

            const rawStats1m = getTop50(window1m.current.stats, showValue);
            const rawStats5m = getTop50(window5m.current.stats, showValue);
            const newStats15m = getTop50(window15m.current.stats, showValue);

            const newStats1m = rawStats1m.map((stat) => {
                const flow = flowWindow1m.current.stats[stat.symbol] ?? EMPTY_SESSION_FLOW;
                const flowPct = getFlowPercentages(flow);
                const latestPrice = latestPriceRef.current[stat.symbol];
                const topBuy = sessionTopBuyRef.current[normalizeSymbolKey(stat.symbol)];
                return {
                    ...stat,
                    lastPrice: latestPrice ?? stat.lastPrice,
                    topBuyPrice: topBuy?.price ?? 0,
                    topBuyLots: topBuy?.lots ?? 0,
                    ...flow,
                    ...flowPct,
                };
            });

            const newStats5m = rawStats5m.map((stat) => {
                const flow = flowWindow5m.current.stats[stat.symbol] ?? EMPTY_SESSION_FLOW;
                const flowPct = getFlowPercentages(flow);
                const latestPrice = latestPriceRef.current[stat.symbol];
                const topBuy = sessionTopBuyRef.current[normalizeSymbolKey(stat.symbol)];
                return {
                    ...stat,
                    lastPrice: latestPrice ?? stat.lastPrice,
                    topBuyPrice: topBuy?.price ?? 0,
                    topBuyLots: topBuy?.lots ?? 0,
                    ...flow,
                    ...flowPct,
                };
            });

            const newStats15mWithPrice = newStats15m.map((stat) => {
                const latestPrice = latestPriceRef.current[stat.symbol];
                const topBuy = sessionTopBuyRef.current[normalizeSymbolKey(stat.symbol)];
                return {
                    ...stat,
                    lastPrice: latestPrice ?? stat.lastPrice,
                    topBuyPrice: topBuy?.price ?? 0,
                    topBuyLots: topBuy?.lots ?? 0,
                };
            });

            const rawSessionStats = getTop50(sessionStatsRef.current, showValue);
            const currentTopSymbols = new Set(rawSessionStats.map(s => s.symbol));

            Object.keys(sessionEntryTimes.current).forEach(sym => {
                if (!currentTopSymbols.has(sym)) {
                    delete sessionEntryTimes.current[sym];
                }
            });

            const statsWithDuration = rawSessionStats.map(stat => {
                if (!sessionEntryTimes.current[stat.symbol]) {
                    sessionEntryTimes.current[stat.symbol] = now;
                }
                const diff = Math.floor((now - sessionEntryTimes.current[stat.symbol]) / 1000);
                let durationStr = "";
                if (diff < 60) durationStr = `${diff}s`;
                else if (diff < 3600) {
                    const m = Math.floor(diff / 60);
                    const s = diff % 60;
                    durationStr = `${m}m ${s}s`;
                } else {
                    const h = Math.floor(diff / 3600);
                    const m = Math.floor((diff % 3600) / 60);
                    durationStr = `${h}h ${m}m`;
                }
                const latestPrice = latestPriceRef.current[stat.symbol];
                const flow = sessionFlowRef.current[stat.symbol] ?? EMPTY_SESSION_FLOW;
                const flowPct = getFlowPercentages(flow);
                const topBuy = sessionTopBuyRef.current[normalizeSymbolKey(stat.symbol)];
                return {
                    ...stat,
                    lastPrice: latestPrice ?? stat.lastPrice,
                    topBuyPrice: topBuy?.price ?? 0,
                    topBuyLots: topBuy?.lots ?? 0,
                    ...flow,
                    ...flowPct,
                    duration: durationStr,
                };
            });

            const currentColors: Record<string, string> = {};
            const top1m = new Set(newStats1m.map(s => s.symbol));
            const top5m = new Set(newStats5m.map(s => s.symbol));
            const top15m = new Set(newStats15m.map(s => s.symbol));

            const allSymbols = new Set([
                ...top1m,
                ...top5m,
                ...top15m,
                ...statsWithDuration.map(s => s.symbol)
            ]);

            allSymbols.forEach(sym => {
                const in1m = top1m.has(sym);
                const in5m = top5m.has(sym);
                const in15m = top15m.has(sym);

                if (in1m) {
                    currentColors[sym] = "bg-emerald-500/15 dark:bg-emerald-500/20 hover:bg-emerald-500/25 dark:hover:bg-emerald-500/30";
                } else if (in5m) {
                    currentColors[sym] = "bg-yellow-400/20 dark:bg-yellow-500/20 hover:bg-yellow-400/30 dark:hover:bg-yellow-500/30";
                } else if (in15m) {
                    currentColors[sym] = "bg-orange-500/15 dark:bg-orange-500/20 hover:bg-orange-500/25 dark:hover:bg-orange-500/30";
                } else {
                    currentColors[sym] = "bg-red-500/10 dark:bg-red-500/15 hover:bg-red-500/20 dark:hover:bg-red-500/25";
                }
            });

            setStats1m(prev => areRankingRowsEqual(prev, newStats1m, showValue, false, true) ? prev : newStats1m);
            setStats5m(prev => areRankingRowsEqual(prev, newStats5m, showValue, false, true) ? prev : newStats5m);
            setStats15m(prev => areRankingRowsEqual(prev, newStats15mWithPrice, showValue) ? prev : newStats15mWithPrice);
            setStatsSession(prev => areRankingRowsEqual(prev, statsWithDuration, showValue, true, true) ? prev : statsWithDuration);
            setSymbolColors(prev => areSymbolColorsEqual(prev, currentColors) ? prev : currentColors);

            if (recentTradesBuffer.current.length > 0) {
                const newItems = [...recentTradesBuffer.current];
                recentTradesBuffer.current = [];

                setTradeHistory(prev => {
                    const reversed = newItems.reverse();
                    return [...reversed, ...prev].slice(0, 100);
                });
            }

            perfRef.current.uiMs = performance.now() - uiStart;
            perfRef.current.bufferDepth = recentTradesBuffer.current.length;

        }, 125);

        return () => clearInterval(interval);
    }, [isPlaying, showValue, flushStaleClusters]);

    useEffect(() => {
        const interval = setInterval(() => {
            const next = perfRef.current;
            setPerfStats(prev => {
                if (
                    prev.ingestMs === next.ingestMs &&
                    prev.uiMs === next.uiMs &&
                    prev.batchSize === next.batchSize &&
                    prev.parsedTrades === next.parsedTrades &&
                    prev.bufferDepth === next.bufferDepth
                ) {
                    return prev;
                }
                return { ...next };
            });
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    const displayedTrades = useMemo(() => {
        let filtered = tradeHistory;
        if (filter) {
            const upper = filter.toUpperCase();
            filtered = tradeHistory.filter(t => t.symbol.includes(upper));
        }
        return {
            buys: filtered.filter(t => t.side === "BUY").slice(0, 100),
            sells: filtered.filter(t => t.side === "SELL").slice(0, 100)
        };
    }, [tradeHistory, filter]);

    const icon1m = useMemo(() => <Clock className="w-4 h-4 text-blue-500 dark:text-blue-400" />, []);
    const icon5m = useMemo(() => <Clock className="w-4 h-4 text-violet-500 dark:text-violet-400" />, []);
    const icon15m = useMemo(() => <Clock className="w-4 h-4 text-orange-500 dark:text-orange-400" />, []);
    const iconSession = useMemo(() => <Activity className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />, []);
    const rankingGridClass = show15mPressure
        ? (showRunningTrades ? "grid-cols-1 md:grid-cols-2 2xl:grid-cols-3" : "grid-cols-1 md:grid-cols-2 2xl:grid-cols-4")
        : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
    const statusDotClass = status === "OPEN"
        ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.55)]"
        : status === "CONNECTING"
            ? "bg-amber-500 animate-pulse"
            : "bg-red-500 animate-pulse";

    return (
        <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-[#f8fbff] via-[#f5f8ff] to-[#ecf3ff] dark:from-[#0d1524] dark:via-[#0f172a] dark:to-[#121d32]">
            <div className="shrink-0 border-b border-slate-200/70 dark:border-white/10 bg-white/95 dark:bg-[#111b30]/95 backdrop-blur-xl">
                {/* Mobile Header */}
                <div className="flex flex-col gap-2.5 px-3 py-3 md:hidden">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10">
                            <Zap className="h-4 w-4 fill-blue-500 text-blue-500 dark:fill-blue-400 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                                Net Pressure Pro Monitor
                            </h1>
                            <p className="truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                Realtime pressure board
                            </p>
                        </div>
                        <Button
                            size="sm"
                            onClick={handlePlayToggle}
                            className={cn(
                                "h-8 min-w-[86px] rounded-lg px-3 text-[11px] font-semibold shadow-sm",
                                isPlaying
                                    ? "border border-red-200 bg-white text-red-500 hover:bg-red-50 dark:border-red-500/25 dark:bg-[#1e293b] dark:text-red-400 dark:hover:bg-red-500/10"
                                    : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                            )}
                        >
                            {isPlaying ? (
                                <><Pause className="mr-1 h-3.5 w-3.5" /> Stop</>
                            ) : (
                                <><Play className="mr-1 h-3.5 w-3.5" /> Start</>
                            )}
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 dark:border-white/10 dark:bg-white/5">
                            <div className={cn("h-2 w-2 rounded-full", statusDotClass)} />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600 dark:text-slate-300">
                                {status}
                            </span>
                        </div>
                        <div className="flex w-[90px] shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 font-mono text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                            {duration}
                        </div>
                        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1.5 font-mono text-[10px] text-slate-600 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-400">
                            <span>i {perfStats.ingestMs.toFixed(1)}ms</span>
                            <span>u {perfStats.uiMs.toFixed(1)}ms</span>
                            <span>b {perfStats.batchSize}</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <div className="flex w-max items-center gap-2 pr-2">
                            <div className="flex items-center rounded-xl border border-slate-200/80 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-white/5">
                                <button
                                    disabled={isPlaying}
                                    onClick={() => setShowValue(false)}
                                    className={cn(
                                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                                        !showValue
                                            ? "bg-white text-slate-900 shadow-sm dark:bg-[#1e293b] dark:text-white"
                                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                                        isPlaying && "cursor-not-allowed opacity-50"
                                    )}
                                >
                                    Lot
                                </button>
                                <button
                                    disabled={isPlaying}
                                    onClick={() => setShowValue(true)}
                                    className={cn(
                                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                                        showValue
                                            ? "bg-white text-slate-900 shadow-sm dark:bg-[#1e293b] dark:text-white"
                                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                                        isPlaying && "cursor-not-allowed opacity-50"
                                    )}
                                >
                                    Value
                                </button>
                            </div>

                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setShowRunningTrades(!showRunningTrades)}
                                className={cn(
                                    "h-8 gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
                                    showRunningTrades
                                        ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/15"
                                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                                )}
                            >
                                {showRunningTrades ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                Trades
                            </Button>

                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setShowWhaleRetailPressure(!showWhaleRetailPressure)}
                                className={cn(
                                    "h-8 gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
                                    showWhaleRetailPressure
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15"
                                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                                )}
                            >
                                {showWhaleRetailPressure ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                W/R
                            </Button>

                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setShow15mPressure(!show15mPressure)}
                                className={cn(
                                    "h-8 gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
                                    show15mPressure
                                        ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300 dark:hover:bg-orange-500/15"
                                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                                )}
                            >
                                {show15mPressure ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                15m
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Desktop Header - single line */}
                <div className="hidden items-center gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex 2xl:gap-3">
                    <div className="flex min-w-0 shrink-0 items-center gap-3 pr-1">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 shadow-inner shadow-blue-200/60 dark:bg-blue-500/10 dark:shadow-none">
                            <Zap className="h-4 w-4 fill-blue-500 text-blue-500 dark:fill-blue-400 dark:text-blue-400" />
                        </div>
                        <h1 className="whitespace-nowrap text-sm font-bold text-slate-900 dark:text-white xl:text-[15px]">
                            Net Pressure Pro Monitor
                        </h1>
                    </div>

                    <div className="h-6 w-px shrink-0 bg-slate-200 dark:bg-white/10" />

                    <div className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 dark:border-white/10 dark:bg-white/5">
                        <div className={cn("h-2 w-2 rounded-full", statusDotClass)} />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                            {status}
                        </span>
                    </div>

                    <div className="flex w-[94px] shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 font-mono text-sm font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                        {duration}
                    </div>

                    <div className="hidden shrink-0 items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-1.5 font-mono text-[10px] text-slate-600 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-400 xl:flex">
                        <span>ing {perfStats.ingestMs.toFixed(1)}ms</span>
                        <span>ui {perfStats.uiMs.toFixed(1)}ms</span>
                        <span>b {perfStats.batchSize}</span>
                        <span>t {perfStats.parsedTrades}</span>
                        <span>q {perfStats.bufferDepth}</span>
                    </div>

                    <div className="flex shrink-0 items-center rounded-xl border border-slate-200/80 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-white/5">
                        <button
                            disabled={isPlaying}
                            onClick={() => setShowValue(false)}
                            className={cn(
                                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                                !showValue
                                    ? "bg-white text-slate-900 shadow-sm dark:bg-[#1e293b] dark:text-white"
                                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                                isPlaying && "cursor-not-allowed opacity-50"
                            )}
                        >
                            Lot
                        </button>
                        <button
                            disabled={isPlaying}
                            onClick={() => setShowValue(true)}
                            className={cn(
                                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                                showValue
                                    ? "bg-white text-slate-900 shadow-sm dark:bg-[#1e293b] dark:text-white"
                                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                                isPlaying && "cursor-not-allowed opacity-50"
                            )}
                        >
                            Value
                        </button>
                    </div>

                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowRunningTrades(!showRunningTrades)}
                        className={cn(
                            "h-8 shrink-0 gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
                            showRunningTrades
                                ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/15"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                        )}
                    >
                        {showRunningTrades ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        Trades
                    </Button>

                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowWhaleRetailPressure(!showWhaleRetailPressure)}
                        className={cn(
                            "h-8 shrink-0 gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
                            showWhaleRetailPressure
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                        )}
                    >
                        {showWhaleRetailPressure ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        W/R
                    </Button>

                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShow15mPressure(!show15mPressure)}
                        className={cn(
                            "h-8 shrink-0 gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
                            show15mPressure
                                ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300 dark:hover:bg-orange-500/15"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                        )}
                    >
                        {show15mPressure ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        15m
                    </Button>

                    <div className="ml-auto shrink-0" />

                    <Button
                        size="sm"
                        onClick={handlePlayToggle}
                        className={cn(
                            "h-9 min-w-[110px] shrink-0 rounded-xl text-xs font-semibold shadow-md transition-all",
                            isPlaying
                                ? "border border-red-200 bg-white text-red-500 hover:bg-red-50 dark:border-red-500/25 dark:bg-[#1e293b] dark:text-red-400 dark:hover:bg-red-500/10"
                                : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                        )}
                    >
                        {isPlaying ? (
                            <><Pause className="mr-1 h-3.5 w-3.5" /> Stop</>
                        ) : (
                            <><Play className="mr-1 h-3.5 w-3.5" /> Start</>
                        )}
                    </Button>
                </div>
            </div>

            <div className="flex-1 min-h-0 p-3 md:p-4">
                <div className="flex h-full min-h-0 flex-col gap-3 xl:flex-row xl:gap-4">
                    {showRunningTrades && (
                        <Card className="flex h-[250px] w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 py-0 shadow-sm dark:border-white/10 dark:bg-[#1a2236] sm:h-[300px] xl:h-full xl:w-[360px] 2xl:w-[380px]">
                            <div className="flex h-12 items-center justify-between border-b border-slate-100 px-4 dark:border-white/10">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                                        Live Trades
                                    </span>
                                </div>
                                <div className="relative">
                                    <Filter className="absolute left-2 top-1.5 h-3 w-3 text-slate-400 dark:text-slate-500" />
                                    <input
                                        value={filter}
                                        onChange={(e) => setFilter(e.target.value)}
                                        placeholder="Filter symbol"
                                        className="h-7 w-28 rounded-lg border border-slate-200 bg-slate-50 pl-6 text-[10px] text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-[#0f172a] dark:text-white dark:placeholder-slate-500 dark:focus:border-blue-400 md:w-32"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 border-b border-slate-100 text-[9px] font-bold uppercase tracking-[0.12em] dark:border-white/10">
                                <div className="px-3 py-1.5 text-emerald-600 dark:text-emerald-400">Buy Flow</div>
                                <div className="border-l border-slate-100 px-3 py-1.5 text-red-500 dark:border-white/10 dark:text-red-400">
                                    Sell Flow
                                </div>
                            </div>
                            <div className="flex min-h-0 flex-1 overflow-hidden divide-x divide-slate-100 dark:divide-white/5">
                                <div className="flex min-w-0 flex-1 flex-col bg-emerald-50/20 dark:bg-emerald-500/5">
                                    <ScrollArea className="min-h-0 flex-1">
                                        <div className="divide-y divide-slate-100/70 dark:divide-white/5">
                                            {displayedTrades.buys.map((t, i) => (
                                                <div key={i} className="flex items-center justify-between px-3 py-1.5 text-[10px] transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
                                                    <a
                                                        href={`https://stockbit.com/symbol/${t.symbol}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="w-12 font-bold text-slate-900 hover:text-blue-600 hover:underline dark:text-slate-200 dark:hover:text-blue-400"
                                                    >
                                                        {t.symbol}
                                                    </a>
                                                    <span className="font-mono text-slate-500 dark:text-slate-400">{t.price}</span>
                                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatVolume(t.volume)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                                <div className="flex min-w-0 flex-1 flex-col bg-red-50/20 dark:bg-red-500/5">
                                    <ScrollArea className="min-h-0 flex-1">
                                        <div className="divide-y divide-slate-100/70 dark:divide-white/5">
                                            {displayedTrades.sells.map((t, i) => (
                                                <div key={i} className="flex items-center justify-between px-3 py-1.5 text-[10px] transition-colors hover:bg-red-50 dark:hover:bg-red-500/10">
                                                    <a
                                                        href={`https://stockbit.com/symbol/${t.symbol}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="w-12 font-bold text-slate-900 hover:text-blue-600 hover:underline dark:text-slate-200 dark:hover:text-blue-400"
                                                    >
                                                        {t.symbol}
                                                    </a>
                                                    <span className="font-mono text-slate-500 dark:text-slate-400">{t.price}</span>
                                                    <span className="font-mono font-bold text-red-500 dark:text-red-400">{formatVolume(t.volume)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>
                        </Card>
                    )}

                    <div className={cn("grid min-h-0 min-w-0 flex-1 auto-rows-[minmax(295px,1fr)] gap-3 overflow-y-auto pb-24 pr-1 md:auto-rows-fr md:gap-4 md:overflow-hidden md:pb-0 md:pr-0", rankingGridClass)}>
                        <RankingTable title="1 Minute" data={stats1m} icon={icon1m} color="blue" linerMap={linerMap} previousCloseMap={previousCloseMap} showFlowColumns={showWhaleRetailPressure} showValue={showValue} />
                        <RankingTable title="5 Minutes" data={stats5m} icon={icon5m} color="violet" linerMap={linerMap} previousCloseMap={previousCloseMap} showFlowColumns={showWhaleRetailPressure} showValue={showValue} />
                        {show15mPressure && (
                            <RankingTable title="15 Minutes" data={stats15m} icon={icon15m} color="orange" linerMap={linerMap} previousCloseMap={previousCloseMap} showValue={showValue} />
                        )}
                        <RankingTable title="Session" data={statsSession} icon={iconSession} color="emerald" linerMap={linerMap} previousCloseMap={previousCloseMap} showDuration={true} showFlowColumns={showWhaleRetailPressure} symbolColors={symbolColors} showValue={showValue} />
                    </div>
                </div>
            </div>
        </div>
    );
}

const WhaleVsRetailNetBar = memo(function WhaleVsRetailNetBar({
    whaleBuyValue,
    whaleSellValue,
    retailBuyValue,
    retailSellValue,
    whaleBuyLot,
    whaleSellLot,
    retailBuyLot,
    retailSellLot,
    showValue,
}: {
    whaleBuyValue: number;
    whaleSellValue: number;
    retailBuyValue: number;
    retailSellValue: number;
    whaleBuyLot: number;
    whaleSellLot: number;
    retailBuyLot: number;
    retailSellLot: number;
    showValue: boolean;
}) {
    const whaleNetBuy = Math.max(
        0,
        showValue ? (whaleBuyValue - whaleSellValue) : (whaleBuyLot - whaleSellLot)
    );
    const retailNetBuy = Math.max(
        0,
        showValue ? (retailBuyValue - retailSellValue) : (retailBuyLot - retailSellLot)
    );
    const totalNetBuy = whaleNetBuy + retailNetBuy;
    const whalePct = totalNetBuy > 0 ? (whaleNetBuy / totalNetBuy) * 100 : 0;
    const retailPct = totalNetBuy > 0 ? (retailNetBuy / totalNetBuy) * 100 : 0;
    const whaleLabel = showValue ? formatValue(whaleNetBuy) : formatVolume(whaleNetBuy);
    const retailLabel = showValue ? formatValue(retailNetBuy) : formatVolume(retailNetBuy);

    return (
        <div className="w-full min-w-0">
            <div className="flex items-center gap-1.5">
                <span className="w-[54px] text-right text-[8px] font-mono text-emerald-600 dark:text-emerald-400">
                    {whaleLabel}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-[#0f172a] flex">
                    <div
                        className="h-full bg-emerald-500/90 dark:bg-emerald-400/90 transition-all duration-300"
                        style={{ width: `${whalePct}%` }}
                    />
                    <div
                        className="h-full bg-red-500/90 dark:bg-red-400/90 transition-all duration-300"
                        style={{ width: `${retailPct}%` }}
                    />
                </div>
                <span className="w-[54px] text-[8px] font-mono text-red-500 dark:text-red-400">
                    {retailLabel}
                </span>
            </div>
        </div>
    );
});

const RankingTable = memo(function RankingTable({
    title,
    data,
    icon,
    color,
    showDuration = false,
    showFlowColumns = false,
    linerMap = {},
    previousCloseMap = {},
    symbolColors = {},
    showValue = false,
}: {
    title: string;
    data: RankingStats[];
    icon: React.ReactNode;
    color: string;
    showDuration?: boolean;
    showFlowColumns?: boolean;
    linerMap?: Record<string, LinerKey>;
    previousCloseMap?: Record<string, number>;
    symbolColors?: Record<string, string>;
    showValue?: boolean;
}) {
    const headerColor = {
        blue: "text-blue-600 dark:text-blue-400",
        violet: "text-violet-600 dark:text-violet-400",
        orange: "text-orange-600 dark:text-orange-400",
        emerald: "text-emerald-600 dark:text-emerald-400",
    }[color] ?? "text-gray-700 dark:text-gray-300";

    const gridClass = showFlowColumns
        ? (showDuration ? "grid-cols-[repeat(19,minmax(0,1fr))]" : "grid-cols-[repeat(17,minmax(0,1fr))]")
        : "grid-cols-[repeat(14,minmax(0,1fr))]";
    const netColClass = showFlowColumns ? "col-span-2" : "col-span-2";
    const pressureColClass = showFlowColumns ? "col-span-3" : (showDuration ? "col-span-3" : "col-span-5");
    const priceColClass = "col-span-1";
    const changeColClass = "col-span-1";
    const topBuyColClass = "col-span-2";
    const flowColClass = "col-span-5";

    return (
        <Card className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 py-0 shadow-sm dark:border-white/10 dark:bg-[#1a2236]">
            <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-slate-100 bg-white/90 px-4 dark:border-white/10 dark:bg-[#1a2236]">
                <div className="flex items-center gap-2 overflow-hidden">
                    {icon}
                    <span className={cn("font-bold text-xs uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis", headerColor)}>{title} Pressure</span>
                </div>
            </div>

            <div className={cn("grid border-b border-slate-100 bg-slate-50 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:border-white/10 dark:bg-[#1e293b] dark:text-slate-500", gridClass)}>
                <div className="col-span-3">Sym</div>
                {showDuration && <div className="col-span-2 text-right">Time</div>}
                <div className={cn(priceColClass, "text-right")}>Price</div>
                <div className={cn(changeColClass, "text-right")}>Chg%</div>
                <div className={cn(topBuyColClass, "text-right")}>Top Buy</div>
                <div className={cn(netColClass, "text-right")}>{showValue ? "NetVal" : "NetVol"}</div>
                <div className={cn(pressureColClass, "pl-2")}>Pressure %</div>
                {showFlowColumns && (
                    <div className={cn(flowColClass, "pl-2 text-center")}>Whales / Retail</div>
                )}
            </div>

            <ScrollArea className="min-h-0 flex-1">
                <div className="divide-y divide-slate-100/80 dark:divide-white/[0.03]">
                    {data.map((row) => {
                        const linerBadge = getLinerBadge(row.symbol, linerMap);
                        const prevClose = previousCloseMap[normalizeSymbolKey(row.symbol)];
                        const priceChangePct =
                            prevClose && prevClose > 0 && row.lastPrice > 0
                                ? ((row.lastPrice - prevClose) / prevClose) * 100
                                : null;
                        return (
                            <div key={row.symbol} className={cn(
                                "grid px-3 py-2 text-[10px] items-center group transition-colors",
                                gridClass,
                                symbolColors[row.symbol] || "hover:bg-slate-50 dark:hover:bg-white/5"
                            )}>
                                <div className="col-span-3 font-bold text-gray-900 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-1">
                                    <span className={cn("inline-block min-w-[10px] text-[9px] font-black leading-none", linerBadge.className)}>
                                        {linerBadge.digit}
                                    </span>
                                    <a
                                        href={`https://stockbit.com/symbol/${row.symbol}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline"
                                    >
                                        {row.symbol}
                                    </a>
                                </div>
                                {showDuration && (
                                    <div className="col-span-2 text-right font-mono text-gray-500 dark:text-gray-400 text-[9px]">
                                        {row.duration}
                                    </div>
                                )}
                                <div className={cn(priceColClass, "text-right font-mono text-gray-500 dark:text-gray-300")}>
                                    {formatPrice(row.lastPrice)}
                                </div>
                                <div className={cn(
                                    changeColClass,
                                    "text-right font-mono font-semibold",
                                    priceChangePct === null
                                        ? "text-gray-400 dark:text-gray-500"
                                        : priceChangePct > 0
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : priceChangePct < 0
                                                ? "text-red-500 dark:text-red-400"
                                                : "text-gray-500 dark:text-gray-400"
                                )}>
                                    {formatPct(priceChangePct)}
                                </div>
                                <div className={cn(topBuyColClass, "text-right font-mono text-[9px] text-gray-500 dark:text-gray-300")}>
                                    {row.topBuyPrice > 0 && row.topBuyLots > 0
                                        ? `${formatPrice(row.topBuyPrice)}/${formatVolume(row.topBuyLots)}`
                                        : "-"}
                                </div>
                                <div className={cn(
                                    netColClass,
                                    "text-right font-mono font-medium",
                                    showValue
                                        ? (row.netValue > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")
                                        : (row.netVolume > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")
                                )}>
                                    {showValue ? formatValue(row.netValue) : formatVolume(row.netVolume)}
                                </div>
                                <div className={cn(pressureColClass, "pl-2 flex items-center gap-2")}>
                                    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-[#0f172a] rounded-full overflow-hidden relative">
                                        <div className="absolute inset-0 w-full bg-red-100 dark:bg-red-900/40" />
                                        <div
                                            className="h-full bg-emerald-500 dark:bg-emerald-400 relative z-10 rounded-full transition-all duration-300"
                                            style={{ width: `${row.buyPressure}%` }}
                                        />
                                    </div>
                                    <span className="text-[9px] font-mono text-gray-500 dark:text-gray-400 w-5 text-right">{row.buyPressure.toFixed(0)}</span>
                                </div>
                                {showFlowColumns && (
                                    <div className={cn(flowColClass, "pl-2")}>
                                        <WhaleVsRetailNetBar
                                            whaleBuyValue={row.whaleBuyValue}
                                            whaleSellValue={row.whaleSellValue}
                                            retailBuyValue={row.retailBuyValue}
                                            retailSellValue={row.retailSellValue}
                                            whaleBuyLot={row.whaleBuyLot}
                                            whaleSellLot={row.whaleSellLot}
                                            retailBuyLot={row.retailBuyLot}
                                            retailSellLot={row.retailSellLot}
                                            showValue={showValue}
                                        />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                    {data.length === 0 && (
                        <div className="p-8 text-center text-gray-300 dark:text-gray-600 text-[10px] italic">
                            No data
                        </div>
                    )}
                </div>
            </ScrollArea>
        </Card>
    );
});
