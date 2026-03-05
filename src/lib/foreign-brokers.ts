export const FOREIGN_BROKERS = new Set([
  "AK", // UBS Sekuritas
  "BK", // J.P. Morgan
  "CC", // Mandiri Sekuritas (Often has foreign flow) - Wait, CC is Mandiri (Local/SOE), but often used by foreign. 
        // STRICT Foreign:
  "CS", // Credit Suisse
  "DB", // Deutsche Bank
  "DP", // DBS Vickers
  "DR", // RHB (Foreign/Regional)
  "DX", // Bahana (Local, but distinct) -> Maybe not.
  "FG", // Nomura
  "GW", // HSBC
  "KZ", // CLSA
  "LG", // Trimegah (Local) -> Remove
  "ML", // Merrill Lynch
  "MS", // Morgan Stanley
  "NI", // BNI (Local) -> Remove
  "RX", // Macquarie
  "TP", // Ocbc
  "YU", // CGS-CIMB
  "ZP", // Maybank Kim Eng
  "AG", "AI", "AT", "CG", "FO", "GE", "GN", "IF", "KI", "OD", "PD", "PG", "RB", "RG", "RO", "RS", "SH", "TF", "VQ", "WS"
]);

// Helper to check
export function isForeignBroker(code: string) {
    return FOREIGN_BROKERS.has(code);
}
