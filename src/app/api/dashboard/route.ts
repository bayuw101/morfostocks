import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getRankedFundamentals } from "@/lib/fundamentals";

export async function GET() {
    try {
        // 1. Get total stock count and fundamentals count
        const totalStocks = await prisma.oHLC.groupBy({
            by: ['stockSymbol'],
        });
        const totalFundamentals = await prisma.fundamental.count();

        // 2. Get latest date in the database
        const latestOhlc = await prisma.oHLC.findFirst({
            orderBy: { date: 'desc' },
            select: { date: true }
        });
        const latestDate = latestOhlc?.date;

        // 3. Get IHSG (Composite) data for the chart - approx last 3 months (60 days)
        // If COMPOSITE symbol exists, use it. Usually it's ^JKSE etc. Let's just find the most common ones or default empty.
        // Or if we don't have IHSG, we'll just return overall market volume trend. (Let's check if ^JKSE exists)
        const ihsgHistory = await prisma.oHLC.findMany({
            where: { stockSymbol: "^JKSE" }, // Adjust if symbol is different
            orderBy: { date: 'asc' },
            take: -60, // Last 60 records
        });

        // 4. Get Top Movers (Gainers / Losers) from the latest date
        let topGainers: any[] = [];
        let topLosers: any[] = [];
        let totalForeignFlow = 0;

        if (latestDate) {
            // Find records for the latest date & the previous date to calculate change safely,
            // or just use open/close from the latest date if that's all we have.
            const latestRecords = await prisma.oHLC.findMany({
                where: { date: latestDate }
            });

            const movers = latestRecords.map((r: any) => {
                const changePct = r.open > 0 ? ((r.close - r.open) / r.open) * 100 : 0;
                totalForeignFlow += (r.netForeign || 0);
                return {
                    symbol: r.stockSymbol,
                    close: r.close,
                    changePct,
                    volume: r.volume
                };
            });

            movers.sort((a, b) => b.changePct - a.changePct);

            // Filter out 0% change and low volume noise if necessary
            const activeMovers = movers.filter(m => m.volume > 100000);

            topGainers = activeMovers.slice(0, 5);
            // Losers are at the bottom of the active movers list
            topLosers = activeMovers.reverse().slice(0, 5).filter(m => m.changePct < 0);
        }

        // 5. Get Top Fundamental Scores
        const rankedFund = await getRankedFundamentals();
        const topFundamentals = rankedFund.slice(0, 5).map(f => ({
            symbol: f.symbol,
            score: f.score,
            per: f.per,
            roe: f.roe
        }));

        return NextResponse.json({
            stats: {
                totalStocks: totalStocks.length,
                totalFundamentals,
                latestDate,
                totalForeignFlow
            },
            ihsgHistory: ihsgHistory.length > 0 ? ihsgHistory : null,
            topGainers,
            topLosers,
            topFundamentals
        });

    } catch (e: any) {
        console.error("Dashboard API error:", e);
        return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
    }
}
