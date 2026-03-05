"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { Database, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import localforage from "localforage";
import { syncBrokerAction } from "@/lib/actions/collector-actions";
import { getBrokersAction } from "@/lib/actions/reference-actions";

export default function BrokerCollector({ from, to }: { from: Date | null; to: Date | null }) {
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
        setStatusText("Fetching broker list...");

        try {
            const store = localforage.createInstance({ name: "morfostocks", storeName: "credentials" });
            const token = await store.getItem<string>("stockbit_token");

            if (!token) {
                toast.error("API Token not found. Please set it in the Header key icon.");
                setLoading(false);
                return;
            }

            const brokersRes = await getBrokersAction();
            if (!brokersRes.ok || !brokersRes.data) {
                throw new Error(brokersRes.error || "Failed to load brokers");
            }

            const brokers = brokersRes.data;
            const total = brokers.length;
            let count = 0;

            const fromStr = format(from, "yyyy-MM-dd");
            const toStr = format(to, "yyyy-MM-dd");

            let errors = 0;

            for (const broker of brokers) {
                count++;
                setStatusText(`Collecting ${broker.code} (${count}/${total})`);

                try {
                    const res = await syncBrokerAction(broker.code, token, fromStr, toStr);
                    if (!res.ok) {
                        console.warn(`Sync failed for ${broker.code}:`, res.error);

                        if (res.error?.includes("Unauthorized") || res.error?.includes("Invalid Stockbit token")) {
                            throw new Error("Invalid Stockbit Token! Please reset your API keys in the header.");
                        }

                        errors++;
                        if (errors > 5) {
                            throw new Error("Too many consecutive errors. Fetching stopped.");
                        }
                    } else {
                        errors = 0; // reset error streak on success
                    }
                } catch (actionError: any) {
                    console.error(`Server Action threw an error for ${broker.code}:`, actionError);
                    errors++;
                    if (errors > 5) {
                        throw new Error("Too many consecutive server action crashes. Fetching stopped.");
                    }
                }

                setProgress(Math.round((count / total) * 100));
                // Small delay to prevent rate limit (Broker fetching hits two endpoints per day per broker)
                await new Promise(r => setTimeout(r, 600));
            }

            setStatusText("Completed.");
            toast.success(`Successfully synced Broker data for ${total} brokers.`);

        } catch (err: any) {
            setStatusText(`Error: ${err.message}`);
            toast.error(`Sync error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1 text-xs text-muted-foreground mr-4">
                    <div className="flex items-center gap-2">
                        <Database className="h-3.5 w-3.5" />
                        <span>Fetches Broker Summary and Broker Transaction data from Stockbit.</span>
                    </div>
                    <span className="text-muted-foreground/80 pl-5">⚠️ This is very slow. It fetches Total and Foreign data day-by-day for 100+ brokers.</span>
                </div>

                <Button
                    onClick={handleSyncAll}
                    disabled={loading || !from || !to}
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]"
                >
                    <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? "Syncing..." : "Collect All"}
                </Button>
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
