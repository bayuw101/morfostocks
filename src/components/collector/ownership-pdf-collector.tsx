"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CloudDownload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { syncOwnershipIdxAction } from "@/lib/actions/collector-actions";

interface OwnershipPdfCollectorProps {
    from?: Date | null;
    to?: Date | null;
}

export default function OwnershipPdfCollector({ from, to }: OwnershipPdfCollectorProps) {
    const [status, setStatus] = useState<"idle" | "syncing" | "success" | "skipped" | "error">("idle");
    const [message, setMessage] = useState<string>("");
    const [details, setDetails] = useState<string>("");

    const handleSync = async () => {
        if (!from || !to) {
            setStatus("error");
            setMessage("Date range missing");
            setDetails("Please select a valid date range from the global picker first.");
            return;
        }

        setStatus("syncing");
        setMessage("Fetching and processing 1% ownership data from IDX...");
        setDetails("");

        try {
            const dateFromStr = format(from, "yyyyMMdd");
            const dateToStr = format(to, "yyyyMMdd");

            const result = await syncOwnershipIdxAction(dateFromStr, dateToStr);

            if (result.ok) {
                if (result.skipped) {
                    setStatus("skipped");
                    setMessage("Already Up-to-Date");
                } else {
                    setStatus("success");
                    setMessage("Sync Successful");
                }
                setDetails(result.details || `Processed ${result.count} rows.`);
            } else {
                setStatus("error");
                setMessage("Failed to sync ownership data");
                setDetails(result.error || "Unknown error occurred");
            }
        } catch (error: any) {
            setStatus("error");
            setMessage("An unexpected error occurred");
            setDetails(error?.message || String(error));
        }
    };

    return (
        <Card className="w-full border-0 shadow-none bg-transparent sm:bg-white sm:shadow-sm sm:border sm:border-slate-200 dark:sm:bg-slate-900/50 dark:sm:border-slate-800">
            <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-lg flex items-center gap-2">
                    <CloudDownload className="w-5 h-5 text-indigo-500" />
                    Automated IDX Sync
                </CardTitle>
                <CardDescription>
                    Automatically fetch, parse, and store the "Laporan Total Kepemilikan Saham Investor di bawah 1%" from KSEI announcements for the selected date range.
                </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 space-y-4">
                <div className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <p>Current Time Filter:</p>
                    <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="flex-1">
                            <span className="font-semibold block text-xs uppercase text-slate-500">From</span>
                            <span className="text-slate-900 dark:text-slate-100">{from ? format(from, "dd MMM yyyy") : "Not selected"}</span>
                        </div>
                        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
                        <div className="flex-1">
                            <span className="font-semibold block text-xs uppercase text-slate-500">To</span>
                            <span className="text-slate-900 dark:text-slate-100">{to ? format(to, "dd MMM yyyy") : "Not selected"}</span>
                        </div>
                    </div>
                </div>

                {status === "error" && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>
                            {message}
                            {details && <span className="block mt-1 text-xs opacity-80">{details}</span>}
                        </AlertDescription>
                    </Alert>
                )}

                {status === "success" && (
                    <Alert variant="default" className="bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/30">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <AlertTitle>Success</AlertTitle>
                        <AlertDescription>
                            {message}
                            {details && <span className="block mt-1 text-xs opacity-80">{details}</span>}
                        </AlertDescription>
                    </Alert>
                )}

                {status === "skipped" && (
                    <Alert variant="default" className="bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/30">
                        <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <AlertTitle>Skipped</AlertTitle>
                        <AlertDescription>
                            {message}
                            {details && <span className="block mt-1 text-xs opacity-80">{details}</span>}
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
            <CardFooter className="px-4 sm:px-6 flex justify-end">
                <Button
                    onClick={handleSync}
                    disabled={!from || !to || status === "syncing"}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                    {status === "syncing" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {status === "syncing" ? "Syncing..." : "Sync from IDX"}
                </Button>
            </CardFooter>
        </Card>
    );
}
