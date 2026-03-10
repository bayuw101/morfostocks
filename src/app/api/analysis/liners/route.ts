import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type LinerKey = "first_liner" | "second_liner" | "third_liner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeSymbol(symbol: string): string {
    return symbol.trim().toUpperCase().replace(/\..*$/, "");
}

function normalizeLiner(rawLiner: string): LinerKey | null {
    const normalized = rawLiner.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (normalized === "first_liner" || normalized === "firstliner") return "first_liner";
    if (normalized === "second_liner" || normalized === "secondliner") return "second_liner";
    if (normalized === "third_liner" || normalized === "thirdliner") return "third_liner";
    return null;
}

export async function GET() {
    try {
        const liners = await prisma.stockLiner.findMany({
            select: {
                stockSymbol: true,
                liner: true,
            },
        });

        const symbolToLiner: Record<string, LinerKey> = {};
        const counts: Record<string, number> = {
            first_liner: 0,
            second_liner: 0,
            third_liner: 0,
        };

        for (const entry of liners) {
            const liner = normalizeLiner(entry.liner);
            const symbol = normalizeSymbol(entry.stockSymbol);
            if (!liner || !symbol) continue;

            symbolToLiner[symbol] = liner;
            counts[liner] = (counts[liner] || 0) + 1;
        }

        return NextResponse.json(
            {
                symbolToLiner,
                counts,
                source: "database",
            },
            {
                headers: {
                    "Cache-Control": "no-store, max-age=0",
                },
            }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to read liner mapping";
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
