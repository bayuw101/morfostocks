import { PrismaClient } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";

const prisma = new PrismaClient();

type LinerKey = "first_liner" | "second_liner" | "third_liner";

type TurnoverEntry = {
    symbol: string;
    avg_daily_turnover: number;
    days_sampled: number;
};

type TurnoverClassification = Record<LinerKey, TurnoverEntry[]>;

async function main() {
    const filePath = path.join(process.cwd(), "..", "data", "turnover_classification.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as TurnoverClassification;

    const liners: LinerKey[] = ["first_liner", "second_liner", "third_liner"];
    let totalUpserted = 0;

    for (const liner of liners) {
        const entries = parsed[liner] ?? [];
        console.log(`Processing ${liner}: ${entries.length} entries`);

        for (const entry of entries) {
            const symbol = entry.symbol.toUpperCase().trim();
            if (!symbol) continue;

            // Ensure stock exists
            await prisma.stock.upsert({
                where: { symbol },
                update: {},
                create: { symbol },
            });

            // Upsert liner classification
            await prisma.stockLiner.upsert({
                where: { stockSymbol: symbol },
                update: {
                    liner,
                    avgDailyTurnover: BigInt(Math.round(entry.avg_daily_turnover)),
                    daysSampled: entry.days_sampled,
                },
                create: {
                    stockSymbol: symbol,
                    liner,
                    avgDailyTurnover: BigInt(Math.round(entry.avg_daily_turnover)),
                    daysSampled: entry.days_sampled,
                },
            });

            totalUpserted++;
        }
    }

    console.log(`Done! Upserted ${totalUpserted} liner classifications.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
