import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const DATA_DIR = path.resolve(__dirname, '../../data');

const ensuredStocks = new Set<string>();
async function ensureStock(symbol: string) {
    if (ensuredStocks.has(symbol)) return;
    await prisma.stock.upsert({
        where: { symbol },
        update: {},
        create: { symbol },
    });
    ensuredStocks.add(symbol);
}

const ensuredBrokers = new Set<string>();
async function ensureBroker(code: string, name: string) {
    if (ensuredBrokers.has(code)) return;
    await prisma.broker.upsert({
        where: { code },
        update: { name },
        create: { code, name },
    });
    ensuredBrokers.add(code);
}

function chunkArray<T>(array: T[], size: number): T[][] {
    const chunked: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
}

async function seedOhlc() {
    console.log('--- Seeding OHLC ---');
    const ohlcDir = path.join(DATA_DIR, 'ohlc');
    if (!fs.existsSync(ohlcDir)) {
        console.log('OHLC directory not found, skipping...');
        return;
    }

    const files = fs.readdirSync(ohlcDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
        const symbol = file.replace('.json', '');
        await ensureStock(symbol);

        const filePath = path.join(ohlcDir, file);
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            const recordsToInsert = data.map((row: any) => ({
                stockSymbol: symbol,
                date: new Date(row.date),
                open: typeof row.open === 'number' ? row.open : 0,
                high: typeof row.high === 'number' ? row.high : 0,
                low: typeof row.low === 'number' ? row.low : 0,
                close: typeof row.close === 'number' ? row.close : 0,
                volume: BigInt(Math.round(Number(row.volume || 0))),
                value: BigInt(Math.round(Number(row.value || 0))),
                frequency: typeof row.frequency === 'number' ? row.frequency : 0,
                foreignBuy: BigInt(Math.round(Number(row.foreign_buy || 0))),
                foreignSell: BigInt(Math.round(Number(row.foreign_sell || 0))),
                netForeign: BigInt(Math.round(Number(row.net_foreign || 0))),
            }));

            // In batches to avoid too large query
            const batches = chunkArray(recordsToInsert, 1000);
            let totalInserted = 0;
            for (const batch of batches) {
                const result = await prisma.oHLC.createMany({
                    data: batch as any,
                    skipDuplicates: true,
                });
                totalInserted += result.count;
            }

            console.log(`[OHLC] Seeded ${totalInserted} records for ${symbol}`);
        } catch (err: any) {
            console.error(`[OHLC] Failed to process ${file}: ${err.message}`);
        }
    }
}

async function seedFundamentals() {
    console.log('--- Seeding Fundamentals ---');
    const fundamentalsDir = path.join(DATA_DIR, 'fundamentals');
    if (!fs.existsSync(fundamentalsDir)) {
        console.log('Fundamentals directory not found, skipping...');
        return;
    }

    const files = fs.readdirSync(fundamentalsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
        const symbol = file.replace('.json', '');
        // Ignore any non-symbol files like "fundamental_scores.json" unless they are part of it
        if (symbol.includes('_') || symbol.length > 6) continue;

        await ensureStock(symbol);

        const filePath = path.join(fundamentalsDir, file);
        try {
            const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            // Upsert Fundamental
            await prisma.fundamental.upsert({
                where: { stockSymbol: symbol },
                update: {
                    data: fileContent,
                    updatedAt: new Date()
                },
                create: {
                    stockSymbol: symbol,
                    data: fileContent,
                }
            });

            console.log(`[Fundamental] Seeded data for ${symbol}`);
        } catch (err: any) {
            console.error(`[Fundamental] Failed to process ${file}: ${err.message}`);
        }
    }
}

async function seedBidOffer() {
    console.log('--- Seeding BidOffer ---');
    const bidofferDir = path.join(DATA_DIR, 'bid_offer');
    if (!fs.existsSync(bidofferDir)) {
        console.log('BidOffer directory not found, skipping...');
        return;
    }

    const symbolDirs = fs.readdirSync(bidofferDir);
    for (const symDir of symbolDirs) {
        const symPath = path.join(bidofferDir, symDir);
        if (!fs.statSync(symPath).isDirectory()) continue;

        await ensureStock(symDir);

        const count = { i: 0 };
        const dateFiles = fs.readdirSync(symPath).filter(f => f.endsWith('.json'));
        for (const dfile of dateFiles) {
            const filePath = path.join(symPath, dfile);
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                const dateStr = data.date;
                if (!dateStr) continue;

                await prisma.bidOffer.upsert({
                    where: {
                        stockSymbol_date: {
                            stockSymbol: symDir,
                            date: new Date(dateStr)
                        }
                    },
                    update: {
                        tiers: data.tiers || {}
                    },
                    create: {
                        stockSymbol: symDir,
                        date: new Date(dateStr),
                        tiers: data.tiers || {}
                    }
                });
                count.i++;
            } catch (err: any) {
                console.error(`[BidOffer] Failed to process ${dfile} for ${symDir}: ${err.message}`);
            }
        }
        console.log(`[BidOffer] Seeded ${count.i} records for ${symDir}`);
    }
}

async function seedBrokers(subDir: string = 'daily', investorType: string = 'Total') {
    console.log(`--- Seeding Brokers (${investorType}) ---`);
    const brokerDirPath = path.join(DATA_DIR, 'broker', subDir);
    if (!fs.existsSync(brokerDirPath)) {
        console.log(`Broker ${subDir} directory not found, skipping...`);
        return;
    }

    const brokerDirs = fs.readdirSync(brokerDirPath);
    const filterBroker = process.argv.includes('--broker') ? process.argv[process.argv.indexOf('--broker') + 1] : null;

    for (const bDir of brokerDirs) {
        if (filterBroker && bDir !== filterBroker) continue;
        const bPath = path.join(brokerDirPath, bDir);
        if (!fs.statSync(bPath).isDirectory()) continue;

        let brokerEnsured = false;
        let sumCount = 0;
        let transCount = 0;

        const dateFiles = fs.readdirSync(bPath).filter(f => f.endsWith('.json'));
        console.log(`[DEBUG] Found ${dateFiles.length} files in ${bDir}`);
        for (const dfile of dateFiles) {
            const filePath = path.join(bPath, dfile);
            try {
                const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                const innerData = json.data;
                if (!innerData) {
                    console.log(`[DEBUG] No inner data for ${filePath}`);
                    continue;
                }

                const bCode = innerData.broker_code;
                const bName = innerData.broker_name || 'Unknown';
                if (!bCode) continue;

                if (!brokerEnsured) {
                    await ensureBroker(bCode, bName);
                    brokerEnsured = true;
                }

                const dateStr = innerData.from || innerData.to;
                if (!dateStr) continue;

                // Broker transactions
                const bs = innerData.broker_summary || {};
                const buys = bs.brokers_buy || [];
                const sells = bs.brokers_sell || [];

                if (buys.length === 0 && sells.length === 0) {
                    console.log(`[DEBUG] No buys/sells in ${filePath}. Keys: ${Object.keys(bs)}`);
                }

                const txs: any[] = [];
                const stockSummaries = new Map<string, { value: bigint; volume: bigint }>();

                for (const b of buys) {
                    const symMatch = b.netbs_stock_code ? String(b.netbs_stock_code).match(/^[A-Z]{4}$/) : null;
                    if (!symMatch) continue;
                    const sym = symMatch[0];
                    await ensureStock(sym);

                    const invType = investorType;
                    const val = BigInt(Math.round(Math.abs(Number(b.bval || 0))));
                    const vol = BigInt(Math.round(Math.abs(Number(b.blot || 0)) * 100));

                    txs.push({
                        brokerCode: bCode,
                        date: new Date(dateStr),
                        stockSymbol: sym,
                        investorType: invType,
                        action: 'BUY',
                        volume: vol,
                        value: val,
                        avgPrice: Number(b.netbs_buy_avg_price || 0)
                    });

                    const key = `${sym}|${invType}`;
                    const existing = stockSummaries.get(key) || { value: BigInt(0), volume: BigInt(0) };
                    stockSummaries.set(key, {
                        value: existing.value + val,
                        volume: existing.volume + vol
                    });
                }

                for (const s of sells) {
                    const symMatch = s.netbs_stock_code ? String(s.netbs_stock_code).match(/^[A-Z]{4}$/) : null;
                    if (!symMatch) continue;
                    const sym = symMatch[0];
                    await ensureStock(sym);

                    const invType = investorType;
                    const val = BigInt(Math.round(Math.abs(Number(s.sval || 0))));
                    const vol = BigInt(Math.round(Math.abs(Number(s.slot || 0)) * 100));

                    txs.push({
                        brokerCode: bCode,
                        date: new Date(dateStr),
                        stockSymbol: sym,
                        investorType: invType,
                        action: 'SELL',
                        volume: vol,
                        value: val,
                        avgPrice: Number(s.netbs_sell_avg_price || 0)
                    });

                    const key = `${sym}|${invType}`;
                    const existing = stockSummaries.get(key) || { value: BigInt(0), volume: BigInt(0) };
                    stockSummaries.set(key, {
                        value: existing.value + val,
                        volume: existing.volume + vol
                    });
                }

                // Batch per-stock summaries
                const summaryRecords: any[] = [];
                for (const [key, data] of stockSummaries.entries()) {
                    const [sym, invType] = key.split('|');
                    summaryRecords.push({
                        brokerCode: bCode,
                        date: new Date(dateStr),
                        investorType: invType,
                        stockSymbol: sym,
                        value: data.value,
                        volume: data.volume,
                        bandarDetector: {}
                    });
                }

                if (summaryRecords.length > 0) {
                    await prisma.brokerSummary.createMany({
                        data: summaryRecords,
                        skipDuplicates: true
                    });
                    sumCount += summaryRecords.length;
                }

                if (txs.length > 0) {
                    const chunks = chunkArray(txs, 1000);
                    for (const c of chunks) {
                        await prisma.brokerTransaction.createMany({
                            data: c as any,
                            skipDuplicates: true
                        });
                        transCount += c.length;
                    }
                }

            } catch (err: any) {
                console.error(`[Broker ${investorType}] Failed to process ${dfile} for ${bDir}: ${err.message}`);
            }
        }
        console.log(`[Broker ${investorType}] Seeded ${sumCount} summaries and ${transCount} transactions for ${bDir}`);
    }
}

async function seedBrokerIndex() {
    console.log('--- Seeding Broker Index (Stock-centric summaries) ---');
    const indexDir = path.join(DATA_DIR, 'broker', 'index');
    if (!fs.existsSync(indexDir)) {
        console.log('Broker index directory not found, skipping...');
        return;
    }

    const files = fs.readdirSync(indexDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
        const dateStr = file.replace('.json', '');
        const filePath = path.join(indexDir, file);
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            // data is { SYMBOL: { BROKER_CODE: NET_VALUE, ... }, ... }

            for (const [symbol, brokers] of Object.entries(data)) {
                if (symbol === 'message' || symbol === 'status') continue;

                const entries = Object.entries(brokers as Record<string, number>);
                for (const [bCode, netValue] of entries) {
                    if (bCode === 'total_net') continue;

                    // The index files don't give us volume or frequency, just net value.
                    // But we can upsert or at least ensure we don't overwrite richer data
                    // actually, these files represent MARKET_BOARD_REGULER & INVESTOR_TYPE_ALL usually.

                    await ensureBroker(bCode, 'Unknown');
                    await ensureStock(symbol);

                    await prisma.brokerSummary.upsert({
                        where: {
                            brokerCode_date_investorType_stockSymbol: {
                                brokerCode: bCode,
                                date: new Date(dateStr),
                                investorType: 'Total',
                                stockSymbol: symbol
                            }
                        },
                        update: {
                            // If we already have volume/value from the daily broker files,
                            // we might not want to overwrite it with just the net value.
                            // However, the user says the daily records are "missing" some data.
                        },
                        create: {
                            brokerCode: bCode,
                            date: new Date(dateStr),
                            investorType: 'Total',
                            stockSymbol: symbol,
                            value: BigInt(Math.round(Math.abs(netValue))),
                            volume: BigInt(0), // not available in this index
                            frequency: null,
                            bandarDetector: { net_value: netValue }
                        }
                    });
                }
            }
        } catch (err: any) {
            console.error(`[Broker Index] Failed to process ${file}: ${err.message}`);
        }
    }
}

async function main() {
    console.log('Starting data migration...');
    const filterBroker = process.argv.includes('--broker') ? process.argv[process.argv.indexOf('--broker') + 1] : null;
    const onlyBrokers = process.argv.includes('--only-brokers');

    if (!filterBroker && !onlyBrokers) {
        await seedOhlc();
        await seedFundamentals();
        await seedBidOffer();
    } else if (filterBroker) {
        console.log(`[DEBUG] Isolated run for broker: ${filterBroker}. Skipping preceding steps.`);
    }

    // We only need these for testing a specific broker or full migration
    await seedBrokers('daily', 'Total');
    await seedBrokers('foreign/daily', 'Foreign');

    if (!filterBroker) {
        await seedBrokerIndex();
    }
    console.log('Data migration complete!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
