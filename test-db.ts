import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const txs = await prisma.brokerTransaction.findMany({
    where: { stockSymbol: 'BUMI', brokerCode: 'SS', date: new Date('2026-03-02') }
  });
  console.log(JSON.stringify(txs, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
