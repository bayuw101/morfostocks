"use client";

import { useState, useEffect, use, useCallback, useMemo } from "react";
import { TechnicalChart } from "@/components/analysis/technical-chart";
import { BrokerStudyPanel } from "@/components/analysis/broker-study";
import { Loader2, AlertCircle, ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import Link from "next/link";
import { Toggle } from "@/components/ui/toggle";
import { FundamentalScores } from "@/types/fundamental";

export default function TechnicalDetailPageClient({ params }: { params: Promise<{ symbol: string }> }) {
    const { symbol } = use(params);

    const [chartData, setChartData] = useState<any[]>([]);
    const [brokerData, setBrokerData] = useState<any[]>([]);
    const [fundamentalScores, setFundamentalScores] = useState<FundamentalScores | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeframe, setTimeframe] = useState<string>("150");
    const [showRSI, setShowRSI] = useState(false);
    const [showMACD, setShowMACD] = useState(false);
    const [showEMA, setShowEMA] = useState(false);
    const [selectedBroker, setSelectedBroker] = useState<string | null>(null);
    const [showForeignOnly, setShowForeignOnly] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (symbol) {
            setLoading(true);
            setError(null);
            fetch(`/api/analysis/technical/${symbol}`)
                .then(res => res.json())
                .then(json => {
                    if (json.error) throw new Error(json.error);
                    setChartData(json.data || []);
                    setBrokerData(json.brokers || []);
                    setFundamentalScores(json.fundamental_scores || null);
                })
                .catch(err => setError(err.message))
                .finally(() => setLoading(false));
        }
    }, [symbol]);

    // Fullscreen + landscape lock for mobile
    const enterFullscreen = useCallback(async () => {
        try {
            const el = document.documentElement;
            if (el.requestFullscreen) await el.requestFullscreen();
            try { await (screen.orientation as any).lock("landscape"); } catch { }
            setIsFullscreen(true);
        } catch { }
    }, []);

    const exitFullscreen = useCallback(async () => {
        try {
            if (document.exitFullscreen) await document.exitFullscreen();
            try { (screen.orientation as any).unlock(); } catch { }
            setIsFullscreen(false);
        } catch { }
    }, []);

    useEffect(() => {
        const handler = () => {
            if (!document.fullscreenElement) {
                setIsFullscreen(false);
                try { (screen.orientation as any).unlock(); } catch { }
            }
        };
        document.addEventListener("fullscreenchange", handler);
        return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

    const timeframes = ["5", "20", "40", "60", "80", "100", "150", "200"];
    const latestData = chartData.length > 0 ? chartData[chartData.length - 1] : null;
    const priceDiff = latestData ? ((latestData.close - latestData.open) / latestData.open * 100) : 0;
    const priceUp = latestData ? latestData.close >= latestData.open : true;

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:flex lg:flex-col">

                {/* ── HEADER ─────────────────────────────────────── */}
                <div className="shrink-0 px-2 sm:px-4 pt-2 sm:pt-3">

                    {/* Row 1: Back · Symbol · price · fullscreen */}
                    <div className="flex items-center gap-2 mb-1.5">
                        <Link
                            href="/analysis/technical"
                            className="w-8 h-8 bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 border border-gray-200 dark:border-white/10 rounded-lg flex items-center justify-center transition-colors shadow-sm shrink-0"
                        >
                            <ArrowLeft className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        </Link>

                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight shrink-0">
                                {decodeURIComponent(symbol)}
                            </h1>
                            {latestData && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-sm sm:text-lg font-mono text-gray-500 dark:text-gray-400 shrink-0">
                                        {latestData.close.toLocaleString()}
                                    </span>
                                    <span className={`text-[10px] sm:text-[11px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${priceUp
                                        ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                        : "bg-red-50 dark:bg-red-500/20 text-red-500 dark:text-red-400"
                                        }`}>
                                        {priceDiff >= 0 ? "+" : ""}{priceDiff.toFixed(2)}%
                                    </span>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={isFullscreen ? exitFullscreen : enterFullscreen}
                            className="lg:hidden w-8 h-8 bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 border border-gray-200 dark:border-white/10 rounded-lg flex items-center justify-center transition-colors shadow-sm shrink-0"
                            title={isFullscreen ? "Exit fullscreen" : "Fullscreen landscape"}
                        >
                            {isFullscreen
                                ? <Minimize2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                : <Maximize2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            }
                        </button>

                        {/* Desktop: toggles + timeframes — right of title row */}
                        <div className="hidden lg:flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1">
                                <Toggle pressed={showRSI} onPressedChange={setShowRSI} variant="outline" size="sm" intent="primary">RSI</Toggle>
                                <Toggle pressed={showMACD} onPressedChange={setShowMACD} variant="outline" size="sm" intent="primary">MACD</Toggle>
                                <Toggle pressed={showEMA} onPressedChange={setShowEMA} variant="outline" size="sm" intent="primary">EMA</Toggle>
                            </div>
                            <div className="w-px h-5 bg-gray-200 dark:bg-white/10" />
                            <div className="flex items-center bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden shadow-sm">
                                {timeframes.map(tf => (
                                    <button key={tf} onClick={() => setTimeframe(tf)} className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors ${timeframe === tf ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"}`}>{tf}</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Row 2 (mobile): RSI / MACD / EMA toggles */}
                    <div className="flex items-center gap-1.5 pb-1 lg:hidden">
                        <Toggle pressed={showRSI} onPressedChange={setShowRSI} variant="outline" size="sm" intent="primary" className="h-7 px-2.5 text-[11px]">RSI</Toggle>
                        <Toggle pressed={showMACD} onPressedChange={setShowMACD} variant="outline" size="sm" intent="primary" className="h-7 px-2.5 text-[11px]">MACD</Toggle>
                        <Toggle pressed={showEMA} onPressedChange={setShowEMA} variant="outline" size="sm" intent="primary" className="h-7 px-2.5 text-[11px]">EMA</Toggle>
                    </div>

                    {/* Row 3 (mobile only): Timeframe — full width pill strip */}
                    <div className="flex lg:hidden bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden shadow-sm mb-1.5">
                        {timeframes.map(tf => (
                            <button
                                key={tf}
                                onClick={() => setTimeframe(tf)}
                                className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${timeframe === tf
                                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
                                    }`}
                            >
                                {tf}
                            </button>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="mx-2 sm:mx-4 mt-1 p-2.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-2 text-xs border border-red-100 dark:border-red-500/20 shrink-0">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {error}
                    </div>
                )}

                {/* ── MAIN CONTENT ───────────────────────────────── */}
                <div className="flex-1 min-h-0 flex flex-col lg:flex-row lg:gap-2 lg:px-4 lg:pt-2 pb-2 pt-1">

                    {/* CHART */}
                    <div className="flex-1 flex flex-col min-w-0 min-h-[45vh] lg:min-h-0">
                        {/* Mobile: compact, cardless, zero-padding, edge-to-edge */}
                        <div className="block lg:hidden flex-1">
                            {loading ? (
                                <div className="flex justify-center items-center min-h-[200px]">
                                    <Loader2 className="h-8 w-8 animate-spin text-gray-300 dark:text-gray-600" />
                                </div>
                            ) : (
                                <TechnicalChart
                                    data={chartData}
                                    symbol={symbol}
                                    brokers={brokerData}
                                    timeframe={timeframe}
                                    mainChartHeight={isFullscreen ? "h-[calc(100vh-140px)]" : "h-[48vh]"}
                                    showRSI={showRSI}
                                    showMACD={showMACD}
                                    showEMA={showEMA}
                                    selectedBroker={selectedBroker}
                                    showForeignOnly={showForeignOnly}
                                    compact={true}
                                />
                            )}
                        </div>

                        {/* Desktop: card wrapper */}
                        <div className="hidden lg:flex flex-col flex-1 bg-white dark:bg-white/[0.03] rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-white/10">
                            <div className="flex-1 p-0 overflow-y-auto">
                                {loading ? (
                                    <div className="flex justify-center items-center h-full min-h-[200px]">
                                        <Loader2 className="h-8 w-8 animate-spin text-gray-300 dark:text-gray-600" />
                                    </div>
                                ) : (
                                    <TechnicalChart
                                        data={chartData}
                                        symbol={symbol}
                                        brokers={brokerData}
                                        timeframe={timeframe}
                                        mainChartHeight="h-[55vh]"
                                        showRSI={showRSI}
                                        showMACD={showMACD}
                                        showEMA={showEMA}
                                        selectedBroker={selectedBroker}
                                        showForeignOnly={showForeignOnly}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* BROKER PANEL */}
                    <div className="lg:w-[200px] lg:min-w-[200px] flex flex-col px-2 lg:px-0">
                        <div className="block lg:hidden">
                            <MobileBrokerStrip
                                brokers={brokerData}
                                selectedBroker={selectedBroker}
                                onSelectBroker={setSelectedBroker}
                                showForeignOnly={showForeignOnly}
                                onForeignOnlyChange={setShowForeignOnly}
                            />
                        </div>
                        <div className="hidden lg:flex lg:flex-col lg:h-full">
                            <BrokerStudyPanel
                                brokers={brokerData}
                                selectedBroker={selectedBroker}
                                onSelectBroker={setSelectedBroker}
                                showForeignOnly={showForeignOnly}
                                onForeignOnlyChange={setShowForeignOnly}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── FUNDAMENTAL SCORES ─────────────────────────── */}
            {fundamentalScores && (
                <div className="shrink-0 px-2 sm:px-4 pb-2 pt-1.5 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-sm border-t border-gray-100 dark:border-white/5">
                    <div className="grid grid-cols-3 lg:grid-cols-6 gap-1.5">
                        {(["undervalued", "growth", "profitability", "valuation", "solvency", "efficiency"] as const).map(key => {
                            const item = fundamentalScores[key];
                            const colors = {
                                green: { border: "border-emerald-200 dark:border-emerald-500/30", bg: "bg-emerald-50/50 dark:bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
                                yellow: { border: "border-yellow-200 dark:border-yellow-500/30", bg: "bg-yellow-50/50 dark:bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400" },
                                red: { border: "border-red-200 dark:border-red-500/30", bg: "bg-red-50/50 dark:bg-red-500/10", text: "text-red-500 dark:text-red-400" },
                            }[item.color] || { border: "border-gray-200 dark:border-white/10", bg: "bg-gray-50 dark:bg-white/5", text: "text-gray-600 dark:text-gray-400" };

                            return (
                                <div key={key} className={`${colors.border} ${colors.bg} border rounded-lg flex items-center justify-between px-2 py-1.5 sm:px-2.5 sm:py-2 h-11 sm:h-[52px]`}>
                                    <div className="text-[9px] sm:text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide leading-tight mr-1" style={{ maxWidth: "55%" }}>
                                        {item.label}
                                    </div>
                                    <div className={`text-lg sm:text-xl font-bold leading-none ${colors.text} shrink-0`}>
                                        {item.score.toFixed(0)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════════
// MOBILE BROKER STRIP — 2 horizontal-scroll rows: BUY top, SELL bottom
// ═══════════════════════════════════════════════════════════════════

import { parseISO, format } from "date-fns";
import { isForeignBroker } from "@/lib/foreign-brokers";
import { getBrokerType } from "@/lib/broker-types";
import { DatePicker } from "@/components/ui/date-picker";

interface BrokerHistoryItem {
    date: string;
    brokers: Record<string, number>;
}

function BrokerChip({
    code,
    val,
    maxVal,
    isSelected,
    onClick,
    side,
}: {
    code: string;
    val: number;
    maxVal: number;
    isSelected: boolean;
    onClick: () => void;
    side: "buy" | "sell";
}) {
    const type = getBrokerType(code);
    const barW = (Math.abs(val) / maxVal) * 100;

    const formatVal = (v: number) => {
        const a = Math.abs(v);
        if (a >= 1_000_000_000) return (a / 1_000_000_000).toFixed(1) + "B";
        if (a >= 1_000_000) return (a / 1_000_000).toFixed(0) + "M";
        return (a / 1000).toFixed(0) + "K";
    };

    const selectedBg = side === "buy" ? "bg-emerald-600" : "bg-rose-600";
    const hoverBg = side === "buy" ? "hover:bg-emerald-50 dark:hover:bg-emerald-500/10" : "hover:bg-rose-50 dark:hover:bg-rose-500/10";
    const barColor = side === "buy" ? "bg-emerald-300/50 dark:bg-emerald-500/25" : "bg-rose-300/50 dark:bg-rose-500/25";
    const valColor = side === "buy" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
    const codeColor = type === "FOREIGN" ? "text-red-500 dark:text-red-400"
        : type === "INSIDER" ? "text-blue-500 dark:text-blue-400"
            : "text-gray-800 dark:text-gray-200";

    return (
        <button
            onClick={onClick}
            className={`relative flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] transition-all overflow-hidden shrink-0 border ${isSelected
                ? `${selectedBg} text-white border-transparent shadow-sm`
                : `bg-white dark:bg-white/5 border-gray-100 dark:border-white/10 ${hoverBg}`
                }`}
        >
            {!isSelected && (
                <div className={`absolute bottom-0 left-0 h-[3px] ${barColor} rounded-full`} style={{ width: `${barW}%` }} />
            )}
            <span className={`font-bold relative z-10 ${isSelected ? "text-white" : codeColor}`}>{code}</span>
            <span className={`font-mono text-[9px] relative z-10 ${isSelected ? "text-white/80" : valColor}`}>
                {formatVal(val)}
            </span>
        </button>
    );
}

function MobileBrokerStrip({
    brokers,
    selectedBroker,
    onSelectBroker,
    showForeignOnly,
    onForeignOnlyChange,
}: {
    brokers: BrokerHistoryItem[];
    selectedBroker: string | null;
    onSelectBroker: (b: string | null) => void;
    showForeignOnly: boolean;
    onForeignOnlyChange: (v: boolean) => void;
}) {
    const latestDate = useMemo(() => {
        if (!brokers || brokers.length === 0) return null;
        const dates = brokers.map(b => b.date).sort();
        return parseISO(dates[dates.length - 1]);
    }, [brokers]);

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    useEffect(() => {
        if (latestDate) setSelectedDate(latestDate);
    }, [latestDate]);

    const dailyData = useMemo(() => {
        if (!brokers || !selectedDate) return null;
        const targetStr = format(selectedDate, "yyyy-MM-dd");
        return brokers.find(b => b.date === targetStr);
    }, [brokers, selectedDate]);

    const { buyers, sellers, maxVal } = useMemo(() => {
        if (!dailyData) return { buyers: [], sellers: [], maxVal: 1 };
        const all = Object.entries(dailyData.brokers)
            .filter(([code]) => code !== "total_net")
            .filter(([code]) => !showForeignOnly || isForeignBroker(code))
            .map(([code, val]) => ({ code, val }));

        const b = all.filter(x => x.val > 0).sort((a, b) => b.val - a.val);
        const s = all.filter(x => x.val < 0).sort((a, b) => a.val - b.val);
        return {
            buyers: b,
            sellers: s,
            maxVal: Math.max(...b.map(x => x.val), ...s.map(x => Math.abs(x.val)), 1),
        };
    }, [dailyData, showForeignOnly]);

    const buyTotal = buyers.reduce((a, c) => a + c.val, 0);
    const sellTotal = Math.abs(sellers.reduce((a, c) => a + c.val, 0));
    const totalPower = buyTotal + sellTotal || 1;
    const buyPct = (buyTotal / totalPower) * 100;
    const sellPct = 100 - buyPct;

    const formatVal = (v: number) => {
        const a = Math.abs(v);
        if (a >= 1_000_000_000) return (a / 1_000_000_000).toFixed(1) + "B";
        if (a >= 1_000_000) return (a / 1_000_000).toFixed(0) + "M";
        return (a / 1000).toFixed(0) + "K";
    };

    return (
        <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-white/10 bg-white dark:bg-white/[0.03] shadow-sm">

            {/* ── Control bar ─────────────────────────────── */}
            <div className="flex items-center gap-2 px-2.5 py-2 border-b border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.02]">
                <div className="flex-1 min-w-0">
                    <DatePicker
                        date={selectedDate}
                        setDate={setSelectedDate}
                        showNavigation={true}
                        maxDate={latestDate ?? undefined}
                        minDate={new Date("2000-01-01")}
                        className="w-full"
                        compact={true}
                    />
                </div>

                {/* Buy/sell pressure bar */}
                <div className="flex h-6 w-32 rounded-full overflow-hidden shrink-0 border border-gray-200 dark:border-white/10">
                    <div className="bg-emerald-500/20 dark:bg-emerald-500/30 flex items-center justify-center transition-all" style={{ width: `${buyPct}%` }}>
                        {buyPct >= 25 && <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap px-0.5">{formatVal(buyTotal)}</span>}
                    </div>
                    <div className="bg-rose-500/20 dark:bg-rose-500/30 flex items-center justify-center flex-1 transition-all">
                        {sellPct >= 25 && <span className="text-[9px] font-bold text-rose-700 dark:text-rose-300 whitespace-nowrap px-0.5">{formatVal(sellTotal)}</span>}
                    </div>
                </div>

                {/* Foreign toggle */}
                <button
                    onClick={() => onForeignOnlyChange(!showForeignOnly)}
                    className={`text-[9px] font-bold w-7 h-7 rounded-lg border transition-colors shrink-0 flex items-center justify-center ${showForeignOnly
                        ? "bg-red-500 text-white border-red-500"
                        : "bg-white dark:bg-white/[0.08] text-gray-400 dark:text-gray-500 border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10"
                        }`}
                >F</button>
            </div>

            {!dailyData ? (
                <div className="py-4 text-center text-[11px] text-gray-400 dark:text-gray-500">No data</div>
            ) : (
                <div className="flex flex-col divide-y divide-gray-100 dark:divide-white/10">

                    {/* ── BUY row ─────────────────────────────── */}
                    <div>
                        <div className="flex items-center justify-between px-2.5 py-1 bg-emerald-50/60 dark:bg-emerald-500/5">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">BUY</span>
                                <span className="text-[8px] font-semibold text-emerald-500/60 dark:text-emerald-600/60">{buyers.length}</span>
                            </div>
                            <span className="text-[9px] font-mono font-semibold text-emerald-600/70 dark:text-emerald-400/70">{formatVal(buyTotal)}</span>
                        </div>
                        <div className="flex gap-1.5 px-2 py-2 overflow-x-auto scrollbar-none">
                            {buyers.length === 0
                                ? <span className="text-[10px] text-gray-400 dark:text-gray-500 italic py-0.5">—</span>
                                : buyers.map(b => (
                                    <BrokerChip
                                        key={b.code}
                                        code={b.code}
                                        val={b.val}
                                        maxVal={maxVal}
                                        isSelected={selectedBroker === b.code}
                                        onClick={() => onSelectBroker(selectedBroker === b.code ? null : b.code)}
                                        side="buy"
                                    />
                                ))
                            }
                        </div>
                    </div>

                    {/* ── SELL row ─────────────────────────────── */}
                    <div>
                        <div className="flex items-center justify-between px-2.5 py-1 bg-rose-50/60 dark:bg-rose-500/5">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">SELL</span>
                                <span className="text-[8px] font-semibold text-rose-500/60 dark:text-rose-600/60">{sellers.length}</span>
                            </div>
                            <span className="text-[9px] font-mono font-semibold text-rose-600/70 dark:text-rose-400/70">{formatVal(sellTotal)}</span>
                        </div>
                        <div className="flex gap-1.5 px-2 py-2 overflow-x-auto scrollbar-none">
                            {sellers.length === 0
                                ? <span className="text-[10px] text-gray-400 dark:text-gray-500 italic py-0.5">—</span>
                                : sellers.map(s => (
                                    <BrokerChip
                                        key={s.code}
                                        code={s.code}
                                        val={s.val}
                                        maxVal={maxVal}
                                        isSelected={selectedBroker === s.code}
                                        onClick={() => onSelectBroker(selectedBroker === s.code ? null : s.code)}
                                        side="sell"
                                    />
                                ))
                            }
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
