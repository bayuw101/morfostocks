"use server";

import prisma from "@/lib/prisma";

export async function getStocksAction() {
    try {
        const stocks = await prisma.stock.findMany({
            orderBy: { symbol: "asc" }
        });
        return { ok: true, data: stocks };
    } catch (error: any) {
        console.error("Failed to fetch stocks:", error);
        return { ok: false, error: error.message };
    }
}

export async function getBrokersAction() {
    try {
        const brokers = await prisma.broker.findMany({
            orderBy: { code: "asc" }
        });
        return { ok: true, data: brokers };
    } catch (error: any) {
        console.error("Failed to fetch brokers:", error);
        return { ok: false, error: error.message };
    }
}
