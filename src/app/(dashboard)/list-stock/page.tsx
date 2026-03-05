"use client";

import React, { useEffect, useState } from "react";
import { List, Search, MapPin } from "lucide-react";
import { FloatingInput } from "@/components/ui/floating-input";
import { getStocksAction } from "@/lib/actions/reference-actions";
import { WavyBackground } from "@/components/layout/wavy-header";
import { Card, CardContent } from "@/components/ui/card";

export default function ListStockPage() {
    const [stocks, setStocks] = useState<{ symbol: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        async function load() {
            const res = await getStocksAction();
            if (res.ok && res.data) {
                setStocks(res.data);
            }
            setIsLoading(false);
        }
        load();
    }, []);

    const filtered = stocks.filter(s =>
        s.symbol.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-[#141c2e] dark:to-[#1a2236] font-sans pb-20 w-full overflow-hidden">
            <WavyBackground
                title="Emiten Stocks"
                subtitle={`List of all stock emitens downloaded securely from DB. (${stocks.length} Total)`}
            />

            <main className="max-w-7xl mx-auto md:px-6 lg:px-8 md:-mt-20 relative z-10 pb-0 md:pb-12 px-4">
                <Card className="border-0 sm:border border-gray-100 dark:border-white/10 shadow-none sm:shadow-xl shadow-blue-900/5 bg-transparent sm:bg-white sm:dark:bg-[#1e293b] rounded-none sm:rounded-xl">
                    <CardContent className="px-0 sm:px-6 py-4 sm:py-6">
                        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-end gap-4">
                            <div className="w-full md:w-64 shrink-0">
                                <FloatingInput
                                    id="search"
                                    label="Search emitens..."
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden">
                            {isLoading ? (
                                <div className="p-12 text-center text-gray-500">Loading stocks...</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                                        <thead className="bg-gray-50/80 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/10">
                                            <tr>
                                                <th className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100">Symbol</th>
                                                <th className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                            {filtered.map((stock) => (
                                                <tr key={stock.symbol} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                                        {stock.symbol}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
                                                            Active
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}

                                            {filtered.length === 0 && (
                                                <tr>
                                                    <td colSpan={2} className="px-6 py-12 text-center text-gray-500">
                                                        No emitens found matching "{search}"
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
