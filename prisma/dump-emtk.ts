import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const symbol = 'EMTK';
    const dateStr = '2026-02-27';
    const dateStart = new Date(dateStr);
    const dateEnd = new Date(dateStr);
    dateEnd.setHours(23, 59, 59, 999);

    console.log(`--- Comprehensive Dump for ${symbol} on ${dateStr} ---`);

    const summaries = await prisma.brokerSummary.findMany({
        where: {
            stockSymbol: symbol,
            date: {
                gte: dateStart,
                lte: dateEnd
            }
        }
    });

    const transactions = await prisma.brokerTransaction.findMany({
        where: {
            stockSymbol: symbol,
            date: {
                gte: dateStart,
                lte: dateEnd
            }
        }
    });

    console.log(`Found ${summaries.length} summaries`);
    summaries.forEach(s => {
        console.log(`Summary: [${s.brokerCode}] [${s.investorType}] Val: ${s.value.toString()} Vol: ${s.volume.toString()}`);
    });

    console.log(`\nFound ${transactions.length} transactions`);
    transactions.forEach(t => {
        console.log(`Transaction: [${t.brokerCode}] [${t.investorType}] [${t.action}] Val: ${t.value.toString()} Vol: ${t.volume.toString()}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
