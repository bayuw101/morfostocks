"use client";

import React, { useState } from "react";
import { Database, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import localforage from "localforage";
import { syncFundamentalAction } from "@/lib/actions/collector-actions";
import { getStocksAction } from "@/lib/actions/reference-actions";

export default function FundamentalCollector() {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("");

    const handleSyncAll = async () => {
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

            const total = targetSymbols.length;
            let count = 0;
            let errors = 0;

            for (const symbol of targetSymbols) {
                count++;
                setStatusText(`Collecting ${symbol} (${count}/${total})`);

                try {
                    const res = await syncFundamentalAction(symbol, token);
                    if (!res.ok) {
                        console.warn(`Sync failed for ${symbol}:`, res.error);

                        if (res.error?.includes("Unauthorized") || res.error?.includes("Invalid Stockbit token")) {
                            throw new Error("Invalid Stockbit Token! Please reset your API keys in the header.");
                        }

                        errors++;
                        if (errors > 100) {
                            throw new Error("Too many consecutive errors. Fetching stopped.");
                        }
                    } else {
                        if (errors > 0) console.log(`[Fundamental] Recovered at ${symbol}`);
                        errors = 0;
                    }
                } catch (actionError: any) {
                    console.error(`Error for ${symbol}:`, actionError);
                    errors++;
                    if (errors > 100) {
                        throw new Error("Too many consecutive crashes. Fetching stopped.");
                    }
                }

                setProgress(Math.round((count / total) * 100));
                // Small delay to prevent aggressive rate limit
                await new Promise(r => setTimeout(r, 150));
            }

            setStatusText("Completed.");
            toast.success(`Successfully synced Fundamentals for ${total} symbols.`);

        } catch (err: any) {
            setStatusText(`Error: ${err.message}`);
            toast.error(`Sync error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleTestSingle = async () => {
        setLoading(true);
        setStatusText("Testing BBRI...");
        try {
            const store = localforage.createInstance({ name: "morfostocks", storeName: "credentials" });
            const token = await store.getItem<string>("stockbit_token");
            if (!token) {
                toast.error("Token missing");
                setLoading(false);
                return;
            }
            const res = await syncFundamentalAction("BBRI", token);
            console.log("[Fundamental Test] Result:", res);
            if (res.ok) {
                toast.success("BBRI Sync Test Successful!");
            } else {
                toast.error("BBRI Sync Test Failed: " + res.error);
            }
        } catch (err: any) {
            toast.error("Test Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mr-4">
                    <Database className="h-3.5 w-3.5" />
                    <span>Fetches latest fundamental ratios and key stats (10yr history) from Stockbit</span>
                </div>

                <div className="flex gap-2">
                    <Button
                        onClick={handleTestSingle}
                        disabled={loading}
                        size="sm"
                        variant="outline"
                        className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    >
                        Test BBRI
                    </Button>
                    <Button
                        onClick={handleSyncAll}
                        disabled={loading}
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
