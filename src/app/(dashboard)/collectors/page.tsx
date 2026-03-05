"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { DateRangePicker } from "@/components/ui/date-picker";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { BarChart3, Database } from "lucide-react";
import { WavyBackground } from "@/components/layout/wavy-header";
import { Card, CardContent } from "@/components/ui/card";

import OhlcCollector from "@/components/collector/ohlc-collector";
import BrokerCollector from "@/components/collector/broker-collector";
import BidOfferCollector from "@/components/collector/bidoffer-collector";
import FundamentalCollector from "@/components/collector/fundamental-collector";
import OwnershipPdfCollector from "@/components/collector/ownership-pdf-collector";
import { Users, Layers, FilePlus } from "lucide-react";

export default function CollectorsPage() {
    const [from, setFrom] = useState<Date | null>(null);
    const [to, setTo] = useState<Date | null>(null);
    const [mounted, setMounted] = useState(false);

    React.useEffect(() => {
        setMounted(true);
        setFrom(new Date(Date.now() - 86400000));
        setTo(new Date());
    }, []);

    const handleDateChange = (start: Date | null, end: Date | null) => {
        if (start) setFrom(start);
        if (end) setTo(end);
    };

    const collectors = [
        {
            id: "ohlc",
            title: "OHLC Data",
            description: "Daily price and volume data for all symbols",
            icon: BarChart3,
            component: <OhlcCollector from={from} to={to} />,
        },
        {
            id: "broker",
            title: "Broker Data",
            description: "Daily summaries and transaction flows for all active brokers",
            icon: Users,
            component: <BrokerCollector from={from} to={to} />,
        },
        {
            id: "bidoffer",
            title: "Tier Flow Data",
            description: "Intraday running trade history parsed into 10 volume execution tiers",
            icon: Layers,
            component: <BidOfferCollector from={from} to={to} />,
        },
        {
            id: "fundamental",
            title: "Fundamentals Data",
            description: "Daily key statistics updates for all active stocks",
            icon: Database,
            component: <FundamentalCollector />,
        },
        {
            id: "ownership",
            title: "1% Ownership Data",
            description: "Daily KSEI 1% shareholders reports parsed into ownership history",
            icon: FilePlus,
            component: <OwnershipPdfCollector from={from} to={to} />,
        },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-[#141c2e] dark:to-[#1a2236] font-sans pb-20 w-full overflow-hidden">
            <WavyBackground
                title="Data Collectors"
                subtitle="Collect and sync market data sequentially from Stockbit."
            >
                <div className="flex items-center gap-3 bg-white/20 dark:bg-white/5 backdrop-blur-md p-1.5 pr-2 rounded-2xl shadow-sm border border-white/30 dark:border-white/10 mt-4 xl:mt-0 xl:ml-auto">
                    <DateRangePicker
                        from={from}
                        to={to}
                        onChange={handleDateChange}
                    />
                </div>
            </WavyBackground>

            <main className="max-w-7xl mx-auto md:px-6 lg:px-8 md:-mt-20 relative z-10 pb-0 md:pb-12 px-4">
                <Card className="border-0 sm:border border-gray-100 dark:border-white/10 shadow-none sm:shadow-xl shadow-blue-900/5 bg-transparent sm:bg-white sm:dark:bg-[#1e293b] rounded-none sm:rounded-xl">
                    <CardContent className="px-0 sm:px-6 py-4 sm:py-6">
                        {mounted && (
                            <Accordion type="multiple" defaultValue={["ohlc"]} className="space-y-3">
                                {collectors.map((collector) => {
                                    const Icon = collector.icon;
                                    return (
                                        <AccordionItem
                                            key={collector.id}
                                            value={collector.id}
                                            className="rounded-xl border border-gray-100 dark:border-white/5 overflow-hidden bg-gray-50/50 dark:bg-white/[0.02]"
                                        >
                                            <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors group">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 transition-colors">
                                                        <Icon className="h-5 w-5" />
                                                    </div>
                                                    <div className="text-left py-1">
                                                        <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                                            {collector.title}
                                                            {collector.id === 'ohlc' && (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">ACTIVE</span>
                                                            )}
                                                        </h3>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium leading-relaxed">
                                                            {collector.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="px-5 pb-5 pt-2 border-t border-gray-100 dark:border-white/5">
                                                {collector.component}
                                            </AccordionContent>
                                        </AccordionItem>
                                    );
                                })}
                            </Accordion>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
