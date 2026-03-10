"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { Database, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import localforage from "localforage";
import { syncStockLinerFromRecentOhlcAction, syncSymbolOhlcAction } from "@/lib/actions/collector-actions";
import { getStocksAction } from "@/lib/actions/reference-actions";

export default function OhlcCollector({ from, to }: { from: Date | null; to: Date | null }) {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("");

    const handleSyncAll = async () => {
        if (!from || !to) {
            toast.error("Please select a date range first.");
            return;
        }

        setLoading(true);
        setProgress(0);
        setStatusText("Fetching stock list...");

        try {
            const store = localforage.createInstance({ name: "morfostocks", storeName: "credentials" });
            const token = await store.getItem<string>("stockbit_token");

            if (!token) {
                toast.error("API Token not found. Please set it in the Header key icon.");
                setLoading(false);
                return;
            }

            const stocksRes = await getStocksAction();
            if (!stocksRes.ok || !stocksRes.data) {
                throw new Error(stocksRes.error || "Failed to load stocks");
            }

            const stocks = stocksRes.data;
            const targetSymbols = stocks.map((s: any) => s.symbol);
            if (!targetSymbols.includes("IHSG")) {
                targetSymbols.unshift("IHSG");
            }

            const total = targetSymbols.length;
            let count = 0;

            const fromStr = format(from, "yyyy-MM-dd");
            const toStr = format(to, "yyyy-MM-dd");

            let errors = 0;

            for (const symbol of targetSymbols) {
                count++;
                setStatusText(`Collecting ${symbol} (${count}/${total})`);

                try {
                    const res = await syncSymbolOhlcAction(symbol, token, fromStr, toStr);
                    if (!res.ok) {
                        console.warn(`Sync failed for ${symbol}:`, res.error);

                        if (res.error?.includes("Unauthorized") || res.error?.includes("Invalid Stockbit token")) {
                            throw new Error("Invalid Stockbit Token! Please reset your API keys in the header.");
                        }

                        if (res.error?.includes("No data fetched from API")) {
                            // Treat as a soft warning, skip error increment
                            console.info(`Skipping ${symbol} - No data available for this range.`);
                        } else {
                            errors++;
                            if (errors > 5) {
                                throw new Error("Too many consecutive errors. Fetching stopped.");
                            }
                        }
                    } else {
                        errors = 0; // reset error streak on success
                    }
                } catch (actionError: any) {
                    console.error(`Server Action threw an error for ${symbol}:`, actionError);
                    errors++;
                    if (errors > 5) {
                        throw new Error("Too many consecutive server action crashes. Fetching stopped.");
                    }
                }

                setProgress(Math.round((count / total) * 100));
                // Small delay to prevent rate limit
                await new Promise(r => setTimeout(r, 200));
            }

            setStatusText("Initializing stock liner (5-day turnover)...");
            const linerRes = await syncStockLinerFromRecentOhlcAction();
            if (!linerRes.ok) {
                toast.warning(`OHLC synced, but stock liner init failed: ${linerRes.error}`);
            } else {
                toast.success(
                    `Stock liner initialized (${linerRes.total} symbols): 1st ${linerRes.counts.first_liner}, 2nd ${linerRes.counts.second_liner}, 3rd ${linerRes.counts.third_liner}`
                );
            }

            setStatusText("Completed.");
            toast.success(`Successfully synced OHLC for ${total} symbols.`);

        } catch (err: any) {
            setStatusText(`Error: ${err.message}`);
            toast.error(`Sync error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSyncIhsgOnly = async () => {
        if (!from || !to) {
            toast.error("Please select a date range first.");
            return;
        }

        setLoading(true);
        setStatusText("Syncing IHSG only...");

        try {
            const store = localforage.createInstance({ name: "morfostocks", storeName: "credentials" });
            const token = await store.getItem<string>("stockbit_token");

            if (!token) {
                toast.error("API Token not found.");
                setLoading(false);
                return;
            }

            const fromStr = format(from, "yyyy-MM-dd");
            const toStr = format(to, "yyyy-MM-dd");

            const res = await syncSymbolOhlcAction("IHSG", token, fromStr, toStr);
            console.log("IHSG Sync Result:", res);

            if (res.ok) {
                toast.success(`IHSG synced. Fetched: ${res.fetched}, Inserted: ${res.inserted}`);
                setStatusText(`IHSG Synced: ${res.inserted} records.`);
            } else {
                toast.error(`IHSG Sync failed: ${res.error}`);
                setStatusText(`Error: ${res.error}`);
            }
        } catch (err: any) {
            toast.error(`Sync error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mr-4">
                    <Database className="h-3.5 w-3.5" />
                    <span>Fetches OHLCV data sequentially for all available symbols from Stockbit</span>
                </div>

                <div className="flex gap-2">
                    <Button
                        onClick={handleSyncIhsgOnly}
                        disabled={loading || !from || !to}
                        size="sm"
                        variant="outline"
                        className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    >
                        Sync IHSG Only
                    </Button>
                    <Button
                        onClick={handleSyncAll}
                        disabled={loading || !from || !to}
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? "Syncing..." : "Collect All"}
                    </Button>
                </div>
            </div>

            {(loading || progress > 0) && (
                <div className="space-y-2 mt-2 bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/10">
                    <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                        <span>{statusText}</span>
                        <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                </div>
            )}
        </div>
    );
}
