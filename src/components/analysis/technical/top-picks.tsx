"use client";

import * as React from "react";
import { TrendingUp, ArrowUpRight } from "lucide-react";
import type { TechnicalScore } from "@/lib/tech-analysis";
import { formatNum, formatPct } from "./screener-table";
import { cn } from "@/lib/utils";

interface TopPicksProps {
    stocks: TechnicalScore[];
    title?: string;
}

function ScoreRing({ score }: { score: number }) {
    const color = score >= 6 ? "text-emerald-500" : score >= 4 ? "text-blue-500" : "text-gray-500";
    return (
        <div className={cn("text-2xl font-black tabular-nums leading-none", color)}>
            +{score}
        </div>
    );
}

export function TopPicks({ stocks, title = "Top Technical Picks" }: TopPicksProps) {
    if (stocks.length === 0) return null;

    return (
        <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                <div className="flex items-center justify-center w-5 h-5 bg-emerald-100 rounded-md">
                    <TrendingUp className="h-3 w-3 text-emerald-600" />
                </div>
                {title}
                <span className="ml-1 text-[10px] font-semibold bg-emerald-50 text-emerald-500 px-1.5 py-0.5 rounded-full">
                    {stocks.length} alerts
                </span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {stocks.map(stock => (
                    <div
                        key={stock.symbol}
                        className="bg-white rounded-xl p-4 shadow-sm cursor-pointer border border-transparent hover:border-emerald-200 hover:shadow-md transition-all group relative overflow-hidden"
                        onClick={() => window.open(`/analysis/technical/${stock.symbol}`, "_blank")}
                    >
                        {/* Subtle background glow */}
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />

                        <div className="relative flex justify-between items-start mb-3">
                            <div>
                                <span className="font-black text-lg text-gray-900 tracking-tight">{stock.symbol}</span>
                                {stock.trend === "Bullish" && (
                                    <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Bullish Trend</div>
                                )}
                            </div>
                            <ScoreRing score={stock.score} />
                        </div>

                        <div className="relative flex justify-between items-end">
                            <div>
                                <div className="text-lg font-bold text-gray-900 font-mono">{formatNum(stock.lastPrice)}</div>
                                <div className={cn(
                                    "text-xs font-semibold flex items-center gap-0.5",
                                    stock.changePct >= 0 ? "text-emerald-500" : "text-red-500"
                                )}>
                                    {stock.changePct > 0 && <ArrowUpRight className="h-3 w-3" />}
                                    {formatPct(stock.changePct)}
                                </div>
                            </div>
                            <div className="text-right space-y-1">
                                <div className="text-[10px] text-gray-400">
                                    RSI: <span className={cn(
                                        "font-bold",
                                        Number(stock.rsi) < 30 ? "text-emerald-600" : "text-gray-600"
                                    )}>{stock.rsi?.toFixed(0) || "-"}</span>
                                </div>
                                {stock.isSideways && (
                                    <div className="text-[9px] bg-violet-50 text-violet-600 font-bold px-1.5 py-0.5 rounded-full text-center">
                                        SW {stock.sidewaysDays}d
                                    </div>
                                )}
                                {stock.netForeign > 0 && (
                                    <div className="text-[9px] bg-emerald-50 text-emerald-600 font-bold px-1.5 py-0.5 rounded-full text-center">
                                        +Foreign
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
