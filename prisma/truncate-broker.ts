import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Cleaning Database (Truncating Broker Tables) ---');

    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');

    const tables = [
        'BrokerSummary',
        'BrokerTransaction',
    ];

    for (const table of tables) {
        console.log(`Truncating ${table}...`);
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\`;`);
    }

    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('--- Truncating complete ---');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
