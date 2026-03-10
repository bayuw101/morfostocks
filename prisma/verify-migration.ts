import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Verifying Broker Data ---');

    for (const stock of ['ADRO', 'EMTK']) {
        console.log(`\nChecking BrokerSummary for ${stock}:`);

        const totalRows = await prisma.brokerSummary.count({
            where: { stockSymbol: stock }
        });

        console.log(`Total rows for ${stock}: ${totalRows}`);

        if (totalRows > 0) {
            const byType = await prisma.brokerSummary.groupBy({
                by: ['investorType'],
                where: { stockSymbol: stock, date: { gte: new Date('2024-01-01') } },
                _count: {
                    id: true
                },
                _sum: {
                    value: true,
                    volume: true
                }
            });
            console.log(JSON.stringify(byType, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

            // Check transactions as well
            const transByType = await prisma.brokerTransaction.groupBy({
                by: ['investorType'],
                where: { stockSymbol: stock },
                _count: { id: true }
            });
            console.log(`Transactions by type for ${stock}:`);
            console.log(JSON.stringify(transByType, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
