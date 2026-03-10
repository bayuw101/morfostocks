
import type { FundamentalData, FundamentalScores, FundamentalScoreItem } from "@/types/fundamental";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// === Optimized Weights (Quality + Growth + Valuation) ===
// You can tweak these but total sum ≈ 1.0 is nice.
const WEIGHTS = {
  rev: 0.20, // Revenue Growth
  roe: 0.18, // ROE
  npm: 0.17, // Net Profit Margin
  ni: 0.17, // Net Income Growth
  cr: 0.13, // Current Ratio
  der: 0.05, // Debt to Equity
  pbv: 0.05, // Price to Book (lower better)
  pe: 0.05, // PE (lower better)
};

type MissingFlags = {
  per?: boolean;
  pbv?: boolean;
  roe?: boolean;
  npm?: boolean;
  der?: boolean;
  current_ratio?: boolean;
  rev_growth?: boolean;
  ni_growth?: boolean;
  total_equity?: boolean;
};

type FundamentalWithMeta = FundamentalData & {
  /** internal-only missing data flags, used for scoring */
  _missingFlags?: MissingFlags;
};

// Local interfaces moved to types/fundamental.ts

// Local interfaces moved to types/fundamental.ts

// -----------------------------------------------------------------------------
// ORIGINAL PARSER (kept for backward compatibility in case it's used elsewhere)
// -----------------------------------------------------------------------------
function parseValue(valStr: string | undefined): number {
  if (!valStr || valStr === "-") return 0;
  let clean = valStr.replace(/,/g, "");
  let isNegative = false;
  if (clean.includes("(") && clean.includes(")")) {
    isNegative = true;
    clean = clean.replace(/\(|\)/g, "");
  }

  let multiplier = 1;
  if (clean.includes("%")) {
    clean = clean.replace("%", "");
    // keep percent as number e.g 15.5
  } else if (clean.includes(" T")) {
    clean = clean.replace(" T", "");
    multiplier = 1e12;
  } else if (clean.includes(" B")) {
    clean = clean.replace(" B", "");
    multiplier = 1e9;
  } else if (clean.includes(" M")) {
    clean = clean.replace(" M", "");
    multiplier = 1e6;
  }

  const floatVal = parseFloat(clean);
  if (isNaN(floatVal)) return 0;
  return isNegative ? -floatVal * multiplier : floatVal * multiplier;
}

// -----------------------------------------------------------------------------
// NEW: parser with missing flag (used only inside this file for scoring)
// -----------------------------------------------------------------------------
function parseValueWithMissing(valStr: string | undefined): { value: number; missing: boolean } {
  if (!valStr || valStr === "-") {
    return { value: 0, missing: true };
  }
  return { value: parseValue(valStr), missing: false };
}

// -----------------------------------------------------------------------------
// ORIGINAL extractItem (kept for compatibility; still works as before)
// -----------------------------------------------------------------------------
function extractItem(items: any[], nameMatch: string): number {
  const found = items.find((i: any) =>
    i.fitem?.name?.toLowerCase().includes(nameMatch.toLowerCase())
  );
  return parseValue(found?.fitem?.value);
}

// -----------------------------------------------------------------------------
// NEW: extractItemWithMissing – safer, tracks missing values for scoring
// -----------------------------------------------------------------------------
function extractItemWithMissing(items: any[], nameMatch: string): { value: number; missing: boolean } {
  const found = items.find((i: any) =>
    i.fitem?.name?.toLowerCase().includes(nameMatch.toLowerCase())
  );
  return parseValueWithMissing(found?.fitem?.value);
}

// -----------------------------------------------------------------------------
// loadFundamental – now attaches internal _missingFlags, but return type stays
// Promise<FundamentalData | null> for backward compatibility.
// -----------------------------------------------------------------------------
export async function loadFundamental(symbol: string): Promise<FundamentalData | null> {
  try {
    const fundamentalRecord = await prisma.fundamental.findUnique({
      where: { stockSymbol: symbol }
    });

    if (!fundamentalRecord || !fundamentalRecord.data) return null;
    const json: any = fundamentalRecord.data;

    // Flatten
    const allItems: any[] = [];
    if (json.data?.closure_fin_items_results) {
      for (const section of json.data.closure_fin_items_results) {
        if (section.fin_name_results) {
          allItems.push(...section.fin_name_results);
        }
      }
    }

    const missingFlags: MissingFlags = {};

    // --- PE (TTM, fallback to Annualised) ---
    let per = 0;
    let perMissing = true;

    const perTTM = extractItemWithMissing(allItems, "Current PE Ratio (TTM)");
    if (!perTTM.missing && perTTM.value !== 0) {
      per = perTTM.value;
      perMissing = false;
    } else {
      const perAnnual = extractItemWithMissing(allItems, "Current PE Ratio (Annualised)");
      per = perAnnual.value;
      perMissing = perAnnual.missing;
    }
    missingFlags.per = perMissing;

    // --- Other key metrics with missing flags ---
    const pbvMeta = extractItemWithMissing(allItems, "Current Price to Book Value");
    const roeMeta = extractItemWithMissing(allItems, "Return on Equity (TTM)");
    const npmMeta = extractItemWithMissing(allItems, "Net Profit Margin (Quarter)");
    const derMeta = extractItemWithMissing(allItems, "Debt to Equity Ratio (Quarter)");
    const crMeta = extractItemWithMissing(allItems, "Current Ratio (Quarter)");
    const revMeta = extractItemWithMissing(allItems, "Revenue (Quarter YoY Growth)");
    const niMeta = extractItemWithMissing(allItems, "Net Income (Quarter YoY Growth)");
    const pr3Meta = extractItemWithMissing(allItems, "3 Month Price Returns");
    const eqMeta = extractItemWithMissing(allItems, "Total Equity");
    const epsMeta = extractItemWithMissing(allItems, "Current EPS (TTM)");
    const bvpsMeta = extractItemWithMissing(allItems, "Current Book Value Per Share");
    const assetToMeta = extractItemWithMissing(allItems, "Asset Turnover (TTM)");
    const invToMeta = extractItemWithMissing(allItems, "Inventory Turnover (TTM)");

    missingFlags.pbv = pbvMeta.missing;
    missingFlags.roe = roeMeta.missing;
    missingFlags.npm = npmMeta.missing;
    missingFlags.der = derMeta.missing;
    missingFlags.current_ratio = crMeta.missing;
    missingFlags.rev_growth = revMeta.missing;
    missingFlags.ni_growth = niMeta.missing;
    missingFlags.total_equity = eqMeta.missing;

    const pbv = pbvMeta.value;
    const roe = roeMeta.value;
    const npm = npmMeta.value;
    const der = derMeta.value;
    const current_ratio = crMeta.value;
    const rev_growth = revMeta.value;
    const ni_growth = niMeta.value;
    const price_ret_3m = pr3Meta.value;
    const total_equity = eqMeta.value;
    const eps = epsMeta.value;
    const bvps = bvpsMeta.value;
    const asset_turnover = assetToMeta.value;
    const inventory_turnover = invToMeta.value;

    // Extract Outstanding Shares from stats block (not allItems)
    const rawShares = json.data?.stats?.current_share_outstanding || null;
    const current_share_outstanding = rawShares ? parseValue(rawShares) : 0;

    // Intrinsic Value (Graham Number)
    let graham_number = 0;
    if (eps > 0 && bvps > 0) {
      graham_number = Math.sqrt(22.5 * eps * bvps);
    }

    // Fetch Last Price from OHLC
    let last_price = 0;
    const lastOhlc = await prisma.oHLC.findFirst({
      where: { stockSymbol: symbol },
      orderBy: { date: 'desc' }
    });

    if (lastOhlc) {
      last_price = lastOhlc.close;
    }

    // Validity Check: if mostly 0, likely invalid (keep as before)
    if (per === 0 && pbv === 0 && roe === 0) return null;

    const result: FundamentalWithMeta = {
      symbol,
      per,
      pbv,
      roe,
      npm,
      der,
      current_ratio,
      rev_growth,
      ni_growth,
      price_ret_3m,
      last_price,
      total_equity,
      eps,
      bvps,
      graham_number,
      asset_turnover,
      inventory_turnover,
      current_share_outstanding,
      _missingFlags: missingFlags,
    };

    // Cast back to FundamentalData for external callers
    return result as FundamentalData;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Percentile scoring – improved to handle missing metrics (neutral 50)
// -----------------------------------------------------------------------------
function getPercentileScores(values: number[], lowerIsBetter = false): number[] {
  const indexed = values
    .map((v, i) => ({ v, i }))
    .filter((x) => !Number.isNaN(x.v));

  const scores = new Array(values.length).fill(50); // Neutral for missing

  const n = indexed.length;
  if (n === 0) return scores;

  indexed.sort((a, b) => a.v - b.v);

  indexed.forEach((item, rank) => {
    let pct: number;
    if (lowerIsBetter) {
      pct = ((n - rank) / n) * 100;
    } else {
      pct = ((rank + 1) / n) * 100;
    }
    scores[item.i] = pct;
  });

  return scores;
}

// -----------------------------------------------------------------------------
// Scoring logic – now uses PE + PBV, handles missing data via _missingFlags
// -----------------------------------------------------------------------------
function scoreList(data: FundamentalData[]): FundamentalData[] {
  const typed = data as FundamentalWithMeta[];

  const pbvs = typed.map((d) =>
    d._missingFlags?.pbv ? Number.NaN : d.pbv <= 0 ? Number.NaN : d.pbv
  );
  const pers = typed.map((d) =>
    d._missingFlags?.per ? Number.NaN : d.per <= 0 ? Number.NaN : d.per
  );
  const roes = typed.map((d) =>
    d._missingFlags?.roe ? Number.NaN : d.roe
  );
  const npms = typed.map((d) =>
    d._missingFlags?.npm ? Number.NaN : d.npm
  );
  const ders = typed.map((d) =>
    d._missingFlags?.der ? Number.NaN : d.der
  );
  const crs = typed.map((d) =>
    d._missingFlags?.current_ratio ? Number.NaN : d.current_ratio
  );
  const revs = typed.map((d) =>
    d._missingFlags?.rev_growth ? Number.NaN : d.rev_growth
  );
  const nis = typed.map((d) =>
    d._missingFlags?.ni_growth ? Number.NaN : d.ni_growth
  );

  // Market Cap for penalty (Total Equity * PBV). If any missing, treat as 0.
  const mcs = typed.map((d) => {
    const missingEq = d._missingFlags?.total_equity;
    const missingPbv = d._missingFlags?.pbv;
    if (missingEq || missingPbv) return 0;
    let mc = d.total_equity * d.pbv;
    if (!Number.isFinite(mc) || mc < 0) mc = 0;
    return mc;
  });

  const s_pbv = getPercentileScores(pbvs, true);  // lower PBV better
  const s_pe = getPercentileScores(pers, true);  // lower PE better
  const s_roe = getPercentileScores(roes, false);
  const s_npm = getPercentileScores(npms, false);
  const s_der = getPercentileScores(ders, true);  // lower DER better
  const s_cr = getPercentileScores(crs, false);
  const s_rev = getPercentileScores(revs, false);
  const s_ni = getPercentileScores(nis, false);

  return typed.map((d, i) => {
    let finalScore =
      s_pe[i] * WEIGHTS.pe +
      s_pbv[i] * WEIGHTS.pbv +
      s_roe[i] * WEIGHTS.roe +
      s_npm[i] * WEIGHTS.npm +
      s_der[i] * WEIGHTS.der +
      s_cr[i] * WEIGHTS.cr +
      s_rev[i] * WEIGHTS.rev +
      s_ni[i] * WEIGHTS.ni;

    const mc = mcs[i];

    // Keep your original thresholds if you prefer; here is a mildly softened version
    if (mc > 0 && mc < 500e9) {        // < 500B
      finalScore *= 0.60;
    } else if (mc < 1e12) {            // 500B–1T
      finalScore *= 0.80;
    } else if (mc < 1.5e12) {          // 1T–1.5T
      finalScore *= 0.95;
    } // else large caps keep full score

    const withScore = { ...d, score: finalScore };

    // Example debug – comment out if noisy:
    // if (d.symbol === "TOTL") {
    //   console.log("TOTL score breakdown:", {
    //     roe: d.roe, s_roe: s_roe[i],
    //     npm: d.npm, s_npm: s_npm[i],
    //     rev: d.rev_growth, s_rev: s_rev[i],
    //     ni: d.ni_growth, s_ni: s_ni[i],
    //     cr: d.current_ratio, s_cr: s_cr[i],
    //     der: d.der, s_der: s_der[i],
    //     pbv: d.pbv, s_pbv: s_pbv[i],
    //     pe: d.per, s_pe: s_pe[i],
    //     mc,
    //     finalScore,
    //   });
    // }

    return withScore as FundamentalData;
  });
}

// -----------------------------------------------------------------------------
// getRankedFundamentals – same API, internally uses improved scoreList
// -----------------------------------------------------------------------------
export async function getRankedFundamentals(): Promise<FundamentalData[]> {
  try {
    // 1. Get List of fundamentals from DB
    const fundamentals = await prisma.fundamental.findMany({
      select: { stockSymbol: true }
    });

    // 2. Load All in batches
    const results: FundamentalData[] = [];
    const batchSize = 50;
    const symbols = fundamentals.map(f => f.stockSymbol);

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const promises = batch.map((f) => loadFundamental(f));
      const loaded = await Promise.all(promises);
      results.push(...(loaded.filter(Boolean) as FundamentalData[]));
    }

    // 3. Score
    const scoreddata = scoreList(results);

    // 4. Sort by score DESC
    return scoreddata.sort((a, b) => (b.score || 0) - (a.score || 0));
  } catch (e) {
    console.error("Error in getRankedFundamentals", e);
    return [];
  }
}

// -----------------------------------------------------------------------------
// NEW: Absolute Scoring for Technical Chart display
// -----------------------------------------------------------------------------
export function analyzeFundamentalScores(data: FundamentalData): FundamentalScores {
  // Helper for color
  const getColor = (score: number): "green" | "yellow" | "red" => {
    if (score >= 70) return "green";
    if (score >= 40) return "yellow";
    return "red";
  };

  // 1. Undervalued (Graham)
  // Graham Number = sqrt(22.5 * EPS * BVPS)
  // If Metric is 0 or negative, we punish score.
  let gramScore = 50;
  const grahamNum = data.graham_number || 0;
  const price = data.last_price || 0;

  if (grahamNum > 0 && price > 0) {
    const upside = (grahamNum - price) / price; // e.g. 0.5 = 50% upside
    if (upside > 0.5) gramScore = 100;       // > 50% discount to Graham implied
    else if (upside > 0.2) gramScore = 80;   // > 20% upside
    else if (upside > 0) gramScore = 60;     // Some upside
    else if (upside > -0.2) gramScore = 40;  // Slight premium
    else gramScore = 20;                     // Huge premium
  } else if (price > 0 && data.eps > 0 && data.bvps > 0) {
    // Re-calc if missing but components exist
    const gn = Math.sqrt(22.5 * data.eps * data.bvps);
    const up = (gn - price) / price;
    if (up > 0.2) gramScore = 80; else gramScore = 40;
  } else {
    gramScore = 0; // Invalid
  }

  const undervalued: FundamentalScoreItem = {
    score: gramScore,
    label: "Undervalued",
    color: getColor(gramScore),
    metrics: [
      { label: "Graham", value: grahamNum.toLocaleString("id-ID", { maximumFractionDigits: 0 }) },
      { label: "Price", value: price.toLocaleString("id-ID") }
    ]
  };

  // 2. Growth
  // Rev Growth, NI Growth
  let growthScore = 50;
  const revG = data.rev_growth || 0;
  const niG = data.ni_growth || 0;

  let gRev = 50;
  if (revG > 20) gRev = 100;
  else if (revG > 10) gRev = 80;
  else if (revG > 0) gRev = 60;
  else if (revG > -10) gRev = 40;
  else gRev = 20;

  let gNi = 50;
  if (niG > 20) gNi = 100;
  else if (niG > 10) gNi = 80;
  else if (niG > 0) gNi = 60;
  else if (niG > -10) gNi = 40;
  else gNi = 20;

  growthScore = (gRev + gNi) / 2;

  const growth: FundamentalScoreItem = {
    score: growthScore,
    label: "Growth",
    color: getColor(growthScore),
    metrics: [
      { label: "Rev", value: revG.toFixed(1), suffix: "%" },
      { label: "NI", value: niG.toFixed(1), suffix: "%" }
    ]
  };

  // 3. Profitability
  // ROE, NPM
  const roe = data.roe || 0;
  const npm = data.npm || 0;

  let sRoe = 50;
  if (roe > 20) sRoe = 100;
  else if (roe > 15) sRoe = 85;
  else if (roe > 8) sRoe = 65;
  else if (roe > 0) sRoe = 50;
  else sRoe = 20;

  let sNpm = 50;
  if (npm > 15) sNpm = 100;
  else if (npm > 10) sNpm = 80;
  else if (npm > 5) sNpm = 60;
  else if (npm > 0) sNpm = 50;
  else sNpm = 20;

  const profScore = (sRoe + sNpm) / 2;
  const profitability: FundamentalScoreItem = {
    score: profScore,
    label: "Profitability",
    color: getColor(profScore),
    metrics: [
      { label: "ROE", value: roe.toFixed(1), suffix: "%" },
      { label: "NPM", value: npm.toFixed(1), suffix: "%" }
    ]
  };

  // 4. Valuation
  // PER, PBV (Lower better)
  const per = data.per || 0;
  const pbv = data.pbv || 0;

  let sPer = 50;
  if (per > 0) {
    if (per < 8) sPer = 100;
    else if (per < 15) sPer = 75;
    else if (per < 25) sPer = 50;
    else sPer = 25;
  } else if (per < 0) sPer = 10; // Negative earnings

  let sPbv = 50;
  if (pbv > 0) {
    if (pbv < 1) sPbv = 100;
    else if (pbv < 2) sPbv = 75;
    else if (pbv < 4) sPbv = 50;
    else sPbv = 25;
  }

  const valScore = (sPer + sPbv) / 2;
  const valuation: FundamentalScoreItem = {
    score: valScore,
    label: "Valuation",
    color: getColor(valScore),
    metrics: [
      { label: "PER", value: per.toFixed(1), prefix: "" },
      { label: "PBV", value: pbv.toFixed(1), prefix: "" }
    ]
  };

  // 5. Solvency
  // DER (Lower better), Current Ratio (Higher better)
  const der = data.der || 0;
  const cr = data.current_ratio || 0;

  let sDer = 50;
  if (der < 0.5) sDer = 100;
  else if (der < 1.0) sDer = 75;
  else if (der < 2.0) sDer = 50;
  else sDer = 25;

  let sCr = 50;
  if (cr > 2) sCr = 100;
  else if (cr > 1.5) sCr = 80;
  else if (cr > 1.0) sCr = 50;
  else sCr = 25;

  const solvScore = (sDer + sCr) / 2;
  const solvency: FundamentalScoreItem = {
    score: solvScore,
    label: "Solvency",
    color: getColor(solvScore),
    metrics: [
      { label: "DER", value: der.toFixed(2) },
      { label: "CR", value: cr.toFixed(2) }
    ]
  };

  // 6. Efficiency
  // Asset Turnover, Inventory Turnover
  // Generic Rules: Asset Turnover > 1 is good, Inventory Turnover > 5 is good.
  const at = data.asset_turnover || 0;
  const it = data.inventory_turnover || 0;

  let sAt = 50;
  if (at > 1.0) sAt = 100;
  else if (at > 0.7) sAt = 80;
  else if (at > 0.4) sAt = 60;
  else sAt = 40;

  let sIt = 50;
  // Inventory turnover varies wildly by industry. 
  // High volume (FMCG) > 10, Real Estate < 1. 
  // We use a safe middle ground.
  if (it > 8) sIt = 100;
  else if (it > 5) sIt = 80;
  else if (it > 2) sIt = 60;
  else sIt = 40;

  // If Metric is 0 (missing), keep score neutral 50.
  if (at === 0) sAt = 50;
  if (it === 0) sIt = 50;

  const effScore = (sAt + sIt) / 2;
  const efficiency: FundamentalScoreItem = {
    score: effScore,
    label: "Efficiency",
    color: getColor(effScore),
    metrics: [
      { label: "Asset T/O", value: at ? at.toFixed(2) : "-" },
      { label: "Inv T/O", value: it ? it.toFixed(2) : "-" }
    ]
  };

  return {
    undervalued,
    growth,
    profitability,
    valuation,
    solvency,
    efficiency
  };
}
