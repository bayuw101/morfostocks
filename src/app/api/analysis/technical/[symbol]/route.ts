import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
    OhlcItem,
    calculateRSISeries,
    calculateMACDSeries,
    calculateBBSeries,
} from "@/lib/tech-analysis";
import { loadFundamental, analyzeFundamentalScores } from "@/lib/fundamentals";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ symbol: string }> }
) {
    const { symbol: rawSymbol } = await params;
    const symbol = rawSymbol.toUpperCase();

    const { searchParams } = new URL(request.url);
    const investorType = searchParams.get("type") || "Total";

    try {
        // 1. Fetch OHLC data for the chart. Let's get up to 400 days to allow deep zooming
        const ohlcRecords = await prisma.oHLC.findMany({
            where: { stockSymbol: symbol },
            orderBy: { date: "desc" },
            take: 400,
        });

        if (!ohlcRecords || ohlcRecords.length < 30) {
            return NextResponse.json({ error: "Insufficient data" }, { status: 400 });
        }

        // 2. Load Broker History (Top 200 days = safe).
        // Broker table has 'date', 'brokerCode', 'action', 'value'.
        const recentDates = await prisma.oHLC.findMany({
            where: { stockSymbol: symbol },
            orderBy: { date: "desc" },
            take: 200,
            select: { date: true }
        });

        // Fallback if no dates
        const oldestDate = recentDates.length > 0 ? recentDates[recentDates.length - 1].date : new Date(0);

        const brokerTransactions = await prisma.brokerTransaction.findMany({
            where: {
                stockSymbol: symbol,
                date: { gte: oldestDate },
                investorType: investorType
            },
        });

        const brokerHistoryMap = new Map<string, Record<string, { lot: number, value: number }>>();
        for (const tx of brokerTransactions) {
            const dStr = tx.date.toISOString().split("T")[0];
            if (!brokerHistoryMap.has(dStr)) brokerHistoryMap.set(dStr, {});

            const isBuy = tx.action === "BUY" || tx.action === "B";

            // Units: Lots (for Chart)
            let lots = Number(tx.volume);
            const val = Number(tx.value);
            const avgPrice = Number(tx.avgPrice);

            // Dynamically detect if Stockbit returned 'volume' as Shares instead of Lots
            // If val / volume ~= avgPrice * 100, then volume is Lots.
            // If val / volume ~= avgPrice, then volume is Shares.
            if (lots > 0 && avgPrice > 0) {
                const ratio = val / lots;
                if (ratio < avgPrice * 10) {
                    // It's in Shares, convert to Lots
                    lots = lots / 100;
                }
            }

            const signedLots = isBuy ? lots : -lots;

            // Units: Value (for Sidebar display)
            const signedVal = isBuy ? val : -val;

            const current = brokerHistoryMap.get(dStr)![tx.brokerCode] || { lot: 0, value: 0 };
            brokerHistoryMap.get(dStr)![tx.brokerCode] = {
                lot: current.lot + signedLots,
                value: current.value + signedVal
            };

            // Also track a 'total_net' for this specific investor group (Total or Foreign)
            const currentTotal = brokerHistoryMap.get(dStr)!["total_net"] || { lot: 0, value: 0 };
            brokerHistoryMap.get(dStr)!["total_net"] = {
                lot: currentTotal.lot + signedLots,
                value: currentTotal.value + signedVal
            };
        }


        // Sort DateBrokerData chronological (Oldest first)
        const brokerHistory = Array.from(brokerHistoryMap.entries())
            .map(([date, brokers]) => ({ date, brokers: brokers }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // 3. Load Fundamentals
        const fundamentalData = await loadFundamental(symbol);
        const fundamentalScores = fundamentalData ? analyzeFundamentalScores(fundamentalData) : null;

        // 4. Sort Ascending for Charting (Oldest -> Newest)
        const chartDataRev = [...ohlcRecords].reverse();

        // Convert to OhlcItem
        const chartData: OhlcItem[] = chartDataRev.map((r, i) => {
            const prevClose = i > 0 ? chartDataRev[i - 1].close : r.open;
            const change = r.close - prevClose;
            const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
            return {
                date: r.date.toISOString().split('T')[0],
                open: r.open,
                high: r.high,
                low: r.low,
                close: r.close,
                volume: Number(r.volume),
                change: change,
                change_percentage: changePct,
                foreign_buy: Number(r.foreignBuy),
                foreign_sell: Number(r.foreignSell),
                net_foreign: Number(r.netForeign),
            };
        });

        const closes = chartData.map(d => d.close);

        // 5. Compute Technical Indicators (Chronological Oldest to Newest)
        const rsi = calculateRSISeries(closes);
        const macd = calculateMACDSeries(closes);
        const bb = calculateBBSeries(closes);

        // Volume MA
        const vols = chartData.map(d => d.volume);
        const volMaSeries: (number | null)[] = [];
        for (let i = 0; i < vols.length; i++) {
            if (i < 19) { volMaSeries.push(null); continue; }
            const slice = vols.slice(i - 19, i + 1);
            const sum = slice.reduce((a, b) => a + b, 0);
            volMaSeries.push(sum / 20);
        }

        // Merge into single object per timestamp
        const merged = chartData.map((item, i) => ({
            ...item,
            rsi: rsi[i],
            macd: macd.macd[i],
            macd_signal: macd.signal[i],
            macd_hist: macd.hist[i],
            bb_upper: bb.upper[i],
            bb_lower: bb.lower[i],
            bb_middle: bb.middle[i],
            vol_ma: volMaSeries[i],
        }));

        return NextResponse.json({
            symbol,
            data: merged,
            brokers: brokerHistory,
            fundamental_scores: fundamentalScores,
            fundamental_data: fundamentalData
        });

    } catch (e: any) {
        console.error("Technical Detail API Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
