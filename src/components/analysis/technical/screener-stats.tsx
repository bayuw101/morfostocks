"use client";

import * as React from "react";
import { Target, Zap, TrendingDown, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { TechnicalScore } from "@/lib/tech-analysis";
import { cn } from "@/lib/utils";

interface ScreenerStatsProps {
    rows: TechnicalScore[];
}

interface StatCardProps {
    title: string;
    value: number;
    subtitle: string;
    icon: React.ReactElement;
    colorClass: string;
    trend?: "up" | "down" | "neutral";
}

function StatCard({ title, value, subtitle, icon, colorClass, trend }: StatCardProps) {
    return (
        <div className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 border border-slate-100/50 flex flex-col justify-between group h-full">
            <div className="flex items-start justify-between mb-2">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-300", colorClass)}>
                    {React.cloneElement(icon, { className: "w-5 h-5" } as React.HTMLAttributes<SVGElement>)}
                </div>
                {trend && (
                    <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5",
                        trend === "up" ? "bg-emerald-50 text-emerald-600" :
                            trend === "down" ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-500")}>
                        {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    </div>
                )}
            </div>
            <div>
                <div className="text-3xl font-black text-slate-900 tracking-tight tabular-nums mb-1">{value}</div>
                <div className="text-sm font-bold text-slate-700">{title}</div>
                <div className="text-[11px] text-slate-400 font-medium mt-1 leading-snug">{subtitle}</div>
            </div>
        </div>
    );
}

export function ScreenerStats({ rows }: ScreenerStatsProps) {
    const metrics = React.useMemo(() => ({
        total: rows.filter(r => r.status !== "Avoid").length,
        goodEntries: rows.filter(r => r.status === "Good Entry").length,
        bullish: rows.filter(r => r.score > 2).length,
        bearish: rows.filter(r => r.score < -2).length,
    }), [rows]);

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
                title="Strong Entries"
                value={metrics.goodEntries}
                subtitle="Near support + Bullish"
                icon={<Target />}
                colorClass="bg-emerald-50 text-emerald-600"
                trend="up"
            />
            <StatCard
                title="Bullish Momentum"
                value={metrics.bullish}
                subtitle="Strong trend (Score > 2)"
                icon={<Zap />}
                colorClass="bg-blue-50 text-blue-600"
                trend="up"
            />
            <StatCard
                title="Overbought / Bear"
                value={metrics.bearish}
                subtitle="Likely correction"
                icon={<TrendingDown />}
                colorClass="bg-rose-50 text-rose-600"
                trend="down"
            />
            <StatCard
                title="Market Universe"
                value={metrics.total}
                subtitle="Liquid stocks analyzed"
                icon={<Activity />}
                colorClass="bg-violet-50 text-violet-600"
                trend="neutral"
            />
        </div>
    );
}
