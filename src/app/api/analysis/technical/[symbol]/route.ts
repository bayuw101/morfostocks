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

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ symbol: string }> }
) {
    const { symbol: rawSymbol } = await params;
    const symbol = rawSymbol.toUpperCase();

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
        date: { gte: oldestDate }
      },
    });

    const brokerHistoryMap = new Map<string, Record<string, number>>();
    for (const tx of brokerTransactions) {
      const dStr = tx.date.toISOString().split("T")[0];
      if (!brokerHistoryMap.has(dStr)) brokerHistoryMap.set(dStr, {});
      
      const val = Number(tx.value);
      const isBuy = tx.action === "BUY" || tx.action === "B";
      const signedVal = isBuy ? val : -val;

      const current = brokerHistoryMap.get(dStr)![tx.brokerCode] || 0;
      brokerHistoryMap.get(dStr)![tx.brokerCode] = current + signedVal;
    }

        // Sort DateBrokerData chronological (Oldest first)
        const brokerHistory = Array.from(brokerHistoryMap.entries())
            .map(([date, brokers]) => ({ date, brokers }))
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
            fundamental_scores: fundamentalScores
        });

    } catch (e: any) {
        console.error("Technical Detail API Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
