export interface OhlcItem {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    change?: number;
    change_percentage?: number;
    foreign_buy?: number;
    foreign_sell?: number;
    net_foreign?: number;
}

// ... (previous interfaces)
export interface TechnicalScore {
    symbol: string;
    lastPrice: number;
    changePct: number;
    volume: number;
    value: number;           // Transaction Value (Price * Volume)
    volumeSpike: number;     // Ratio of current volume to MA(20)
    rsi: number | null;
    stochRsiK: number | null;
    stochRsiD: number | null;
    macdLine: number | null;
    macdSignal: number | null;
    macdHist: number | null;
    bbUpper: number | null;
    bbMiddle: number | null;
    bbLower: number | null;
    bbPosition: number | null; // 0-1 relative to bands
    sidewaysDays: number;
    isSideways: boolean;
    isLiquid: boolean;       // New: Liquidity Check
    trend: "Bullish" | "Bearish" | "Neutral"; // New: EMA200 Context
    netForeign: number;      // New: Foreign Flow
    score: number;
    status: "Overpriced" | "Good Entry" | "Neutral" | "Avoid"; // Added Avoid
    signals: string[];
}


// -- SERIES HELPER UTILS --

// Simple Moving Average Series
export function calculateSMASeries(data: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
            continue;
        }
        const slice = data.slice(i - period + 1, i + 1);
        const sum = slice.reduce((a, b) => a + b, 0);
        result.push(sum / period);
    }
    return result;
}

// EMA Series
export function calculateEMASeries(data: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    const k = 2 / (period + 1);
    let ema = data[0]; // Start with first point as SMA substitute or just first price
    // Typically first SMA is needed, but for simplicity in long series we start with price
    // Better: Calculate SMA for first point

    // First valid point is at index period-1
    // We will do a simple scan
    // Initial SMA
    if (data.length < period) return data.map(() => null);

    let sum = 0;
    for (let i = 0; i < period; i++) sum += data[i];
    let prevEma = sum / period;

    // Fill nulls
    for (let i = 0; i < period - 1; i++) result.push(null);
    result.push(prevEma);

    for (let i = period; i < data.length; i++) {
        const val = (data[i] * k) + (prevEma * (1 - k));
        result.push(val);
        prevEma = val;
    }
    return result;
}

// RSI Series
export function calculateRSISeries(closes: number[], period: number = 14): (number | null)[] {
    const result: (number | null)[] = [];

    if (closes.length < period + 1) return closes.map(() => null);

    let avgGain = 0;
    let avgLoss = 0;

    // Initial Avg
    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) avgGain += change;
        else avgLoss -= change;
    }
    avgGain /= period;
    avgLoss /= period;

    // Fill initial nulls (0 to period) - RSI usually available from period+1 point (index period)
    for (let i = 0; i < period; i++) result.push(null);

    // First RSI
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + rs)));

    for (let i = period + 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        if (avgLoss === 0) result.push(100);
        else {
            const rs = avgGain / avgLoss;
            result.push(100 - (100 / (1 + rs)));
        }
    }
    return result;
}

// MACD Series
export function calculateMACDSeries(closes: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    // We need EMA(12) and EMA(26)
    // Note: calculateEMASeries returns nulls for initial periods.
    // We need to handle aligning them.

    const emaFast = calculateEMASeries(closes, fastPeriod);
    const emaSlow = calculateEMASeries(closes, slowPeriod);

    const macdLine: (number | null)[] = [];
    const validMacdValues: number[] = [];
    const validMacdIndices: number[] = []; // Track indices to map back

    for (let i = 0; i < closes.length; i++) {
        const f = emaFast[i];
        const s = emaSlow[i];
        if (f !== null && s !== null) {
            const val = f - s;
            macdLine.push(val);
            validMacdValues.push(val);
            validMacdIndices.push(i);
        } else {
            macdLine.push(null);
        }
    }

    // Signal Line is EMA(9) of MACD Line
    // We calculate EMA only on valid values, then map back
    const signalValues = calculateEMASeries(validMacdValues, signalPeriod);

    const signalLine: (number | null)[] = new Array(closes.length).fill(null);
    const hist: (number | null)[] = new Array(closes.length).fill(null);

    for (let j = 0; j < validMacdIndices.length; j++) {
        const idx = validMacdIndices[j];
        const sVal = signalValues[j];
        if (sVal !== null) {
            signalLine[idx] = sVal;
            if (macdLine[idx] !== null) {
                hist[idx] = (macdLine[idx] as number) - sVal;
            }
        }
    }

    return { macd: macdLine, signal: signalLine, hist };
}

// Bollinger Bands Series
export function calculateBBSeries(closes: number[], period = 20, stdDevMult = 2) {
    const upper: (number | null)[] = [];
    const middle: (number | null)[] = [];
    const lower: (number | null)[] = [];

    // Middle is SMA
    const sma = calculateSMASeries(closes, period);

    for (let i = 0; i < closes.length; i++) {
        const ma = sma[i];
        if (ma === null) {
            upper.push(null); middle.push(null); lower.push(null);
            continue;
        }

        // Variance
        const slice = closes.slice(i - period + 1, i + 1);
        const squaredDiffs = slice.map(x => Math.pow(x - ma, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
        const stdDev = Math.sqrt(variance);

        upper.push(ma + (stdDev * stdDevMult));
        lower.push(ma - (stdDev * stdDevMult));
        middle.push(ma);
    }
    return { upper, middle, lower };
}

export function analyzeReference(ohlc: OhlcItem[]): TechnicalScore | null {
    if (!ohlc || ohlc.length < 20) return null;

    // 1. Data Prep (Ascending for Math)
    const ohlcRev = [...ohlc].reverse();
    const closes = ohlcRev.map(x => x.close);
    const volumes = ohlcRev.map(x => x.volume);

    // Latest (Newest is index 0 in original OHLC)
    const latestOhlc = ohlc[0];

    // 2. Calculate Series
    const rsiSeries = calculateRSISeries(closes);
    const macd = calculateMACDSeries(closes);
    const bb = calculateBBSeries(closes);
    const ema20 = calculateEMASeries(closes, 20);
    const ema50 = calculateEMASeries(closes, 50);
    const ema200 = calculateEMASeries(closes, 200);
    const volMa = calculateSMASeries(volumes, 20);

    // Stoch RSI (Fast Hack for Latest)
    const oldStoch = calculateStochRSI(closes.slice().reverse());

    // Sideways
    const sideways = detectSideways(ohlc.map(x => x.close));

    // Latest Values
    const lastIdx = closes.length - 1;
    const latestRsi = rsiSeries[lastIdx];
    const latestMacdLine = macd.macd[lastIdx];
    const latestMacdHist = macd.hist[lastIdx];
    const latestBbUpper = bb.upper[lastIdx];
    const latestBbLower = bb.lower[lastIdx];
    const latestEma200 = ema200[lastIdx];
    const latestVol = volumes[lastIdx];
    const latestVolMa = volMa[lastIdx];

    // -- SCORING LOGIC --
    let score = 0;
    const signals: string[] = [];
    let status: "Overpriced" | "Good Entry" | "Neutral" | "Avoid" = "Neutral";
    let trend: "Bullish" | "Bearish" | "Neutral" = "Neutral";

    // 1. LIQUIDITY CHECK
    // Filter out minimal volume stocks to avoid "fake spikes"
    const avgValue = (latestVolMa || 0) * latestOhlc.close;
    // Threshold: > 50M IDR Value OR > 100k Shares Vol (for penny stocks)
    const isLiquid = avgValue > 50_000_000 || (latestVolMa || 0) > 100_000;

    if (!isLiquid) {
        return {
            symbol: "UNKNOWN",
            lastPrice: latestOhlc.close,
            changePct: latestOhlc.change_percentage || 0,
            volume: latestOhlc.volume,
            value: latestOhlc.volume * latestOhlc.close,
            volumeSpike: 0,
            rsi: latestRsi,
            stochRsiK: oldStoch.k,
            stochRsiD: oldStoch.d,
            macdLine: latestMacdLine,
            macdSignal: macd.signal[lastIdx],
            macdHist: latestMacdHist,
            bbUpper: latestBbUpper,
            bbMiddle: bb.middle[lastIdx],
            bbLower: latestBbLower,
            bbPosition: 0.5,
            sidewaysDays: sideways.days,
            isSideways: sideways.isSideways,
            isLiquid: false,
            trend: "Neutral",
            netForeign: latestOhlc.net_foreign || 0,
            score: -10,
            status: "Avoid",
            signals: ["Illiquid"]
        };
    }

    // 2. TREND CONTEXT (EMA 200)
    if (latestEma200 !== null) {
        if (latestOhlc.close > latestEma200) {
            score += 2;
            trend = "Bullish";
            // Strong Uptrend Check
            const lEma20 = ema20[lastIdx];
            const lEma50 = ema50[lastIdx];
            if (lEma20 && lEma50 && latestOhlc.close > lEma20 && lEma20 > lEma50 && lEma50 > latestEma200) {
                // Perfect Order
                const diff200 = (latestOhlc.close - latestEma200) / latestEma200;
                if (diff200 < 0.4) { // Not too extended
                    score += 1;
                    signals.push("Strong Uptrend");
                }
            }
        } else {
            score -= 1;
            trend = "Bearish";
        }
    }

    // 3. RSI (Context Aware)
    if (latestRsi !== null) {
        if (latestRsi < 30) {
            // Oversold
            if (trend === "Bullish") { score += 3; signals.push("Dip Buy (Oversold in Uptrend)"); }
            else { score += 1; signals.push("RSI Oversold"); }
        }
        else if (latestRsi > 70) {
            // Overbought
            if (trend === "Bullish") {
                if (latestRsi > 85) { score -= 2; signals.push("RSI Extreme"); }
                else { score += 1; signals.push("Strong Momentum"); }
            } else {
                score -= 2; signals.push("RSI Overbought");
            }
        }
        else if (latestRsi > 50 && trend === "Bullish") {
            score += 1;
        }
    }

    // 4. StochRSI
    if (oldStoch.k !== null && oldStoch.d !== null) {
        if (oldStoch.k < 20 && oldStoch.d < 20) {
            if (oldStoch.k > oldStoch.d) { score += 2; signals.push("Stoch Golden Cross"); }
            else { score += 1; }
        }
        else if (oldStoch.k > 80) { score -= 1; }
    }

    // 5. MACD
    if (latestMacdHist !== null && latestMacdLine !== null) {
        if (latestMacdHist > 0 && ohlc[1] && (macd.hist[lastIdx - 1] || 0) <= 0) {
            score += 2; signals.push("MACD Xover Bullish");
        } else if (latestMacdHist > 0) {
            score += 1;
        }
    }

    // 6. Bollinger Bands
    let bbPos = 0.5;
    if (latestBbUpper !== null && latestBbLower !== null) {
        const range = latestBbUpper - latestBbLower;
        if (range !== 0) bbPos = (latestOhlc.close - latestBbLower) / range;

        if (bbPos < 0) {
            score += 3; status = "Good Entry"; signals.push("Below BB Lower");
        }
        else if (bbPos < 0.2) {
            score += 2; status = "Good Entry"; signals.push("Near Support (BB)");
        }
        else if (bbPos > 1.0) {
            if (trend === "Bullish" && latestOhlc.volume > (latestVolMa || 0) * 1.5) {
                // Valid Breakout
                score += 2; signals.push("Volatility Breakout");
            } else {
                score -= 2; status = "Overpriced"; signals.push("Overextended (BB)");
            }
        }
    }

    // 7. Volume & Foreign Flow
    let spike = 0;
    if (latestVolMa && latestVolMa > 0) {
        spike = latestVol / latestVolMa;

        if (isLiquid && spike > 1.5) {
            if (latestOhlc.change_percentage && latestOhlc.change_percentage > 0) {
                if (spike > 5) { score += 3; signals.push("Extreme Buying Vol"); }
                else { score += 1; signals.push("Volume Spike (Buy)"); }
            } else if (latestOhlc.change_percentage && latestOhlc.change_percentage < -2) {
                score -= 2; signals.push("Distribution Volume");
            }
        }
    }

    // Foreign Flow
    const netForeign = latestOhlc.net_foreign || 0;
    if (netForeign > 1_000_000_000) {
        score += 2; signals.push("Foreign Accumulation");
    } else if (netForeign < -1_000_000_000) {
        score -= 2; signals.push("Foreign Distribution");
    }

    // 8. Sideways Context
    if (sideways.isSideways) {
        if (trend === "Bullish") {
            score += 2; signals.push(`Bullish Consolidation (${sideways.days}d)`);
        } else if (status === "Good Entry") {
            // Accumulation at bottom
            score += 2; signals.push(`Base Building (${sideways.days}d)`);
        } else {
            score -= 1;
        }
    }

    // Final Status Logic
    if (score >= 4) status = "Good Entry";
    else if (score <= -2) status = "Overpriced";
    else status = "Neutral";

    return {
        symbol: "UNKNOWN",
        lastPrice: latestOhlc.close,
        changePct: latestOhlc.change_percentage || 0,
        volume: latestOhlc.volume,
        value: latestOhlc.volume * latestOhlc.close,
        volumeSpike: spike,
        rsi: latestRsi,
        stochRsiK: oldStoch.k,
        stochRsiD: oldStoch.d,
        macdLine: latestMacdLine,
        macdSignal: macd.signal[lastIdx],
        macdHist: latestMacdHist,
        bbUpper: latestBbUpper,
        bbMiddle: bb.middle[lastIdx],
        bbLower: latestBbLower,
        bbPosition: bbPos,
        sidewaysDays: sideways.days,
        isSideways: sideways.isSideways,
        isLiquid,
        trend,
        netForeign,
        score,
        status,
        signals
    };
}

// Sideways detection
export function detectSideways(closes: number[], thresholdPct = 0.05, maxDays = 20): { isSideways: boolean, days: number } {
    if (closes.length < 5) return { isSideways: false, days: 0 };
    let days = 1; let min = closes[0]; let max = closes[0];
    for (let i = 1; i < Math.min(closes.length, maxDays); i++) {
        const p = closes[i];
        const newMin = Math.min(min, p);
        const newMax = Math.max(max, p);
        const range = (newMax - newMin) / newMin;
        if (range <= thresholdPct) {
            days++; min = newMin; max = newMax;
        } else break;
    }
    return { isSideways: days >= 5, days };
}

// Stochastic RSI (Single Point - Legacy for Screener)
export function calculateStochRSI(closes: number[], rsiPeriod = 14, stochPeriod = 14, kPeriod = 3, dPeriod = 3) {
    const prices = [...closes].reverse();
    if (prices.length < rsiPeriod + stochPeriod) return { k: null, d: null };

    const rsiSeries: number[] = [];
    let avgGain = 0; let avgLoss = 0;

    for (let i = 1; i <= rsiPeriod; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) avgGain += change; else avgLoss -= change;
    }
    avgGain /= rsiPeriod; avgLoss /= rsiPeriod;
    rsiSeries.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));

    for (let i = rsiPeriod + 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        avgGain = (avgGain * (rsiPeriod - 1) + gain) / rsiPeriod;
        avgLoss = (avgLoss * (rsiPeriod - 1) + loss) / rsiPeriod;
        rsiSeries.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
    }

    const stochRsiSeries: number[] = [];
    for (let i = stochPeriod - 1; i < rsiSeries.length; i++) {
        const window = rsiSeries.slice(i - stochPeriod + 1, i + 1);
        const min = Math.min(...window);
        const max = Math.max(...window);
        const current = rsiSeries[i];
        let k_val = 0;
        if (max - min !== 0) k_val = (current - min) / (max - min);
        stochRsiSeries.push(k_val * 100);
    }

    const kLine: number[] = [];
    for (let i = kPeriod - 1; i < stochRsiSeries.length; i++) {
        const slice = stochRsiSeries.slice(i - kPeriod + 1, i + 1);
        const sum = slice.reduce((a, b) => a + b, 0);
        kLine.push(sum / kPeriod);
    }
    const dLine: number[] = [];
    for (let i = dPeriod - 1; i < kLine.length; i++) {
        const slice = kLine.slice(i - dPeriod + 1, i + 1);
        const sum = slice.reduce((a, b) => a + b, 0);
        dLine.push(sum / dPeriod);
    }
    return { k: kLine.length > 0 ? kLine[kLine.length - 1] : null, d: dLine.length > 0 ? dLine[dLine.length - 1] : null };
}

// Volume Moving Average
export function calculateVolumeSMA(volumes: number[], period: number = 20): number | null {
    if (volumes.length < period) return null;
    const slice = volumes.slice(0, period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
}
