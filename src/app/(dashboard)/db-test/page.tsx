"use client";

import { useEffect, useState } from "react";
import {
    getStocksAction,
    getStockCountAction,
    getOHLCCountAction,
    getBrokerCountAction,
} from "@/lib/actions/stock-actions";

type Stock = { symbol: string };

export default function DbTestPage() {
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [stockCount, setStockCount] = useState<number | null>(null);
    const [ohlcCount, setOhlcCount] = useState<number | null>(null);
    const [brokerCount, setBrokerCount] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const [stocksRes, stockCountRes, ohlcCountRes, brokerCountRes] =
                    await Promise.all([
                        getStocksAction(),
                        getStockCountAction(),
                        getOHLCCountAction(),
                        getBrokerCountAction(),
                    ]);

                if (stocksRes.success && stocksRes.data) {
                    setStocks(stocksRes.data);
                } else {
                    setError(stocksRes.error || "Failed to fetch stocks");
                }

                if (stockCountRes.success) setStockCount(stockCountRes.count ?? null);
                if (ohlcCountRes.success) setOhlcCount(ohlcCountRes.count ?? null);
                if (brokerCountRes.success)
                    setBrokerCount(brokerCountRes.count ?? null);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Unknown error");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    return (
        <div className="px-5">
            <h1 className="text-2xl font-bold mb-4">Database Connection Test</h1>

            {loading && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-blue-700 dark:text-blue-300">
                        Connecting to MySQL database...
                    </p>
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 mb-4">
                    <p className="text-red-700 dark:text-red-300 font-semibold">
                        ❌ Connection Error
                    </p>
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                        {error}
                    </p>
                </div>
            )}

            {!loading && !error && (
                <>
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 mb-6">
                        <p className="text-green-700 dark:text-green-300 font-semibold">
                            ✅ Connected to MySQL database successfully!
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border shadow-sm">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Total Stocks
                            </p>
                            <p className="text-3xl font-bold">
                                {stockCount?.toLocaleString() ?? "—"}
                            </p>
                        </div>
                        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border shadow-sm">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                OHLC Records
                            </p>
                            <p className="text-3xl font-bold">
                                {ohlcCount?.toLocaleString() ?? "—"}
                            </p>
                        </div>
                        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border shadow-sm">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Brokers
                            </p>
                            <p className="text-3xl font-bold">
                                {brokerCount?.toLocaleString() ?? "—"}
                            </p>
                        </div>
                    </div>

                    <h2 className="text-lg font-semibold mb-2">
                        Sample Stocks (first 10)
                    </h2>
                    <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-800">
                                <tr>
                                    <th className="px-4 py-2 text-left">#</th>
                                    <th className="px-4 py-2 text-left">Symbol</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stocks.map((stock, i) => (
                                    <tr
                                        key={stock.symbol}
                                        className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                    >
                                        <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                                        <td className="px-4 py-2 font-mono font-semibold">
                                            {stock.symbol}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
