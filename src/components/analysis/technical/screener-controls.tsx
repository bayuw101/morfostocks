"use client";

import * as React from "react";
import { Search, BarChart2 } from "lucide-react";
import { FloatingInput } from "@/components/ui/floating-input";
import { FloatingSelect } from "@/components/ui/floating-select";
import { SelectItem } from "@/components/ui/select";

interface ScreenerControlsProps {
    filter: string;
    setFilter: (v: string) => void;
    statusFilter: string;
    setStatusFilter: (v: string) => void;
    loading: boolean;
    onRefresh: () => void;
    totalCount?: number;
    filteredCount?: number;
}

const STATUS_OPTIONS = [
    { value: "all", label: "All Liquid" },
    { value: "good_entry", label: "Good Entry" },
    { value: "overpriced", label: "Overpriced" },
    { value: "neutral", label: "Neutral" },
    { value: "avoid", label: "Avoid (Illiquid)" },
];

export function ScreenerControls({
    filter, setFilter, statusFilter, setStatusFilter,
    totalCount, filteredCount
}: ScreenerControlsProps) {
    return (
        <div className="p-4 sm:pt-0 sm:p-6 border-b border-gray-100 dark:border-white/10 flex flex-col lg:flex-row items-center justify-between gap-4 bg-white sm:bg-transparent dark:bg-[#1e293b] sm:dark:bg-transparent">
            <div className="flex items-center gap-3 w-full lg:w-auto">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
                    <BarChart2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Technical Screener</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {filteredCount != null && totalCount != null
                            ? `${filteredCount} of ${totalCount} valid stocks found`
                            : "Loading..."}
                    </p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                <div className="w-full sm:w-[200px]">
                    <FloatingSelect
                        label="Status Filter"
                        value={statusFilter}
                        onValueChange={setStatusFilter}
                    >
                        {STATUS_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                    </FloatingSelect>
                </div>
                <div className="w-full sm:w-[280px]">
                    <FloatingInput
                        id="search"
                        label="Search Emiten..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        icon={<Search className="w-4 h-4 text-gray-400" />}
                    />
                </div>
            </div>
        </div>
    );
}
