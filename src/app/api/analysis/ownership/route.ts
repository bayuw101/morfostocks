import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const sort = searchParams.get("sort") || "name";
        const dir = searchParams.get("dir") || "asc";
        const groupBy = searchParams.get("groupBy") || "stock"; // "stock" | "investor"

        // Get the latest date available
        const latestRecord = await prisma.ownership.findFirst({
            orderBy: { date: "desc" },
            select: { date: true },
        });

        if (!latestRecord) {
            return NextResponse.json({ data: [], latestDate: null });
        }

        const latestDate = latestRecord.date;

        // Fetch all ownership records for that date
        const whereClause: any = { date: latestDate };

        if (search) {
            whereClause.OR = [
                { stockSymbol: { contains: search, mode: "insensitive" } },
                { investorName: { contains: search, mode: "insensitive" } },
            ];
        }

        const records = await prisma.ownership.findMany({
            where: whereClause,
            orderBy: [{ stockSymbol: "asc" }, { percentage: "desc" }],
        });

        // Serialize BigInt helper
        const serializeRecord = (r: typeof records[0]) => ({
            ...r,
            scrip: r.scrip.toString(),
            scripless: r.scripless.toString(),
            total: r.total.toString(),
        });

        if (groupBy === "investor") {
            // Group by investorName
            const groupMap = new Map<string, {
                investorName: string;
                records: ReturnType<typeof serializeRecord>[];
                stockCount: number;
                totalShares: bigint;
            }>();

            for (const rec of records) {
                const key = rec.investorName;
                if (!groupMap.has(key)) {
                    groupMap.set(key, {
                        investorName: key,
                        records: [],
                        stockCount: 0,
                        totalShares: BigInt(0),
                    });
                }
                const g = groupMap.get(key)!;
                g.records.push(serializeRecord(rec));
                g.totalShares += rec.total;
            }

            const groups = Array.from(groupMap.values()).map((g) => {
                g.stockCount = g.records.length;
                g.records.sort((a, b) => b.percentage - a.percentage);
                return g;
            });

            // Apply sorting
            if (sort === "stocks") {
                groups.sort((a, b) => dir === "asc" ? a.stockCount - b.stockCount : b.stockCount - a.stockCount);
            } else if (sort === "shares") {
                groups.sort((a, b) => {
                    const diff = Number(dir === "asc" ? a.totalShares - b.totalShares : b.totalShares - a.totalShares);
                    return diff > 0 ? 1 : diff < 0 ? -1 : 0;
                });
            } else {
                groups.sort((a, b) => dir === "asc"
                    ? a.investorName.localeCompare(b.investorName)
                    : b.investorName.localeCompare(a.investorName)
                );
            }

            const serialized = groups.map((g) => ({
                ...g,
                totalShares: g.totalShares.toString(),
            }));

            return NextResponse.json({
                data: serialized,
                latestDate: latestDate.toISOString(),
                totalCount: groups.length,
                groupBy: "investor",
            });
        }

        // Default: group by stock
        const groupMap = new Map<string, {
            stockSymbol: string;
            records: typeof records;
            holderCount: number;
            pctSum: number;
            freeFloat: number;
        }>();

        for (const rec of records) {
            const key = rec.stockSymbol;
            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    stockSymbol: key,
                    records: [],
                    holderCount: 0,
                    pctSum: 0,
                    freeFloat: 0,
                });
            }
            groupMap.get(key)!.records.push(rec);
        }

        const groups = Array.from(groupMap.values()).map((g) => {
            g.holderCount = g.records.length;
            g.pctSum = g.records.reduce((s, r) => s + (r.percentage || 0), 0);
            g.freeFloat = Math.max(0, 100 - g.pctSum);
            g.records.sort((a, b) => b.percentage - a.percentage);
            return g;
        });

        if (sort === "freeFloat") {
            groups.sort((a, b) => dir === "asc" ? a.freeFloat - b.freeFloat : b.freeFloat - a.freeFloat);
        } else if (sort === "holders") {
            groups.sort((a, b) => dir === "asc" ? a.holderCount - b.holderCount : b.holderCount - a.holderCount);
        } else {
            groups.sort((a, b) => dir === "asc"
                ? a.stockSymbol.localeCompare(b.stockSymbol)
                : b.stockSymbol.localeCompare(a.stockSymbol)
            );
        }

        const serialized = groups.map((g) => ({
            ...g,
            records: g.records.map(serializeRecord),
        }));

        return NextResponse.json({
            data: serialized,
            latestDate: latestDate.toISOString(),
            totalCount: groups.length,
            groupBy: "stock",
        });
    } catch (e: any) {
        console.error("Ownership API error:", e);
        return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
    }
}
