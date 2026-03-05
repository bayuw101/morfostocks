"use server";

import prisma from "@/lib/prisma";

export async function getStocksAction() {
    try {
        const stocks = await prisma.stock.findMany({
            take: 10,
            orderBy: { symbol: "asc" },
        });
        return { success: true, data: stocks };
    } catch (error) {
        console.error("Failed to fetch stocks:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function getStockCountAction() {
    try {
        const count = await prisma.stock.count();
        return { success: true, count };
    } catch (error) {
        console.error("Failed to count stocks:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function getOHLCCountAction() {
    try {
        const count = await prisma.oHLC.count();
        return { success: true, count };
    } catch (error) {
        console.error("Failed to count OHLC:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function getBrokerCountAction() {
    try {
        const count = await prisma.broker.count();
        return { success: true, count };
    } catch (error) {
        console.error("Failed to count brokers:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
