import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { analyzeReference, OhlcItem, TechnicalScore } from "@/lib/tech-analysis";

const prisma = new PrismaClient();

// Concurrency helper
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
    const ret: R[] = [];
    const queue = [...items];
    const running: Promise<void>[] = [];

    async function runOne(item: T) {
        const r = await fn(item);
        // @ts-ignore
        ret.push(r);
    }

    while (queue.length > 0 || running.length > 0) {
        while (queue.length > 0 && running.length < limit) {
            const item = queue.shift()!;
            const p = runOne(item).then(() => {
                const idx = running.indexOf(p as unknown as Promise<void>);
                if (idx >= 0) running.splice(idx, 1);
            });
            running.push(p as unknown as Promise<void>);
        }
        if (running.length > 0) await Promise.race(running);
    }
    return ret;
}

export async function GET() {
    try {
        const stocks = await prisma.stock.findMany({
            select: { symbol: true }
        });

        const symbols = stocks.map(s => s.symbol);

        // Analyze all symbols concurrently
        const results = await mapWithConcurrency(symbols, 50, async (sym) => {
            // Fetch at least 200 days for 200 EMA to be accurate
            const ohlcRecords = await prisma.oHLC.findMany({
                where: { stockSymbol: sym },
                orderBy: { date: "desc" },
                take: 200,
            });

            if (!ohlcRecords || ohlcRecords.length < 30) return null; // Skip if insufficient data

            // The data is returned newest to oldest (DESC).
            // We need to shape it as OhlcItem for analyzeReference which expects Newest at index 0 (desc)
            // Wait, the lib function `analyzeReference` expects newer items at index 0?
            // "The newest is index 0 in original OHLC" - Yes.

            // Reconstruct the `change_percentage` and `change` from close/open or previous close
            // To properly reconstruct `change`, we iterate from oldest to newest.
            // But Prisma returns DESC. We need to reverse it to ASC to calculate change, then reverse back to DESC
            const ascRecords = [...ohlcRecords].reverse();

            const ascItems: OhlcItem[] = ascRecords.map((r, i) => {
                const prevClose = i > 0 ? ascRecords[i - 1].close : r.open; // Fallback to open if no prev close
                const change = r.close - prevClose;
                // Avoid division by zero
                const changePct = prevClose !== 0 ? (change / prevClose) * 100 : 0;

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

            // analyzeReference expects DESC (Newest at index 0)
            const ohlcItems = ascItems.reverse();

            const analysis = analyzeReference(ohlcItems);
            if (analysis) {
                analysis.symbol = sym;
                return analysis;
            }
            return null;
        });

        const validResults = results.filter(Boolean) as TechnicalScore[];

        // Sort by score descending by default
        validResults.sort((a, b) => b.score - a.score);

        return NextResponse.json({
            data: validResults,
            count: validResults.length,
            generatedAt: Date.now()
        });
    } catch (e: any) {
        console.error("Technical API Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
