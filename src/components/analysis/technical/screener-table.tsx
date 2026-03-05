"use client";

import * as React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { TechnicalScore } from "@/lib/tech-analysis";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// ── Formatters ────────────────────────────────────────────────────────────────
export function formatNum(x: number | null | undefined, digits = 0) {
    if (x == null || !isFinite(x)) return "-";
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(x);
}
export function formatPct(x: number) {
    if (!isFinite(x)) return "-";
    return (x >= 0 ? "+" : "") + x.toFixed(2) + "%";
}
export function formatCompact(n: number): string {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1e12) return sign + (abs / 1e12).toFixed(1) + "T";
    if (abs >= 1e9) return sign + (abs / 1e9).toFixed(1) + "B";
    if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + "M";
    if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + "K";
    return n.toString();
}

// ── Sub-components ────────────────────────────────────────────────────────────
function MacdBar({ value }: { value: number | null }) {
    if (value == null) return <span className="text-gray-300">-</span>;
    const maxWidth = 28;
    const absVal = Math.min(Math.abs(value), 50);
    const width = Math.max(2, (absVal / 50) * maxWidth);
    const isPos = value >= 0;
    return (
        <div className="flex items-center justify-center gap-1">
            <div className="relative h-2.5 flex items-center bg-gray-100 rounded" style={{ width: `${maxWidth}px` }}>
                {isPos ? (
                    <div className="absolute left-1/2 h-full bg-emerald-400 rounded-r" style={{ width: `${width / 2}px` }} />
                ) : (
                    <div className="absolute right-1/2 h-full bg-red-400 rounded-l" style={{ width: `${width / 2}px` }} />
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const configs: Record<string, { label: string; className: string }> = {
        "Good Entry": { label: "Entry", className: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200" },
        "Overpriced": { label: "Pricey", className: "bg-red-50 text-red-500 ring-1 ring-red-100" },
        "Neutral": { label: "Neutral", className: "bg-slate-100 text-slate-500 ring-1 ring-slate-200" },
        "Avoid": { label: "Avoid", className: "bg-gray-100 text-gray-400 ring-1 ring-gray-200" },
    };
    const cfg = configs[status];
    if (!cfg) return null;
    return (
        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", cfg.className)}>
            {cfg.label}
        </span>
    );
}

function TrendBadge({ trend }: { trend?: string }) {
    if (!trend || trend === "Neutral") return <span className="text-gray-300 text-[10px]">—</span>;
    return trend === "Bullish"
        ? <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold">↑ Bull</span>
        : <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded font-bold">↓ Bear</span>;
}

// ── Sort Types ─────────────────────────────────────────────────────────────────
type SortKey = "symbol" | "score" | "lastPrice" | "changePct" | "volume" | "netForeign" | "rsi";
type SortDirection = "asc" | "desc";

interface SortConfig {
    key: SortKey;
    direction: SortDirection;
}

function SortIcon({ columnKey, sortConfig }: { columnKey: SortKey; sortConfig: SortConfig | null }) {
    if (!sortConfig || sortConfig.key !== columnKey) {
        return <ChevronsUpDown className="h-3 w-3 ml-0.5 text-gray-300 inline-block" />;
    }
    return sortConfig.direction === "asc"
        ? <ChevronUp className="h-3 w-3 ml-0.5 text-blue-500 inline-block" />
        : <ChevronDown className="h-3 w-3 ml-0.5 text-blue-500 inline-block" />;
}

// ── Main Component ──────────────────────────────────────────────────────────────
interface ScreenerTableProps {
    rows: TechnicalScore[];
    loading: boolean;
}

export function ScreenerTable({ rows, loading }: ScreenerTableProps) {
    const [sortConfig, setSortConfig] = React.useState<SortConfig | null>({ key: "score", direction: "desc" });

    function handleSort(key: SortKey) {
        setSortConfig(prev =>
            prev?.key === key
                ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
                : { key, direction: "desc" }
        );
    }

    const sortedRows = React.useMemo(() => {
        if (!sortConfig) return rows;
        return [...rows].sort((a, b) => {
            const aVal = a[sortConfig.key] ?? (sortConfig.direction === "asc" ? Infinity : -Infinity);
            const bVal = b[sortConfig.key] ?? (sortConfig.direction === "asc" ? Infinity : -Infinity);
            if (typeof aVal === "string" && typeof bVal === "string") {
                return sortConfig.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return sortConfig.direction === "asc"
                ? (aVal as number) - (bVal as number)
                : (bVal as number) - (aVal as number);
        });
    }, [rows, sortConfig]);

    const thBase = "px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none whitespace-nowrap";
    const thSortable = cn(thBase, "cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100/60 dark:hover:bg-white/5 transition-colors");

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader className="bg-gray-50/50 dark:bg-white/[0.02]">
                    <TableRow className="border-gray-100 dark:border-white/10">
                        <TableHead
                            className={cn(thSortable, "text-left sticky left-0 z-10 bg-gray-50 dark:bg-[#1e293b]")}
                            onClick={() => handleSort("symbol")}
                        >
                            Symbol <SortIcon columnKey="symbol" sortConfig={sortConfig} />
                        </TableHead>
                        <TableHead className={cn(thSortable, "text-right")} onClick={() => handleSort("lastPrice")}>
                            Price <SortIcon columnKey="lastPrice" sortConfig={sortConfig} />
                        </TableHead>
                        <TableHead className={cn(thSortable, "text-right")} onClick={() => handleSort("changePct")}>
                            Chg% <SortIcon columnKey="changePct" sortConfig={sortConfig} />
                        </TableHead>
                        <TableHead className={cn(thSortable, "text-right hidden sm:table-cell")} onClick={() => handleSort("volume")}>
                            Vol <SortIcon columnKey="volume" sortConfig={sortConfig} />
                        </TableHead>
                        <TableHead className={cn(thSortable, "text-right hidden lg:table-cell")} onClick={() => handleSort("netForeign")}>
                            Foreign <SortIcon columnKey="netForeign" sortConfig={sortConfig} />
                        </TableHead>
                        <TableHead className={cn(thBase, "text-center hidden md:table-cell")}>Trend</TableHead>
                        <TableHead className={cn(thBase, "text-center hidden md:table-cell")}>Spike</TableHead>
                        <TableHead className={cn(thSortable, "text-right")} onClick={() => handleSort("rsi")}>
                            RSI <SortIcon columnKey="rsi" sortConfig={sortConfig} />
                        </TableHead>
                        <TableHead className={cn(thBase, "text-center hidden lg:table-cell")}>StochRSI</TableHead>
                        <TableHead className={cn(thBase, "text-center hidden lg:table-cell")}>MACD</TableHead>
                        <TableHead className={cn(thBase, "text-right hidden md:table-cell")}>BB</TableHead>
                        <TableHead className={cn(thBase, "text-center hidden xl:table-cell")}>Pattern</TableHead>
                        <TableHead className={cn(thBase, "text-center")}>Status</TableHead>
                        <TableHead className={cn(thBase, "hidden lg:table-cell")}>Signals</TableHead>
                        <TableHead
                            className={cn(thSortable, "text-right text-blue-500")}
                            onClick={() => handleSort("score")}
                        >
                            Score <SortIcon columnKey="score" sortConfig={sortConfig} />
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={15} className="h-56 text-center">
                                <div className="flex flex-col items-center gap-3 text-gray-400">
                                    <div className="relative">
                                        <div className="w-8 h-8 border-2 border-gray-200 dark:border-gray-700 rounded-full" />
                                        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin absolute inset-0" />
                                    </div>
                                    <p className="text-xs font-medium">Analyzing 900+ stocks...</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : sortedRows.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={15} className="h-40 text-center text-gray-400 text-xs">
                                No stocks match your filter.
                            </TableCell>
                        </TableRow>
                    ) : (
                        sortedRows.map(row => (
                            <TableRow
                                key={row.symbol}
                                className="cursor-pointer border-gray-50 dark:border-white/5 bg-white dark:bg-[#1e293b] hover:bg-blue-50/50 dark:hover:bg-white/5 group transition-colors"
                                onClick={() => window.open(`/analysis/technical/${row.symbol}`, "_blank")}
                            >
                                {/* Symbol */}
                                <TableCell className="px-3 py-2.5 font-bold text-sm text-gray-900 dark:text-gray-100 sticky left-0 z-10 bg-white dark:bg-[#1e293b] group-hover:bg-blue-50/50 dark:group-hover:bg-[#252f43] transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                    {row.symbol}
                                </TableCell>

                                {/* Price */}
                                <TableCell className="px-3 py-2.5 text-right font-mono text-xs text-gray-700 dark:text-gray-300 font-medium">
                                    {formatNum(row.lastPrice)}
                                </TableCell>

                                {/* Change */}
                                <TableCell className={cn(
                                    "px-3 py-2.5 text-right font-mono text-xs font-semibold",
                                    row.changePct > 0 ? "text-emerald-500 dark:text-emerald-400" : row.changePct < 0 ? "text-red-500 dark:text-red-400" : "text-gray-400"
                                )}>
                                    {formatPct(row.changePct)}
                                </TableCell>

                                {/* Volume */}
                                <TableCell className="px-3 py-2.5 text-right text-[11px] text-gray-400 hidden sm:table-cell font-mono">
                                    {formatCompact(row.volume)}
                                </TableCell>

                                {/* Foreign */}
                                <TableCell className={cn(
                                    "px-3 py-2.5 text-right text-[11px] font-mono hidden lg:table-cell font-medium",
                                    row.netForeign > 0 ? "text-emerald-500 dark:text-emerald-400" : row.netForeign < 0 ? "text-red-500 dark:text-red-400" : "text-gray-400"
                                )}>
                                    {row.netForeign ? formatCompact(row.netForeign) : "-"}
                                </TableCell>

                                {/* Trend */}
                                <TableCell className="px-3 py-2.5 text-center hidden md:table-cell">
                                    <TrendBadge trend={row.trend} />
                                </TableCell>

                                {/* Spike */}
                                <TableCell className="px-3 py-2.5 text-center hidden md:table-cell">
                                    {row.volumeSpike > 1.5 ? (
                                        <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full ring-1 ring-blue-100 dark:ring-blue-500/20">
                                            {row.volumeSpike.toFixed(1)}x
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 dark:text-gray-500 text-[10px]">{row.volumeSpike.toFixed(1)}x</span>
                                    )}
                                </TableCell>

                                {/* RSI */}
                                <TableCell className={cn(
                                    "px-3 py-2.5 text-right font-mono text-xs",
                                    Number(row.rsi) < 30 ? "text-emerald-600 dark:text-emerald-400 font-bold" :
                                        Number(row.rsi) > 70 ? "text-red-500 dark:text-red-400 font-bold" : "text-gray-600 dark:text-gray-400"
                                )}>
                                    {row.rsi ? formatNum(row.rsi) : "-"}
                                </TableCell>

                                {/* Stoch RSI */}
                                <TableCell className="px-2 py-2.5 text-center hidden lg:table-cell">
                                    {row.stochRsiK != null ? (
                                        <div className="flex flex-col items-center leading-none gap-0.5">
                                            <span className={cn(
                                                "text-[10px] font-mono font-semibold",
                                                row.stochRsiK < 20 ? "text-emerald-600 dark:text-emerald-400" : row.stochRsiK > 80 ? "text-red-500 dark:text-red-400" : "text-gray-500"
                                            )}>
                                                {row.stochRsiK.toFixed(0)}
                                            </span>
                                            {row.stochRsiD != null && (
                                                <span className="text-[9px] text-gray-400">{row.stochRsiD.toFixed(0)}</span>
                                            )}
                                        </div>
                                    ) : <span className="text-gray-300 dark:text-gray-600 text-[10px]">-</span>}
                                </TableCell>

                                {/* MACD Histogram */}
                                <TableCell className="px-2 py-2.5 text-center hidden lg:table-cell">
                                    <MacdBar value={row.macdHist} />
                                </TableCell>

                                {/* BB Position */}
                                <TableCell className="px-3 py-2.5 text-right text-xs font-mono hidden md:table-cell">
                                    {row.bbPosition != null ? (
                                        <span className={cn(
                                            "font-medium",
                                            row.bbPosition < 0.2 ? "text-emerald-600 dark:text-emerald-400" :
                                                row.bbPosition > 0.8 ? "text-red-500 dark:text-red-400" : "text-gray-500 dark:text-gray-400"
                                        )}>
                                            {row.bbPosition.toFixed(2)}
                                        </span>
                                    ) : <span className="text-gray-400 dark:text-gray-600">-</span>}
                                </TableCell>

                                {/* Pattern */}
                                <TableCell className="px-2 py-2.5 text-center hidden xl:table-cell">
                                    {row.isSideways ? (
                                        <span className="text-[10px] font-bold bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-full ring-1 ring-violet-100 dark:ring-violet-500/20">
                                            SW {row.sidewaysDays}d
                                        </span>
                                    ) : <span className="text-gray-300 dark:text-gray-600 text-[10px]">-</span>}
                                </TableCell>

                                {/* Status */}
                                <TableCell className="px-3 py-2.5 text-center">
                                    <StatusBadge status={row.status} />
                                </TableCell>

                                {/* Signals */}
                                <TableCell className="px-2 py-2.5 hidden lg:table-cell">
                                    <div className="flex flex-wrap gap-1">
                                        {row.signals.slice(0, 2).map(s => (
                                            <span key={s} className="text-[9px] font-medium bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                                                {s}
                                            </span>
                                        ))}
                                        {row.signals.length > 2 && (
                                            <span className="text-[9px] font-medium bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 px-1.5 py-0.5 rounded">
                                                +{row.signals.length - 2}
                                            </span>
                                        )}
                                    </div>
                                </TableCell>

                                {/* Score */}
                                <TableCell className="px-3 py-2.5 text-right">
                                    <span className={cn(
                                        "font-black text-base tabular-nums",
                                        row.score >= 4 ? "text-emerald-500 dark:text-emerald-400" :
                                            row.score >= 2 ? "text-blue-500 dark:text-blue-400" :
                                                row.score <= -2 ? "text-red-500 dark:text-red-400" : "text-gray-600 dark:text-gray-400"
                                    )}>
                                        {row.score > 0 && "+"}{row.score}
                                    </span>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
