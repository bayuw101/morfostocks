import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const date = new Date('2026-02-27');

    console.log(`--- Checking all Foreign records on 2026-02-27 ---`);

    const foreignSummaries = await prisma.brokerSummary.findMany({
        where: {
            date: date,
            investorType: 'Foreign'
        },
        take: 20
    });

    const foreignFreq = await prisma.brokerSummary.groupBy({
        by: ['stockSymbol', 'investorType'],
        where: { date: date },
        _count: { id: true }
    });

    console.log('Sample Foreign summaries:', JSON.stringify(foreignSummaries, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    console.log('Stock distribution on this date:', JSON.stringify(foreignFreq, null, 2));

    const dxForeign = await prisma.brokerTransaction.findMany({
        where: {
            brokerCode: 'DX',
            date: date,
            investorType: 'Foreign'
        }
    });
    console.log('DX Foreign Transactions:', JSON.stringify(dxForeign, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
