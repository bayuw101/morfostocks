"use server";

import prisma from "@/lib/prisma";

export async function getTopValuedSymbolsAction(limit: number = 200, fromDate?: string, toDate?: string) {
    try {
        const whereClause: any = {};
        if (fromDate && toDate) {
            whereClause.date = {
                gte: new Date(fromDate),
                lte: new Date(toDate)
            };
        } else if (fromDate) {
            whereClause.date = { gte: new Date(fromDate) };
        } else if (toDate) {
            whereClause.date = { lte: new Date(toDate) };
        }

        // Group by symbol to find top traded across the selected date range
        // Based on OHLCV data value
        const top = await prisma.oHLC.groupBy({
            by: ['stockSymbol'],
            where: whereClause,
            _sum: { value: true },
            orderBy: { _sum: { value: 'desc' } },
            take: limit
        });

        return { ok: true, data: top.map(t => t.stockSymbol) };
    } catch (error: any) {
        console.error("Failed to fetch top symbols:", error);
        return { ok: false, error: error.message };
    }
}

export async function getExistingBidOfferSymbolsAction() {
    try {
        const existing = await prisma.bidOffer.findMany({
            select: { stockSymbol: true },
            distinct: ['stockSymbol']
        });
        return { ok: true, data: existing.map(e => e.stockSymbol) };
    } catch (error: any) {
        console.error("Failed to fetch existing BidOffer symbols:", error);
        return { ok: false, error: error.message };
    }
}
