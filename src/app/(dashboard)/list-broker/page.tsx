"use client";

import React, { useEffect, useState } from "react";
import { Users, Search } from "lucide-react";
import { FloatingInput } from "@/components/ui/floating-input";
import { getBrokersAction } from "@/lib/actions/reference-actions";
import { WavyBackground } from "@/components/layout/wavy-header";
import { Card, CardContent } from "@/components/ui/card";

export default function ListBrokerPage() {
    const [brokers, setBrokers] = useState<{ code: string, name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        async function load() {
            const res = await getBrokersAction();
            if (res.ok && res.data) {
                setBrokers(res.data);
            }
            setIsLoading(false);
        }
        load();
    }, []);

    const filtered = brokers.filter(b =>
        b.code.toLowerCase().includes(search.toLowerCase()) ||
        b.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-[#141c2e] dark:to-[#1a2236] font-sans pb-20 w-full overflow-hidden">
            <WavyBackground
                title="Brokers List"
                subtitle={`List of all brokerage firms downloaded securely from DB. (${brokers.length} Total)`}
            />

            <main className="max-w-7xl mx-auto md:px-6 lg:px-8 md:-mt-20 relative z-10 pb-0 md:pb-12 px-4">
                <Card className="border-0 sm:border border-gray-100 dark:border-white/10 shadow-none sm:shadow-xl shadow-blue-900/5 bg-transparent sm:bg-white sm:dark:bg-[#1e293b] rounded-none sm:rounded-xl">
                    <CardContent className="px-0 sm:px-6 py-4 sm:py-6">
                        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-end gap-4">
                            <div className="w-full md:w-64 shrink-0">
                                <FloatingInput
                                    id="search"
                                    label="Search brokers..."
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden">
                            {isLoading ? (
                                <div className="p-12 text-center text-gray-500">Loading brokers...</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                                        <thead className="bg-gray-50/80 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/10">
                                            <tr>
                                                <th className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100">Code</th>
                                                <th className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100">Name</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                            {filtered.map((broker) => (
                                                <tr key={broker.code} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                                                        {broker.code}
                                                    </td>
                                                    <td className="px-6 py-4 font-medium text-gray-700 dark:text-gray-300">
                                                        {broker.name}
                                                    </td>
                                                </tr>
                                            ))}

                                            {filtered.length === 0 && (
                                                <tr>
                                                    <td colSpan={2} className="px-6 py-12 text-center text-gray-500">
                                                        No brokers found matching "{search}"
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
