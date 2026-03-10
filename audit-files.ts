import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(__dirname, '../data');

function countFiles(dir: string): number {
    if (!fs.existsSync(dir)) return 0;
    let count = 0;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            count += countFiles(fullPath);
        } else if (file.endsWith('.json')) {
            count++;
        }
    }
    return count;
}

function countOhlcRows(dir: string): number {
    if (!fs.existsSync(dir)) return 0;
    let count = 0;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
            count += Array.isArray(data) ? data.length : 0;
        } catch (e) { }
    }
    return count;
}

function countBrokerSummaries(dir: string): number {
    return countFiles(dir); // one per date per broker
}

function countFundamentals(): number {
    if (!fs.existsSync(path.join(DATA_DIR, 'fundamentals'))) return 0;
    const files = fs.readdirSync(path.join(DATA_DIR, 'fundamentals')).filter(f => f.endsWith('.json') && !f.includes('_') && f.length <= 6);
    return files.length;
}

const ohlcRows = countOhlcRows(path.join(DATA_DIR, 'ohlc'));
const fundamentals = countFundamentals();
const bidOffers = countFiles(path.join(DATA_DIR, 'bid_offer'));
const brokerSummaries = countBrokerSummaries(path.join(DATA_DIR, 'broker', 'daily'));

console.log('--- File System Audit ---');
console.log(`Expected OHLC rows: ${ohlcRows}`);
console.log(`Expected Fundamental files: ${fundamentals}`);
console.log(`Expected BidOffer files: ${bidOffers}`);
console.log(`Expected BrokerSummary files: ${brokerSummaries}`);
