export interface MarketDataUpdate {
    symbol: string;
    type: string;
    side?: string;
    timestamp?: number;
    levels?: { price: number, orders: number, volume: number }[];
    price?: number;
    volume?: number;
}

export class MarketDataParser {
    static parse(raw: string): MarketDataUpdate | null {
        if (!raw || typeof raw !== "string" || !raw.startsWith("#")) return null;

        const parts = raw.split("|");
        const type = parts[0];

        if (type === "#O") { // Orderbook Quote
            // Format: #O|SYMBOL|SIDE|...Levels (Price;Orders;Volume)
            if (parts.length < 4) return null;

            const symbol = parts[1];
            const side = parts[2];
            const levels: { price: number, orders: number, volume: number }[] = [];

            for (let i = 3; i < parts.length; i++) {
                const levelData = parts[i].split(";");
                if (levelData.length >= 3) {
                    levels.push({
                        price: parseInt(levelData[0]),
                        orders: parseInt(levelData[1]),
                        volume: parseInt(levelData[2]),
                    });
                }
            }

            return {
                symbol,
                type: "DEPTH",
                side,
                levels,
                timestamp: Date.now()
            };

        } else if (type === "#T") { // Trade
            // Format usually: #T|SYMBOL|PRICE|VOL|SIDE|TYPE|ID|TIMESTAMP
            if (parts.length < 4) return null;

            const symbol = parts[1];
            const price = parseInt(parts[2]);
            const volume = parseInt(parts[3]);
            const side = parts[4] === "1" ? "BUY" : parts[4] === "2" ? "SELL" : undefined;

            return {
                symbol,
                type: "TRADE",
                price,
                volume,
                side,
                timestamp: Date.now()
            };
        }

        return {
            symbol: parts[1] || "UNKNOWN",
            type: "UNKNOWN",
            timestamp: Date.now()
        };
    }
}
