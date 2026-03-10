export const FOREIGN_BROKERS = new Set([
  "AK", // UBS Sekuritas
  "BK", // J.P. Morgan
  "CS", // Credit Suisse
  "DB", // Deutsche Bank
  "DP", // DBS Vickers
  "GW", // HSBC
  "KZ", // CLSA
  "ML", // Merrill Lynch
  "MS", // Morgan Stanley
  "RX", // Macquarie
  "YU", // CGS-CIMB
  "ZP", // Maybank Kim Eng
  // Known foreign associated/regional: 
  "AG", "AI", "AT", "FO", "GE", "GN", "IF", "OD", "RB", "TF", "VQ", "WS"
]);

// Helper to check
export function isForeignBroker(code: string) {
  return FOREIGN_BROKERS.has(code);
}
