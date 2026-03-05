export type FundamentalData = {
  symbol: string;
  per: number;
  pbv: number;
  roe: number;
  npm: number;
  der: number;
  current_ratio: number;
  rev_growth: number;
  ni_growth: number;
  price_ret_3m: number;
  last_price?: number;
  total_equity: number;
  eps: number;
  bvps: number;
  graham_number: number;
  asset_turnover?: number;
  inventory_turnover?: number;
  score?: number;
};

export interface FundamentalScoreItem {
  score: number;
  label: string;
  metrics: { label: string; value: string | number; prefix?: string; suffix?: string }[];
  color: "green" | "yellow" | "red";
}

export interface FundamentalScores {
  undervalued: FundamentalScoreItem;
  growth: FundamentalScoreItem;
  profitability: FundamentalScoreItem;
  valuation: FundamentalScoreItem;
  solvency: FundamentalScoreItem;
  efficiency: FundamentalScoreItem;
}
