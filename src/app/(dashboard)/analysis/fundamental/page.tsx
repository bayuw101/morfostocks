"use client";

import React, { useState, useEffect, useMemo } from "react";
import { WavyBackground } from "@/components/layout/wavy-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FloatingInput } from "@/components/ui/floating-input";
import { FloatingSelect } from "@/components/ui/floating-select";
import { SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, Loader2, ArrowRight } from "lucide-react";
import type { FundamentalData } from "@/types/fundamental";
import Link from "next/link";

type SortMode = 'score' | 'undervalued' | 'valuation' | 'profitability' | 'solvency' | 'growth' | 'efficiency';

const SORT_OPTIONS = [
    { value: "score", label: "Fundamental Score" },
    { value: "undervalued", label: "Undervalued (Graham / Margin of Safety)" },
    { value: "valuation", label: "Valuation (PBV)" },
    { value: "profitability", label: "Profitability (ROE)" },
    { value: "solvency", label: "Solvency (DER)" },
    { value: "growth", label: "Growth (Revenue)" },
    { value: "efficiency", label: "Efficiency (NPM)" },
];

export default function FundamentalAnalysisPage() {
    const [data, setData] = useState<FundamentalData[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sortMode, setSortMode] = useState<SortMode>('score');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/analysis/fundamental");
            const json = await res.json();
            if (json.data) setData(json.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const filteredData = useMemo(() => {
        if (!data) return [];
        let result = data;

        if (search) {
            result = result.filter(item =>
                item.symbol.toLowerCase().includes(search.toLowerCase())
            );
        }

        let sorted = [...result];
        switch (sortMode) {
            case 'score':
                sorted.sort((a, b) => (b.score || 0) - (a.score || 0));
                break;
            case 'undervalued':
                sorted.sort((a, b) => {
                    const mosA = (a.graham_number && a.last_price) ? (a.graham_number - a.last_price) / a.graham_number : -999;
                    const mosB = (b.graham_number && b.last_price) ? (b.graham_number - b.last_price) / b.graham_number : -999;
                    return mosB - mosA;
                });
                break;
            case 'valuation':
                sorted.sort((a, b) => {
                    const va = a.pbv <= 0 ? 9999 : a.pbv;
                    const vb = b.pbv <= 0 ? 9999 : b.pbv;
                    return va - vb;
                });
                break;
            case 'profitability':
                sorted.sort((a, b) => b.roe - a.roe);
                break;
            case 'solvency':
                sorted.sort((a, b) => a.der - b.der);
                break;
            case 'growth':
                sorted.sort((a, b) => b.rev_growth - a.rev_growth);
                break;
            case 'efficiency':
                sorted.sort((a, b) => b.npm - a.npm);
                break;
        }

        return sorted;
    }, [data, search, sortMode]);

    const formatMetrics = (val: number, isPercent = false, invertColor = false) => {
        if (typeof val !== "number" || isNaN(val)) return "-";

        const isPositive = val > 0;
        const colorClass = val === 0 ? "text-gray-500 font-medium" :
            (isPositive !== invertColor) ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold";

        return (
            <span className={colorClass}>
                {val > 0 ? "+" : ""}{val.toFixed(2)}{isPercent ? "%" : ""}
            </span>
        );
    };

    const getScoreColor = (score?: number) => {
        if (!score) return "bg-gray-100 text-gray-700";
        if (score >= 70) return "bg-emerald-100 text-emerald-800 border-emerald-200";
        if (score >= 40) return "bg-yellow-100 text-yellow-800 border-yellow-200";
        return "bg-rose-100 text-rose-800 border-rose-200";
    };

    return (
        <div className="w-full pb-20">
            <WavyBackground
                title="Fundamental Analysis"
                subtitle="Deep value screening based on Quality, Growth, and Valuation metrics"
            >
            </WavyBackground>

            <main className="max-w-7xl mx-auto md:px-6 lg:px-8 md:-mt-20 relative z-10 pb-0 md:pb-12">
                <Card className="gap-0 border-0 sm:border border-gray-100 dark:border-white/10 shadow-none sm:shadow-xl shadow-blue-900/5 bg-transparent sm:bg-white sm:dark:bg-[#1e293b] rounded-none sm:rounded-xl">

                    {/* Controls Header */}
                    <div className="p-4 sm:pt-0 sm:p-6 border-b border-gray-100 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white sm:bg-transparent dark:bg-[#1e293b] sm:dark:bg-transparent">
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
                                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">Ranked Screen</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {data ? `${filteredData.length} stocks found` : "Loading..."}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                            <div className="w-full sm:w-[260px]">
                                <FloatingSelect
                                    label="Sort Category"
                                    value={sortMode}
                                    onValueChange={(v) => setSortMode(v as SortMode)}
                                >
                                    {SORT_OPTIONS.map(o => (
                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                </FloatingSelect>
                            </div>
                            <div className="w-full sm:w-[320px]">
                                <FloatingInput
                                    id="search"
                                    label="Search Emiten..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    icon={<Search className="w-4 h-4 text-gray-400" />}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table Content */}
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-50/50 dark:bg-white/[0.02]">
                                    <TableRow className="border-gray-100 dark:border-white/10">
                                        <TableHead className="font-semibold px-4 sm:px-6">Emiten</TableHead>
                                        <TableHead className="font-semibold text-right">Score</TableHead>
                                        <TableHead className="font-semibold text-right">PER</TableHead>
                                        <TableHead className="font-semibold text-right">PBV</TableHead>
                                        <TableHead className="font-semibold text-right">MOS</TableHead>
                                        <TableHead className="font-semibold text-right">ROE</TableHead>
                                        <TableHead className="font-semibold text-right">NPM</TableHead>
                                        <TableHead className="font-semibold text-right">Rev. Growth</TableHead>
                                        <TableHead className="font-semibold text-center px-4 sm:px-6">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="h-48 text-center">
                                                <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-2" />
                                                <p className="text-sm text-gray-500">Evaluating fundamentals...</p>
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredData.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="h-48 text-center text-gray-500">
                                                No stocks found matching your criteria
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredData.map((item, i) => {
                                            const mos = (item.graham_number && item.last_price)
                                                ? (item.graham_number - item.last_price) / item.graham_number
                                                : null;

                                            return (
                                                <TableRow
                                                    key={item.symbol}
                                                    className="border-gray-50 dark:border-white/5 bg-white dark:bg-[#1e293b] hover:bg-blue-50/50 dark:hover:bg-white/5 group transition-colors"
                                                >
                                                    <TableCell className="px-4 sm:px-6">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm font-bold text-gray-500 dark:text-gray-400 w-5 text-right tabular-nums">
                                                                {i + 1}.
                                                            </span>
                                                            <div className="font-bold text-gray-900 dark:text-gray-100">
                                                                {item.symbol}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold border ${getScoreColor(item.score)}`}>
                                                            {item.score?.toFixed(1) || "-"}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium text-gray-700 dark:text-gray-300">
                                                        {item.per > 0 ? item.per.toFixed(2) : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium text-gray-700 dark:text-gray-300">
                                                        {item.pbv > 0 ? item.pbv.toFixed(2) : "-"}
                                                    </TableCell>
                                                    <TableCell className={`text-right font-bold ${mos && mos > 0.3 ? 'text-emerald-600 dark:text-emerald-400' : (mos && mos > 0 ? 'text-emerald-500 dark:text-emerald-500' : 'text-rose-500 dark:text-rose-400')}`}>
                                                        {mos ? formatMetrics(mos * 100, true) : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {formatMetrics(item.roe, true)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {formatMetrics(item.npm, true)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {formatMetrics(item.rev_growth, true)}
                                                    </TableCell>
                                                    <TableCell className="text-center px-4 sm:px-6">
                                                        <Link href={`/analysis/technical/${item.symbol}`}>
                                                            <Button variant="ghost" size="sm" className="h-8 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 font-semibold group-hover:translate-x-1 transition-transform">
                                                                Detail <ArrowRight className="w-4 h-4 ml-1" />
                                                            </Button>
                                                        </Link>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
