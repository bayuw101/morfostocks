import { NextResponse } from "next/server";
import { format, parseISO, subDays, eachDayOfInterval, isSaturday, isSunday } from "date-fns";
import prisma from "@/lib/prisma";
import { fetchAllRunningTradesForDate, buildDailyEntry } from "@/lib/collectors/tier-flow";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    let rawBody;
    try {
        rawBody = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { targetSymbols, token, from, to } = rawBody;

    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });
    if (!targetSymbols || !Array.isArray(targetSymbols)) return NextResponse.json({ error: "Missing targetSymbols array" }, { status: 400 });

    const encoder = new TextEncoder();

    // We create a TransformStream so we can write chunks and the client can read them as Server-Sent Events
    const customReadable = new ReadableStream({
        async start(controller) {
            function sendEvent(data: object) {
                const message = `data: ${JSON.stringify(data)}\n\n`;
                controller.enqueue(encoder.encode(message));
            }

            try {
                const now = new Date();
                const endDate = to ? parseISO(to) : now;
                const startDate = from ? parseISO(from) : subDays(endDate, 7);
                const range = eachDayOfInterval({ start: startDate, end: endDate });

                const fetchDates: string[] = [];
                for (const d of range) {
                    if (!isSaturday(d) && !isSunday(d)) {
                        fetchDates.push(format(d, "yyyy-MM-dd"));
                    }
                }

                if (!fetchDates.length) {
                    sendEvent({ type: "done", message: "No valid weekdays" });
                    controller.close();
                    return;
                }

                let totalSymbolsProcessed = 0;
                let totalSymbolsErrors = 0;
                const totalSymbolsCount = targetSymbols.length;

                for (const symbol of targetSymbols) {
                    let symbolFetchedAny = false;
                    let symbolErrorCount = 0;

                    sendEvent({ type: "symbol_start", symbol, current: totalSymbolsProcessed + 1, total: totalSymbolsCount });

                    for (const dateStr of fetchDates) {
                        try {
                            const ohlcData = await prisma.oHLC.findUnique({
                                where: { stockSymbol_date: { stockSymbol: symbol, date: new Date(dateStr) } },
                                select: { frequency: true }
                            });
                            const maxTrades = ohlcData?.frequency || 0;

                            const rawTrades = await fetchAllRunningTradesForDate(
                                symbol,
                                dateStr,
                                token,
                                (tradeNumber, totalTradesFetched) => {
                                    sendEvent({ type: "page_progress", symbol, date: dateStr, tradeNumber, totalTradesFetched, maxTrades });
                                }
                            );

                            if (rawTrades.length === 0) continue;
                            symbolFetchedAny = true;

                            sendEvent({ type: "parsing", symbol, date: dateStr });
                            const entry = buildDailyEntry(symbol, dateStr, rawTrades);

                            const stockExists = await prisma.stock.findUnique({ where: { symbol } });
                            if (!stockExists) {
                                await prisma.stock.create({ data: { symbol } });
                            }

                            await prisma.bidOffer.upsert({
                                where: {
                                    stockSymbol_date: {
                                        stockSymbol: symbol,
                                        date: new Date(dateStr)
                                    }
                                },
                                update: { tiers: entry as any },
                                create: { stockSymbol: symbol, date: new Date(dateStr), tiers: entry as any }
                            });

                            symbolErrorCount = 0;

                        } catch (err: any) {
                            console.error(`Error processing BidOffer for ${symbol} on ${dateStr}:`, err);
                            const errorMsg = err?.message || String(err);

                            if (errorMsg.includes("Unauthorized") || errorMsg.includes("rate limit")) {
                                sendEvent({ type: "error", symbol, message: errorMsg, isFatal: true });
                                controller.close();
                                return;
                            } else {
                                sendEvent({ type: "error", symbol, message: errorMsg, isFatal: false });
                                symbolErrorCount++;
                                if (symbolErrorCount > 5) {
                                    sendEvent({ type: "error", symbol, message: "Too many consecutive errors for symbol", isFatal: true });
                                    controller.close();
                                    return;
                                }
                            }
                        }
                    }

                    totalSymbolsProcessed++;
                    if (!symbolFetchedAny) totalSymbolsErrors++;

                    await new Promise(r => setTimeout(r, 600)); // Rate limit buffer between symbols
                }

                sendEvent({ type: "done", total: totalSymbolsCount, errors: totalSymbolsErrors });
            } catch (err: any) {
                sendEvent({ type: "error", message: err.message, isFatal: true });
            } finally {
                controller.close();
            }
        }
    });

    return new Response(customReadable, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    });
}
