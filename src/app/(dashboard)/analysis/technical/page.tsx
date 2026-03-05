"use client";

import * as React from "react";
import type { TechnicalScore } from "@/lib/tech-analysis";
import { ScreenerTable } from "@/components/analysis/technical/screener-table";
import { ScreenerControls } from "@/components/analysis/technical/screener-controls";
import { WavyBackground } from "@/components/layout/wavy-header";
import { Card, CardContent } from "@/components/ui/card";

export default function TechnicalAnalysisPage() {
    const [rows, setRows] = React.useState<TechnicalScore[] | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [filter, setFilter] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<string>("all");

    React.useEffect(() => { fetchData(); }, []);

    async function fetchData() {
        setLoading(true);
        try {
            const res = await fetch("/api/analysis/technical");
            const json = await res.json();
            if (json.data) setRows(json.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }

    const filteredRows = React.useMemo(() => {
        if (!rows) return [];
        let r = rows;
        if (filter) r = r.filter(row => row.symbol.toLowerCase().includes(filter.toLowerCase()));
        if (statusFilter === "good_entry") r = r.filter(row => row.status === "Good Entry");
        else if (statusFilter === "overpriced") r = r.filter(row => row.status === "Overpriced");
        else if (statusFilter === "neutral") r = r.filter(row => row.status === "Neutral");
        else if (statusFilter === "avoid") r = r.filter(row => row.status === "Avoid");

        if (statusFilter !== "avoid") r = r.filter(row => row.status !== "Avoid");
        return r;
    }, [rows, filter, statusFilter]);

    const topPicks = React.useMemo(() => {
        if (!rows) return [];
        return [...rows].filter(r => r.status === "Good Entry" && r.score >= 4).slice(0, 4);
    }, [rows]);

    const lastUpdated = React.useMemo(() => {
        if (!rows || rows.length === 0) return null;
        return new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    }, [rows]);

    return (
        <div className="w-full pb-20">
            <WavyBackground
                title="Technical Screener"
                subtitle="Real-time analysis using RSI divergences, MACD crossovers, Bollinger Bands, and foreign flow detection"
            >
            </WavyBackground>

            <main className="max-w-7xl mx-auto md:px-6 lg:px-8 md:-mt-20 relative z-10 pb-0 md:pb-12 space-y-6">

                {/* ── Main Screener Table ───────────────────────────────────────── */}
                <Card className="gap-0 border-0 sm:border border-gray-100 dark:border-white/10 shadow-none sm:shadow-xl shadow-blue-900/5 bg-transparent sm:bg-white sm:dark:bg-[#1e293b] rounded-none sm:rounded-xl">
                    <ScreenerControls
                        filter={filter}
                        setFilter={setFilter}
                        statusFilter={statusFilter}
                        setStatusFilter={setStatusFilter}
                        loading={loading}
                        onRefresh={fetchData}
                        totalCount={rows?.filter(r => r.status !== "Avoid").length}
                        filteredCount={filteredRows.length}
                    />
                    <CardContent className="p-0">
                        <ScreenerTable rows={filteredRows} loading={loading} />
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
