
// Derived from scripts/retail_backtest.py and common market knowledge

export const RETAIL_BROKERS = new Set([
  "YP", // Mirae
  "PD", // Indo Premier
  "XC", // Ajaib
  "XL", // Stockbit
  "NI", // BNI
  "KK", // Phillip
  "SQ", // BCA
  "CC", // Mandiri (Often Retail)
  "AZ", // Sucor (Often Retail)
  "EP", // MNC
  "BQ", // Korea Investment (Retail wing)
  "GR", // Panin
  "DR", // RHB (Retail wing)
]);

// Common "Insider" / Market Maker / Bandar Brokers
// These are often associated with strong directional moves or specific accumulation patterns
export const INSIDER_BROKERS = new Set([
  "MG", // Semesta Indovest
  "YU", // CGS-CIMB (Often Market Maker)
  "ZP", // Maybank (Often Market Maker)
  "LG", // Trimegah
  "DH", // Sinarmas
  "HP", // Henan
  "OD", // BRI Danareksa (Insto/Insider)
  "KI", // Ciptadana
  "CP", // Valbury
  "RF", // Buana
]);

import { FOREIGN_BROKERS } from "./foreign-brokers";

export function getBrokerType(code: string): "RETAIL" | "INSIDER" | "FOREIGN" | "OTHERS" {
    if (RETAIL_BROKERS.has(code)) return "RETAIL";
    if (INSIDER_BROKERS.has(code)) return "INSIDER";
    if (FOREIGN_BROKERS.has(code)) return "FOREIGN";
    return "OTHERS";
}

export { FOREIGN_BROKERS };
