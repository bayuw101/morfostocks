import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Cleaning Database (Truncating all tables) ---');

    // Order matters due to foreign keys if we don't use raw SQL with foreign_key_checks=0
    // But let's just use raw SQL for speed and reliability on MySQL
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');

    const tables = [
        'OHLC',
        'Fundamental',
        'BidOffer',
        'BrokerSummary',
        'BrokerTransaction',
        'StockLiner',
        'Ownership',
        'OwnershipChange',
        'OwnershipSyncMeta',
        'Broker',
        'Stock',
    ];

    for (const table of tables) {
        console.log(`Truncating ${table}...`);
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\`;`);
    }

    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('--- Database is now empty ---');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
