"use client";

import { useState, useMemo, useEffect } from "react";
import { parseISO, format } from "date-fns";
import { DatePicker } from "@/components/ui/date-picker";
import { isForeignBroker } from "@/lib/foreign-brokers";
import { getBrokerType } from "@/lib/broker-types";
import { Toggle } from "@/components/ui/toggle";

interface BrokerData {
    lot: number;
    value: number;
}

interface BrokerHistoryItem {
    date: string;
    brokers: Record<string, BrokerData>;
}

interface BrokerStudyProps {
    brokers: BrokerHistoryItem[];
    selectedBroker: string | null;
    onSelectBroker: (broker: string | null) => void;
    showForeignOnly: boolean;
    onForeignOnlyChange: (show: boolean) => void;
    selectedDate: Date | null;
    onSelectDate: (date: Date | null) => void;
}

export function BrokerStudyPanel({ brokers, selectedBroker, onSelectBroker, showForeignOnly, onForeignOnlyChange, selectedDate, onSelectDate }: BrokerStudyProps) {
    const [mounted, setMounted] = useState(false);

    // Determine the latest date available default
    const latestDate = useMemo(() => {
        if (!brokers || brokers.length === 0) return null;
        const dates = brokers.map(b => b.date).sort();
        return parseISO(dates[dates.length - 1]);
    }, [brokers]);

    // Initialize on mount
    useEffect(() => {
        setMounted(true);
    }, []);

    // Filter data for the selected date
    const dailyData = useMemo(() => {
        if (!brokers || !selectedDate) return null;
        const targetStr = format(selectedDate, "yyyy-MM-dd");
        return brokers.find(b => b.date === targetStr);
    }, [brokers, selectedDate]);

    // Process Top Buyers and Sellers
    const { buyers, sellers, totalBuy, totalSell, net, maxVal } = useMemo(() => {
        if (!dailyData) return { buyers: [], sellers: [], totalBuy: 0, totalSell: 0, net: 0, maxVal: 1 };

        const all = Object.entries(dailyData.brokers)
            .filter(([code]) => code !== "total_net")
            .map(([code, data]) => ({ code, val: data.value })); // Use VALUE for sidebar

        // Top Buyers: positive values, desc
        const b = all.filter(x => x.val > 0).sort((a, b) => b.val - a.val);

        // Top Sellers: negative values, asc (most negative first)
        const s = all.filter(x => x.val < 0).sort((a, b) => a.val - b.val);

        const totalBuy = b.reduce((acc, curr) => acc + curr.val, 0);
        const totalSell = s.reduce((acc, curr) => acc + curr.val, 0); // Negative value

        return {
            buyers: b,
            sellers: s,
            totalBuy,
            totalSell,
            net: totalBuy + totalSell,
            maxVal: Math.max(
                ...b.map(x => x.val),
                ...s.map(x => Math.abs(x.val)),
                1
            )
        };
    }, [dailyData]); // Removed showForeignOnly dependency since data is pre-filtered

    const formatVal = (val: number) => {
        const absVal = Math.abs(val);
        if (absVal >= 1_000_000_000) return (absVal / 1_000_000_000).toFixed(1) + "B";
        if (absVal >= 1_000_000) return (absVal / 1_000_000).toFixed(0) + "M";
        return (absVal / 1000).toFixed(0) + "K";
    }

    const handleBrokerClick = (code: string) => {
        if (selectedBroker === code) {
            onSelectBroker(null);
        } else {
            onSelectBroker(code);
        }
    };

    return (
        <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-gray-100 dark:border-white/10 h-full flex flex-col">
            {/* Date Picker Header */}
            <div className="py-2 border-b border-gray-100 dark:border-white/10 px-2">
                <div className="flex items-center bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg p-0.5 shadow-sm w-full gap-0.5">
                    <div className="flex-1">
                        <DatePicker
                            date={selectedDate}
                            setDate={(d) => onSelectDate(d)}
                            showNavigation={true}
                            maxDate={latestDate ? latestDate : undefined}
                            minDate={new Date("2000-01-01")}
                            disabled={!mounted}
                            className="w-full"
                            compact={true}
                        />
                    </div>
                </div>
            </div>

            {/* Broker Lists */}
            <div className="flex-1 min-h-0 overflow-y-auto p-0">
                {!dailyData ? (
                    <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-xs py-8">
                        No data
                    </div>
                ) : (
                    <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-white/10 h-full">
                        {/* BUYERS Column */}
                        <div className="flex flex-col">
                            <div className="sticky top-0 bg-white dark:bg-[#1a2236] shadow-sm text-[10px] font-bold text-center py-2 text-emerald-600 dark:text-emerald-400 border-b border-gray-100 dark:border-white/10 z-20">
                                BUY
                            </div>

                            {/* TOTAL Row */}
                            {dailyData && (
                                <div className="bg-emerald-50/50 dark:bg-emerald-500/10 border-b border-gray-100 dark:border-white/10 px-1 py-1.5 flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-tighter">Total Buy</span>
                                    <span className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                        {formatVal(totalBuy)}
                                    </span>
                                </div>
                            )}

                            <div className="divide-y divide-gray-50 dark:divide-white/5">
                                {buyers.map((b) => {
                                    const type = getBrokerType(b.code);
                                    const isSelected = selectedBroker === b.code;
                                    const barWidth = `${(b.val / maxVal) * 100}%`;

                                    return (
                                        <div
                                            key={b.code}
                                            className={`relative flex flex-col items-center px-1 py-1 text-xs cursor-pointer group overflow-hidden ${isSelected
                                                ? "bg-emerald-600 text-white"
                                                : "hover:bg-gray-50 dark:hover:bg-white/5"
                                                }`}
                                            onClick={() => handleBrokerClick(b.code)}
                                        >
                                            {/* Data Bar Background */}
                                            {!isSelected && (
                                                <div
                                                    className="absolute bottom-0 left-0 h-1.5 bg-emerald-200/70 dark:bg-emerald-500/30 transition-all duration-300 group-hover:bg-emerald-300/70 dark:group-hover:bg-emerald-500/40"
                                                    style={{ width: barWidth }}
                                                />
                                            )}

                                            <div className="relative z-10 flex flex-col items-center w-full">
                                                <div className="flex items-center gap-1">
                                                    <span className={`font-bold ${isSelected ? "text-white" :
                                                        type === "FOREIGN" ? "text-red-600 dark:text-red-400" :
                                                            type === "INSIDER" ? "text-blue-600 dark:text-blue-400" :
                                                                "text-gray-900 dark:text-gray-200"
                                                        }`}>{b.code}</span>
                                                </div>
                                                <span className={`font-mono text-[10px] ${isSelected ? "text-white/90" : "text-emerald-600 dark:text-emerald-400 font-medium"}`}>
                                                    {formatVal(b.val)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {buyers.length === 0 && <div className="p-2 text-center text-[10px] text-gray-400 dark:text-gray-500">Empty</div>}
                            </div>
                        </div>

                        {/* SELLERS Column */}
                        <div className="flex flex-col">
                            <div className="sticky top-0 bg-white dark:bg-[#1a2236] shadow-sm text-[10px] font-bold text-center py-2 text-rose-600 dark:text-rose-400 border-b border-gray-100 dark:border-white/10 z-20">
                                SELL
                            </div>

                            {/* TOTAL Row */}
                            {dailyData && (
                                <div className="bg-rose-50/50 dark:bg-rose-500/10 border-b border-gray-100 dark:border-white/10 px-1 py-1.5 flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-tighter">Total Sell</span>
                                    <span className="font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                        {formatVal(totalSell)}
                                    </span>
                                </div>
                            )}

                            <div className="divide-y divide-gray-50 dark:divide-white/5">
                                {sellers.map((s) => {
                                    const type = getBrokerType(s.code);
                                    const isSelected = selectedBroker === s.code;
                                    const barWidth = `${(Math.abs(s.val) / maxVal) * 100}%`;

                                    return (
                                        <div
                                            key={s.code}
                                            className={`relative flex flex-col items-center px-1 py-1 text-xs cursor-pointer group overflow-hidden ${isSelected
                                                ? "bg-rose-600 text-white"
                                                : "hover:bg-gray-50 dark:hover:bg-white/5"
                                                }`}
                                            onClick={() => handleBrokerClick(s.code)}
                                        >
                                            {/* Data Bar Background */}
                                            {!isSelected && (
                                                <div
                                                    className="absolute bottom-0 right-0 h-1.5 bg-rose-200/70 dark:bg-rose-500/30 transition-all duration-300 group-hover:bg-rose-300/70 dark:group-hover:bg-rose-500/40"
                                                    style={{ width: barWidth }}
                                                />
                                            )}

                                            <div className="relative z-10 flex flex-col items-center w-full">
                                                <div className="flex items-center gap-1">
                                                    <span className={`font-bold ${isSelected ? "text-white" :
                                                        type === "FOREIGN" ? "text-red-600 dark:text-red-400" :
                                                            type === "INSIDER" ? "text-blue-600 dark:text-blue-400" :
                                                                "text-gray-900 dark:text-gray-200"
                                                        }`}>{s.code}</span>
                                                </div>
                                                <span className={`font-mono text-[10px] ${isSelected ? "text-white/90" : "text-rose-600 dark:text-rose-400 font-medium"}`}>
                                                    {formatVal(s.val)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {sellers.length === 0 && <div className="p-2 text-center text-[10px] text-gray-400 dark:text-gray-500">Empty</div>}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Pressure Power & Controls */}
            <div className="border-t border-gray-100 dark:border-white/10 p-2 space-y-3 bg-gray-50 dark:bg-white/5 rounded-b-xl">
                {/* Metrics */}
                {dailyData && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mb-1">
                            <span>Pressure Power</span>
                        </div>
                        <div className="flex h-8 w-full rounded overflow-hidden">
                            {(() => {
                                const buyPower = buyers.reduce((a, c) => a + c.val, 0);
                                const sellPower = Math.abs(sellers.reduce((a, c) => a + c.val, 0));
                                const totalPower = buyPower + sellPower || 1; // avoid div 0
                                const buyPct = (buyPower / totalPower) * 100;
                                const sellPct = (sellPower / totalPower) * 100;

                                return (
                                    <>
                                        <div
                                            className="flex flex-col justify-center px-2 bg-emerald-500/20 dark:bg-emerald-500/30 border-r border-emerald-500/10 dark:border-emerald-500/20 transition-all duration-500 relative"
                                            style={{ width: `${buyPct}%` }}
                                        >
                                            <div className="flex justify-between items-center whitespace-nowrap overflow-hidden relative z-10">
                                                <span className="text-[9px] text-emerald-700 dark:text-emerald-300 font-bold uppercase mr-1">Buy</span>
                                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{formatVal(buyPower)}</span>
                                            </div>
                                        </div>
                                        <div
                                            className="flex flex-col justify-center px-2 bg-rose-500/20 dark:bg-rose-500/30 transition-all duration-500 relative"
                                            style={{ width: `${sellPct}%` }}
                                        >
                                            <div className="flex justify-between items-center whitespace-nowrap overflow-hidden relative z-10">
                                                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300">{formatVal(sellPower)}</span>
                                                <span className="text-[9px] text-rose-700 dark:text-rose-300 font-bold uppercase ml-1">Sell</span>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="mt-1 pt-1 border-t border-dashed border-gray-200 dark:border-white/10 flex justify-between items-center text-xs px-1">
                            <span className="text-gray-400 dark:text-gray-500 text-[10px]">Net</span>
                            <span className={`font-bold font-mono ${net >= 0 ? "text-green-500 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                                {formatVal(net)}
                            </span>
                        </div>
                    </div>
                )}

                {/* Toggle */}
                <div className="pt-2">
                    <Toggle
                        pressed={showForeignOnly}
                        onPressedChange={onForeignOnlyChange}
                        variant="outline"
                        size="sm"
                        intent="danger"
                        className="w-full justify-between"
                    >
                        FOREIGN ONLY
                    </Toggle>
                </div>
            </div>
        </div>
    );
}
