import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const ohlc = await prisma.oHLC.findUnique({
    where: { stockSymbol_date: { stockSymbol: 'BUMI', date: new Date('2026-03-02') } },
    select: { volume: true, close: true, value: true }
  });
  console.log('OHLC Volume:', ohlc?.volume.toString());

  const tx = await prisma.brokerTransaction.findFirst({
    where: { stockSymbol: 'BUMI', date: new Date('2026-03-02'), brokerCode: 'SS' }
  });
  console.log('Broker Tx Volume:', tx?.volume.toString());
}
main().catch(console.error).finally(() => prisma.$disconnect());
