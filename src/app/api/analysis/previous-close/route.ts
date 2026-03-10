import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeSymbol(symbol: string): string {
    return symbol.trim().toUpperCase().replace(/\..*$/, "");
}

export async function GET() {
    try {
        const latestBySymbol = await prisma.oHLC.groupBy({
            by: ["stockSymbol"],
            _max: { date: true },
        });

        if (latestBySymbol.length === 0) {
            return NextResponse.json(
                {
                    latestDate: null,
                    symbolToPrevClose: {},
                    count: 0,
                },
                {
                    headers: {
                        "Cache-Control": "no-store, max-age=0",
                    },
                }
            );
        }

        const pairs = latestBySymbol
            .filter((row) => !!row._max.date)
            .map((row) => ({ stockSymbol: row.stockSymbol, date: row._max.date! }));

        const rows: Array<{ stockSymbol: string; close: number }> = [];
        const chunkSize = 250;

        for (let i = 0; i < pairs.length; i += chunkSize) {
            const chunk = pairs.slice(i, i + chunkSize);
            const result = await prisma.oHLC.findMany({
                where: {
                    OR: chunk.map((item) => ({
                        stockSymbol: item.stockSymbol,
                        date: item.date,
                    })),
                },
                select: {
                    stockSymbol: true,
                    close: true,
                },
            });
            rows.push(...result);
        }

        const symbolToPrevClose: Record<string, number> = {};
        for (const row of rows) {
            const symbol = normalizeSymbol(row.stockSymbol);
            const close = Number(row.close);
            if (!symbol || !Number.isFinite(close) || close <= 0) continue;
            symbolToPrevClose[symbol] = close;
        }

        return NextResponse.json(
            {
                latestDate: null,
                symbolToPrevClose,
                count: Object.keys(symbolToPrevClose).length,
            },
            {
                headers: {
                    "Cache-Control": "no-store, max-age=0",
                },
            }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to read previous close mapping";
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
