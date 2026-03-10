import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const symbol = 'ADRO';
    const date = new Date('2026-02-27');

    console.log(`--- Audit for ${symbol} on ${date.toISOString()} ---`);

    const summaries = await prisma.brokerSummary.findMany({
        where: {
            stockSymbol: symbol,
            date: date,
            investorType: 'Foreign'
        }
    });

    console.log(`Found ${summaries.length} Foreign summaries:`);
    summaries.forEach(s => {
        console.log(`- Broker: ${s.brokerCode}, Value: ${s.value.toString()}`);
    });

    const txs = await prisma.brokerTransaction.findMany({
        where: {
            stockSymbol: symbol,
            date: date,
            investorType: 'Foreign'
        }
    });

    console.log(`\nFound ${txs.length} Foreign transactions:`);
    txs.forEach(t => {
        console.log(`- Broker: ${t.brokerCode}, Action: ${t.action}, Value: ${t.value.toString()}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
