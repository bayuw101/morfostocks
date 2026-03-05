"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { TrendingUp, RefreshCcw, HardDrive, Globe, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import localforage from "localforage";
import { getStocksAction } from "@/lib/actions/reference-actions";
import { getTopValuedSymbolsAction, getExistingBidOfferSymbolsAction } from "@/lib/actions/tier-flow-actions";

type TargetMode = "top_200" | "existing" | "all" | "custom";

const TARGET_MODES: { value: TargetMode; label: string; description: string; icon: React.ElementType }[] = [
    { value: "top_200", label: "Top 200", description: "Highest traded value", icon: TrendingUp },
    { value: "existing", label: "Existing", description: "Already in database", icon: HardDrive },
    { value: "all", label: "All Symbols", description: "Every listed emitent", icon: Globe },
    { value: "custom", label: "Custom", description: "Enter symbols manually", icon: Pencil },
];

export default function BidOfferCollector({ from, to }: { from: Date | null; to: Date | null }) {
    const [loading, setLoading] = useState(false);
    const [overallProgress, setOverallProgress] = useState({ current: 0, total: 0 });
    const [currentSymbolLabel, setCurrentSymbolLabel] = useState("");
    const [symbolProgressInfo, setSymbolProgressInfo] = useState({ active: false, tradeNumber: "", fetched: 0, maxTrades: 0 });
    const [targetType, setTargetType] = useState<TargetMode>("top_200");
    const [customInput, setCustomInput] = useState("");
    const [customTags, setCustomTags] = useState<string[]>([]);

    // Stats for completed run
    const [lastRunStats, setLastRunStats] = useState<{ total: number; errors: number } | null>(null);

    const addCustomTag = () => {
        const parts = customInput.split(",").map(s => s.trim().toUpperCase()).filter(s => s.length > 0 && !customTags.includes(s));
        if (parts.length > 0) {
            setCustomTags(prev => [...prev, ...parts]);
            setCustomInput("");
        }
    };

    const removeCustomTag = (tag: string) => {
        setCustomTags(prev => prev.filter(t => t !== tag));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addCustomTag();
        }
    };

    const handleSyncAll = async () => {
        if (!from || !to) {
            toast.error("Please select a date range first.");
            return;
        }

        setLoading(true);
        setLastRunStats(null);
        setCurrentSymbolLabel("Resolving target symbols...");
        setOverallProgress({ current: 0, total: 0 });
        setSymbolProgressInfo({ active: false, tradeNumber: "", fetched: 0, maxTrades: 0 });

        try {
            const store = localforage.createInstance({ name: "morfostocks", storeName: "credentials" });
            const token = await store.getItem<string>("stockbit_token");

            if (!token) {
                toast.error("API Token not found. Please set it in the Header key icon.");
                setLoading(false);
                return;
            }

            let symbolsToSync: string[] = [];
            const fromStr = format(from, "yyyy-MM-dd");
            const toStr = format(to, "yyyy-MM-dd");

            if (targetType === "top_200") {
                setCurrentSymbolLabel("Loading Top 200 liquid symbols...");
                const res = await getTopValuedSymbolsAction(200, fromStr, toStr);
                if (!res.ok) throw new Error(res.error || "Failed to load Top 200");
                symbolsToSync = res.data || [];
            } else if (targetType === "existing") {
                setCurrentSymbolLabel("Loading symbols already in BidOffer table...");
                const res = await getExistingBidOfferSymbolsAction();
                if (!res.ok) throw new Error(res.error || "Failed to load existing BidOffer symbols");
                symbolsToSync = res.data || [];
            } else if (targetType === "custom") {
                symbolsToSync = [...customTags];
                const pending = customInput.split(",").map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
                symbolsToSync.push(...pending.filter(s => !symbolsToSync.includes(s)));
                if (symbolsToSync.length === 0) {
                    toast.error("Please enter at least one valid symbol.");
                    setLoading(false);
                    return;
                }
            } else {
                setCurrentSymbolLabel("Loading all available symbols...");
                const stocksRes = await getStocksAction();
                if (!stocksRes.ok || !stocksRes.data) throw new Error(stocksRes.error || "Failed to load stocks");
                symbolsToSync = stocksRes.data.map((s: any) => s.symbol);
            }

            const total = symbolsToSync.length;
            if (total === 0) {
                toast.warning("No symbols found for the selected criteria.");
                setLoading(false);
                return;
            }

            setCurrentSymbolLabel("Starting SSE connection...");

            // Stream progress using Server-Sent Events from Next API Route
            const response = await fetch("/api/collectors/tier-flow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetSymbols: symbolsToSync,
                    token,
                    from: fromStr,
                    to: toStr
                }),
            });

            if (!response.ok || !response.body) {
                throw new Error(`Failed to start stream: HTTP ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let isDone = false;

            while (!isDone) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.type === "symbol_start") {
                                setOverallProgress({ current: data.current - 1, total: data.total });
                                setCurrentSymbolLabel(`Connecting to ${data.symbol}...`);
                                setSymbolProgressInfo({ active: true, tradeNumber: "", fetched: 0, maxTrades: 0 });
                            } else if (data.type === "page_progress") {
                                setCurrentSymbolLabel(`Fetching ${data.symbol} (${data.date})`);
                                setSymbolProgressInfo({ active: true, tradeNumber: data.tradeNumber, fetched: data.totalTradesFetched, maxTrades: data.maxTrades || 0 });
                            } else if (data.type === "parsing") {
                                setCurrentSymbolLabel(`Parsing & Formatting limits for ${data.symbol}...`);
                                setSymbolProgressInfo(prev => ({ ...prev, tradeNumber: "Processing..." }));
                            } else if (data.type === "error") {
                                console.error("SSE Error:", data.message);
                                if (data.isFatal) {
                                    throw new Error(data.message);
                                } else {
                                    toast.error(`Error on ${data.symbol}: ${data.message}`);
                                }
                            } else if (data.type === "done") {
                                setOverallProgress({ current: data.total, total: data.total });
                                setLastRunStats({ total: data.total, errors: data.errors });
                                setCurrentSymbolLabel("Completed.");
                                setSymbolProgressInfo({ active: false, tradeNumber: "", fetched: 0, maxTrades: 0 });
                                toast.success(`Successfully synced Tier Flow data for ${data.total} symbols.`);
                                isDone = true;
                            }
                        } catch (e) {
                            console.warn("Failed to parse SSE line", line);
                        }
                    }
                }
            }
        } catch (err: any) {
            setCurrentSymbolLabel(`Error: ${err.message}`);
            toast.error(`Sync error: ${err.message}`);
            setSymbolProgressInfo({ active: false, tradeNumber: "", fetched: 0, maxTrades: 0 });
        } finally {
            setLoading(false);
        }
    };

    const activeMode = TARGET_MODES.find(m => m.value === targetType)!;

    return (
        <div className="space-y-4">


            {/* Target Mode Selector */}
            <div className="space-y-3">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Target Symbols</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TARGET_MODES.map((mode) => {
                        const Icon = mode.icon;
                        return (
                            <button
                                key={mode.value}
                                onClick={() => setTargetType(mode.value)}
                                disabled={loading}
                                className={`
                                    relative flex flex-col items-start p-3 rounded-xl border transition-all duration-200 text-left
                                    ${targetType === mode.value
                                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-indigo-500/30"
                                        : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] hover:border-gray-300 dark:hover:border-white/20"
                                    }
                                    ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                                `}
                            >
                                <Icon className={`h-4 w-4 mb-1.5 ${targetType === mode.value ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500"}`} />
                                <span className={`text-sm font-semibold ${targetType === mode.value ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-200"}`}>
                                    {mode.label}
                                </span>
                                <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">{mode.description}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Custom Tags Input */}
            {targetType === "custom" && (
                <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value.toUpperCase())}
                            onKeyDown={handleKeyDown}
                            placeholder="Type symbol and press Enter (e.g. BBCA)"
                            disabled={loading}
                            className="flex-1 h-10 px-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a2236] text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                        />
                        <Button
                            onClick={addCustomTag}
                            disabled={loading || customInput.trim().length === 0}
                            size="sm"
                            variant="outline"
                            className="h-10 px-4"
                        >
                            Add
                        </Button>
                    </div>
                    {customTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {customTags.map(tag => (
                                <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 gap-1 pr-1.5 cursor-pointer text-xs"
                                    onClick={() => !loading && removeCustomTag(tag)}
                                >
                                    {tag}
                                    <X className="h-3 w-3" />
                                </Badge>
                            ))}
                            <button
                                onClick={() => setCustomTags([])}
                                className="text-[10px] text-gray-400 hover:text-red-500 transition-colors ml-1 self-center"
                                disabled={loading}
                            >
                                Clear all
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Action Row */}
            <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                        Target: <span className="font-semibold text-gray-700 dark:text-gray-300">{activeMode.label}</span>
                        {targetType === "custom" && customTags.length > 0 && (
                            <span className="text-indigo-600 dark:text-indigo-400 ml-1">({customTags.length} symbols)</span>
                        )}
                    </span>
                </div>
                <Button
                    onClick={handleSyncAll}
                    disabled={loading || !from || !to || (targetType === "custom" && customTags.length === 0 && customInput.trim().length === 0)}
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                    <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? "Syncing..." : "Collect All"}
                </Button>
            </div>

            {/* Progress UI */}
            {(loading || overallProgress.total > 0) && (
                <div className="space-y-4 mt-2 bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/10">

                    {/* Overall Symbols Progress */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium text-gray-700 dark:text-gray-300">
                            <span className="flex items-center gap-2">
                                {loading && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span></span>}
                                Overall Progress
                            </span>
                            <span>{overallProgress.current} / {overallProgress.total}</span>
                        </div>
                        <Progress
                            value={overallProgress.total > 0 ? (overallProgress.current / overallProgress.total) * 100 : 0}
                            className="h-2 bg-gray-200 dark:bg-gray-800 [&>div]:bg-indigo-600"
                        />
                    </div>

                    {/* Per Emitent Sub-Progress */}
                    {symbolProgressInfo.active && (
                        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-white/10">
                            <div className="flex justify-between text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                <span className="text-gray-700 dark:text-gray-300 font-semibold">{currentSymbolLabel}</span>
                                <span>
                                    {symbolProgressInfo.tradeNumber
                                        ? `ID: ${symbolProgressInfo.tradeNumber} ↓`
                                        : ""}
                                </span>
                            </div>
                            <div className="relative h-1.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                                {loading && symbolProgressInfo.maxTrades > 0 ? (
                                    <div
                                        className="absolute inset-y-0 left-0 bg-indigo-500 transition-all duration-300 ease-out"
                                        style={{ width: `${Math.min(100, (symbolProgressInfo.fetched / symbolProgressInfo.maxTrades) * 100)}%` }}
                                    />
                                ) : loading ? (
                                    <div className="absolute inset-y-0 left-0 bg-indigo-400/50 dark:bg-indigo-400/50 w-1/3 rounded-full animate-[progress-indeterminate_1.5s_infinite_ease-in-out]" />
                                ) : null}
                            </div>

                            {symbolProgressInfo.fetched > 0 && (
                                <p className="text-[10px] text-gray-400 tabular-nums">
                                    Fetched {symbolProgressInfo.fetched.toLocaleString()}
                                    {symbolProgressInfo.maxTrades > 0 ? ` / ${symbolProgressInfo.maxTrades.toLocaleString()}` : ""} trades from Stockbit...
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {lastRunStats && !loading && (
                <div className="flex items-center gap-3 text-xs bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 rounded-xl px-4 py-2.5">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Completed</span>
                    <span className="text-gray-600 dark:text-gray-300">{lastRunStats.total} symbols processed</span>
                    {lastRunStats.errors > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">({lastRunStats.errors} errors)</span>
                    )}
                </div>
            )}
        </div>
    );
}
