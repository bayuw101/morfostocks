import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const stockCount = await prisma.stock.count();
    const ohlcCount = await prisma.oHLC.count();
    const fundamentalCount = await prisma.fundamental.count();
    const bidOfferCount = await prisma.bidOffer.count();
    const brokerSummaryCount = await prisma.brokerSummary.count();
    const brokerTransactionCount = await prisma.brokerTransaction.count();

    console.log('--- Database Audit ---');
    console.log(`Stocks: ${stockCount}`);
    console.log(`OHLC records: ${ohlcCount}`);
    console.log(`Fundamental records: ${fundamentalCount}`);
    console.log(`BidOffer records: ${bidOfferCount}`);
    console.log(`BrokerSummary records: ${brokerSummaryCount}`);
    console.log(`BrokerTransaction records: ${brokerTransactionCount}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
