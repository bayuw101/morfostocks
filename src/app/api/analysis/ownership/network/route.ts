import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface GraphNode {
    id: string;
    type: "stock" | "investor";
    label: string;
    depth: number;
    percentage?: number;
    investorType?: string;
    localForeign?: string;
    totalShares?: string;
}

interface GraphLink {
    source: string;
    target: string;
    depth: number;
    width: number;
    percentage: number;
    totalShares: string;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const stock = searchParams.get("stock");
        const investor = searchParams.get("investor");
        const mode = stock ? "stock" : "investor";
        const centerKey = stock || investor;

        if (!centerKey) {
            return NextResponse.json({ error: "Provide ?stock= or ?investor= parameter" }, { status: 400 });
        }

        // Get latest date
        const latestRecord = await prisma.ownership.findFirst({
            orderBy: { date: "desc" },
            select: { date: true },
        });

        if (!latestRecord) {
            return NextResponse.json({ nodes: [], links: [] });
        }

        const latestDate = latestRecord.date;
        const nodes: GraphNode[] = [];
        const links: GraphLink[] = [];
        const nodeIds = new Set<string>();

        if (mode === "stock") {
            // Stock-centric: stock → investors → their other stocks
            const centerNodeId = "stock_" + centerKey;
            nodes.push({ id: centerNodeId, type: "stock", label: centerKey!, depth: 0 });
            nodeIds.add(centerNodeId);

            // Level 1: investors holding this stock (top 15)
            const holders = await prisma.ownership.findMany({
                where: { date: latestDate, stockSymbol: centerKey! },
                orderBy: { percentage: "desc" },
                take: 15,
            });

            for (const rec of holders) {
                const invId = "inv_" + rec.investorName;
                if (!nodeIds.has(invId)) {
                    nodes.push({
                        id: invId, type: "investor", label: rec.investorName, depth: 1,
                        percentage: rec.percentage, investorType: rec.investorType,
                        localForeign: rec.localForeign,
                    });
                    nodeIds.add(invId);
                }
                links.push({
                    source: centerNodeId, target: invId, depth: 1,
                    width: Math.max(1.5, (rec.percentage || 0) / 5),
                    percentage: rec.percentage,
                    totalShares: rec.total.toString(),
                });
            }

            // Level 2: other stocks held by those investors (top 5 per investor)
            for (const rec of holders) {
                const invId = "inv_" + rec.investorName;
                const otherStocks = await prisma.ownership.findMany({
                    where: {
                        date: latestDate,
                        investorName: rec.investorName,
                        stockSymbol: { not: centerKey! },
                    },
                    orderBy: { percentage: "desc" },
                    take: 5,
                });

                for (const s of otherStocks) {
                    const stockId = "stock_" + s.stockSymbol;
                    if (!nodeIds.has(stockId)) {
                        nodes.push({ id: stockId, type: "stock", label: s.stockSymbol, depth: 2 });
                        nodeIds.add(stockId);
                    }
                    const hasLink = links.some(
                        (l) => l.source === invId && l.target === stockId
                    );
                    if (!hasLink) {
                        links.push({
                            source: invId, target: stockId, depth: 2,
                            width: Math.max(1, (s.percentage || 0) / 8),
                            percentage: s.percentage,
                            totalShares: s.total.toString(),
                        });
                    }
                }
            }
        } else {
            // Investor-centric: investor → stocks → other holders
            const centerNodeId = "inv_" + centerKey;
            nodes.push({ id: centerNodeId, type: "investor", label: centerKey!, depth: 0 });
            nodeIds.add(centerNodeId);

            // Level 1: stocks this investor holds
            const stocks = await prisma.ownership.findMany({
                where: { date: latestDate, investorName: centerKey! },
                orderBy: { percentage: "desc" },
            });

            for (const s of stocks) {
                const stockId = "stock_" + s.stockSymbol;
                if (!nodeIds.has(stockId)) {
                    nodes.push({ id: stockId, type: "stock", label: s.stockSymbol, depth: 1 });
                    nodeIds.add(stockId);
                }
                links.push({
                    source: centerNodeId, target: stockId, depth: 1,
                    width: Math.max(1.5, (s.percentage || 0) / 5),
                    percentage: s.percentage,
                    totalShares: s.total.toString(),
                });
            }

            // Level 2: top 3 other holders per stock
            for (const s of stocks) {
                const stockId = "stock_" + s.stockSymbol;
                const otherHolders = await prisma.ownership.findMany({
                    where: {
                        date: latestDate,
                        stockSymbol: s.stockSymbol,
                        investorName: { not: centerKey! },
                    },
                    orderBy: { percentage: "desc" },
                    take: 3,
                });

                for (const h of otherHolders) {
                    const invId = "inv_" + h.investorName;
                    if (!nodeIds.has(invId)) {
                        nodes.push({
                            id: invId, type: "investor", label: h.investorName, depth: 2,
                            percentage: h.percentage, investorType: h.investorType,
                            localForeign: h.localForeign,
                        });
                        nodeIds.add(invId);
                    }
                    const hasLink = links.some(
                        (l) => l.source === stockId && l.target === invId
                    );
                    if (!hasLink) {
                        links.push({
                            source: stockId, target: invId, depth: 2,
                            width: Math.max(1, (h.percentage || 0) / 8),
                            percentage: h.percentage,
                            totalShares: h.total.toString(),
                        });
                    }
                }
            }
        }

        return NextResponse.json({ nodes, links, center: (mode === "stock" ? "stock_" : "inv_") + centerKey });
    } catch (e: any) {
        console.error("Ownership network API error:", e);
        return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
    }
}
