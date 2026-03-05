"use client";

import React, { useEffect, useState } from "react";
import { WavyBackground } from "@/components/layout/wavy-header";
import { Card, CardContent } from "@/components/ui/card";
import {
    TrendingUp,
    TrendingDown,
    Database,
    BarChart3,
    Activity,
    Globe,
    Building2,
    Calendar,
    ArrowRight
} from "lucide-react";
import Link from "next/link";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from "recharts";

interface DashboardData {
    stats: {
        totalStocks: number;
        totalFundamentals: number;
        latestDate: string;
        totalForeignFlow: number;
    };
    ihsgHistory: any[];
    topGainers: any[];
    topLosers: any[];
    topFundamentals: any[];
}

export default function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/dashboard")
            .then(res => res.json())
            .then(json => {
                if (json.stats) setData(json);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const formatMetrics = (val: number, isCurrency = false) => {
        if (!val) return "0";
        if (isCurrency || Math.abs(val) > 1000000) {
            const abs = Math.abs(val);
            if (abs >= 1_000_000_000) return (val / 1_000_000_000).toFixed(2) + "B";
            if (abs >= 1_000_000) return (val / 1_000_000).toFixed(2) + "M";
            return val.toLocaleString();
        }
        return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-[#141c2e] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-gray-500">
                    <Activity className="w-8 h-8 animate-pulse text-blue-500" />
                    <p className="font-medium animate-pulse">Loading Morfostocks Dashboard...</p>
                </div>
            </div>
        );
    }

    const { stats, ihsgHistory, topGainers, topLosers, topFundamentals } = data || {};

    const chartData = ihsgHistory?.map(item => ({
        date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        close: item.close
    })) || [];

    // Calculate IHSG change if available
    let ihsgChange = 0;
    let ihsgCurrent = 0;
    if (ihsgHistory && ihsgHistory.length > 1) {
        const last = ihsgHistory[ihsgHistory.length - 1];
        const prev = ihsgHistory[ihsgHistory.length - 2];
        ihsgCurrent = last.close;
        ihsgChange = ((last.close - prev.close) / prev.close) * 100;
    }

    return (
        <div className="w-full pb-20">
            <WavyBackground
                title="Morfostocks Dashboard"
                subtitle="Comprehensive market overview, stock performance, and deep fundamental analysis."
            />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10 pb-12 space-y-6">

                {/* ── Top Stats Grid ─────────────────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="border-0 sm:border border-gray-100 dark:border-white/10 bg-white dark:bg-[#1e293b] shadow-sm sm:shadow-lg sm:rounded-xl overflow-hidden">
                        <div className="p-4 sm:p-5 flex items-center gap-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-full shrink-0">
                                <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tracked Stocks</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white leading-none mt-1">
                                    {stats?.totalStocks || 0}
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card className="border-0 sm:border border-gray-100 dark:border-white/10 bg-white dark:bg-[#1e293b] shadow-sm sm:shadow-lg sm:rounded-xl overflow-hidden">
                        <div className="p-4 sm:p-5 flex items-center gap-4">
                            <div className="p-3 bg-purple-50 dark:bg-purple-500/10 rounded-full shrink-0">
                                <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fundamentals</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white leading-none mt-1">
                                    {stats?.totalFundamentals || 0}
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card className="border-0 sm:border border-gray-100 dark:border-white/10 bg-white dark:bg-[#1e293b] shadow-sm sm:shadow-lg sm:rounded-xl overflow-hidden">
                        <div className="p-4 sm:p-5 flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-full shrink-0">
                                <Globe className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Foreign Flow</p>
                                <p className={`text-xl sm:text-2xl font-black leading-none mt-1 ${(stats?.totalForeignFlow || 0) >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                    }`}>
                                    {(stats?.totalForeignFlow || 0) >= 0 ? '+' : ''}
                                    {formatMetrics(stats?.totalForeignFlow || 0, true)}
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card className="border-0 sm:border border-gray-100 dark:border-white/10 bg-white dark:bg-[#1e293b] shadow-sm sm:shadow-lg sm:rounded-xl overflow-hidden">
                        <div className="p-4 sm:p-5 flex items-center gap-4">
                            <div className="p-3 bg-orange-50 dark:bg-orange-500/10 rounded-full shrink-0">
                                <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Latest Data</p>
                                <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-white leading-tight mt-1">
                                    {formatDate(stats?.latestDate || "")}
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* ── Main Dashboard Layout ─────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left Column: Chart & Fundamentals */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Market Overview Chart */}
                        <Card className="border-0 sm:border border-gray-100 dark:border-white/10 bg-white dark:bg-[#1e293b] shadow-sm sm:shadow-lg sm:rounded-xl overflow-hidden">
                            <div className="p-5 border-b border-gray-100 dark:border-white/10 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <BarChart3 className="w-5 h-5 text-blue-500" />
                                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">IHSG Composite</h3>
                                </div>
                                {ihsgCurrent > 0 && (
                                    <div className="text-right">
                                        <div className="text-xl font-black text-gray-900 dark:text-white">{ihsgCurrent.toLocaleString()}</div>
                                        <div className={`text-sm font-bold flex items-center justify-end ${ihsgChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                            {ihsgChange >= 0 ? '+' : ''}{ihsgChange.toFixed(2)}%
                                        </div>
                                    </div>
                                )}
                            </div>
                            <CardContent className="p-0">
                                {chartData.length > 0 ? (
                                    <div className="h-[300px] w-full p-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                                                <XAxis
                                                    dataKey="date"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 12, fill: '#64748b' }}
                                                    minTickGap={30}
                                                />
                                                <YAxis
                                                    domain={['auto', 'auto']}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 12, fill: '#64748b' }}
                                                    tickFormatter={(value) => value.toLocaleString()}
                                                    width={60}
                                                />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                    labelStyle={{ fontWeight: 'bold', color: '#0f172a' }}
                                                    itemStyle={{ color: '#3b82f6' }}
                                                    formatter={(value: any) => {
                                                        const numValue = Number(value);
                                                        return [!isNaN(numValue) ? numValue.toLocaleString() : value, 'Index'];
                                                    }}
                                                />
                                                <Area type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorClose)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="h-[300px] flex items-center justify-center text-gray-400">
                                        No historical index data available
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Top Fundamental Scores */}
                        <Card className="border-0 sm:border border-gray-100 dark:border-white/10 bg-white dark:bg-[#1e293b] shadow-sm sm:shadow-lg sm:rounded-xl overflow-hidden">
                            <div className="p-5 border-b border-gray-100 dark:border-white/10 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <Building2 className="w-5 h-5 text-purple-500" />
                                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">Top Fundamental Scores</h3>
                                </div>
                                <Link href="/analysis/fundamental">
                                    <span className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                        View All
                                        <ArrowRight className="w-4 h-4" />
                                    </span>
                                </Link>
                            </div>
                            <CardContent className="p-0">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-white/10">
                                    {topFundamentals?.map((item, i) => (
                                        <Link key={i} href={`/analysis/fundamental/${item.symbol}`} className="p-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                                            <div className="flex flex-row sm:flex-col justify-between items-center sm:items-start gap-2">
                                                <div className="font-black text-xl text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">{item.symbol}</div>
                                                <div className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 sm:px-2 rounded-lg text-lg sm:text-2xl font-black w-auto sm:w-full text-center">
                                                    {item.score.toFixed(1)}
                                                </div>
                                            </div>
                                            <div className="hidden sm:flex justify-between items-center mt-3 pt-3 border-t border-gray-100 dark:border-white/10">
                                                <div className="text-[10px] text-gray-500 uppercase tracking-wider">PER</div>
                                                <div className="font-mono text-xs font-semibold text-gray-900 dark:text-white">{item.per > 0 ? item.per.toFixed(1) : '-'}</div>
                                            </div>
                                            <div className="hidden sm:flex justify-between items-center mt-1">
                                                <div className="text-[10px] text-gray-500 uppercase tracking-wider">ROE</div>
                                                <div className="font-mono text-xs font-semibold text-gray-900 dark:text-white">{(item.roe).toFixed(1)}%</div>
                                            </div>
                                        </Link>
                                    ))}
                                    {(!topFundamentals || topFundamentals.length === 0) && (
                                        <div className="col-span-full py-8 text-center text-gray-500">No fundamental data available</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Top Movers */}
                    <div className="space-y-6">

                        {/* Top Gainers */}
                        <Card className="border-0 sm:border border-gray-100 dark:border-white/10 bg-white dark:bg-[#1e293b] shadow-sm sm:shadow-lg sm:rounded-xl overflow-hidden">
                            <div className="p-4 border-b border-gray-100 dark:border-white/10 flex items-center gap-2 bg-emerald-50/50 dark:bg-emerald-500/5">
                                <TrendingUp className="w-5 h-5 text-emerald-500" />
                                <h3 className="font-bold text-emerald-700 dark:text-emerald-400">Top Gainers</h3>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-white/10">
                                {topGainers?.map((item, i) => (
                                    <Link key={i} href={`/analysis/technical/${item.symbol}`} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 text-center font-bold text-gray-400 text-xs">{i + 1}</div>
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white">{item.symbol}</div>
                                                <div className="text-xs text-gray-500 font-mono text-left">{item.close.toLocaleString()}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-emerald-600 dark:text-emerald-400">+{item.changePct.toFixed(2)}%</div>
                                            <div className="text-[10px] text-gray-400 uppercase tracking-wider">VOL: {formatMetrics(item.volume)}</div>
                                        </div>
                                    </Link>
                                ))}
                                {(!topGainers || topGainers.length === 0) && (
                                    <div className="py-6 text-center text-gray-500 text-sm">No significant gainers</div>
                                )}
                            </div>
                        </Card>

                        {/* Top Losers */}
                        <Card className="border-0 sm:border border-gray-100 dark:border-white/10 bg-white dark:bg-[#1e293b] shadow-sm sm:shadow-lg sm:rounded-xl overflow-hidden">
                            <div className="p-4 border-b border-gray-100 dark:border-white/10 flex items-center gap-2 bg-rose-50/50 dark:bg-rose-500/5">
                                <TrendingDown className="w-5 h-5 text-rose-500" />
                                <h3 className="font-bold text-rose-700 dark:text-rose-400">Top Losers</h3>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-white/10">
                                {topLosers?.map((item, i) => (
                                    <Link key={i} href={`/analysis/technical/${item.symbol}`} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 text-center font-bold text-gray-400 text-xs">{i + 1}</div>
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white">{item.symbol}</div>
                                                <div className="text-xs text-gray-500 font-mono text-left">{item.close.toLocaleString()}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-rose-600 dark:text-rose-400">{item.changePct.toFixed(2)}%</div>
                                            <div className="text-[10px] text-gray-400 uppercase tracking-wider">VOL: {formatMetrics(item.volume)}</div>
                                        </div>
                                    </Link>
                                ))}
                                {(!topLosers || topLosers.length === 0) && (
                                    <div className="py-6 text-center text-gray-500 text-sm">No significant losers</div>
                                )}
                            </div>
                        </Card>
                    </div>

                </div>
            </main>
        </div>
    );
}
