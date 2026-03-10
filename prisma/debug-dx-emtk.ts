import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const symbol = 'EMTK';
    const broker = 'DX';
    const date = new Date('2026-02-27');

    console.log(`--- Investigating ${broker} / ${symbol} on 2026-02-27 ---`);

    const summaries = await prisma.brokerSummary.findMany({
        where: {
            brokerCode: broker,
            stockSymbol: symbol,
            date: date
        }
    });

    const transactions = await prisma.brokerTransaction.findMany({
        where: {
            brokerCode: broker,
            stockSymbol: symbol,
            date: date
        }
    });

    console.log('Summaries:', JSON.stringify(summaries, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    console.log('Transactions:', JSON.stringify(transactions, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
