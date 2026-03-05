export type RunningTradeRaw = {
    time: string;
    code: string;
    action: "buy" | "sell";
    price: string;
    lot: string;
    buyer: string;
    seller: string;
    up_down: string;
    trade_number: string;
    id: string;
    market_board: string;
};

export type RunningTradeApiResponse = {
    data: {
        running_trade: RunningTradeRaw[];
        is_hault: number;
    };
    message: string;
};

export type TradeSequence = {
    date: string;
    time: string; // from the first tick of the block
    code: string;
    price: number;
    action: "buy" | "sell";
    sequenceLot: number;
    sequenceValue: number;
    aggressorBroker: string; // Active side
    counterBroker: string; // Passive side (can be MIXED)
    buyerRaw: string; // Sample of raw buyer field
    sellerRaw: string; // Sample of raw seller field
    tradeNumbers: string[]; // List of all execution sequence identifiers
};

export type TierSideBrokerDetail = {
    broker: string;
    frequency: number;
    value: number;
    lot: number;
};

export type TierSideAggregated = {
    frequency: number;
    value: number;
    lot: number;
    brokers: string[]; // Sorted alphabetically
    details: TierSideBrokerDetail[]; // Sorted by value DESC
};

export type TierAggregated = {
    aggressive_buy: TierSideAggregated;
    aggressive_sell: TierSideAggregated;
    passive_buy: TierSideAggregated;
    passive_sell: TierSideAggregated;
    net_value: number;
    net_lot: number;
    net_direction: "BUY" | "SELL" | "NEUTRAL";
};

export type TierId = "T1" | "T2" | "T3" | "T4" | "T5" | "T6" | "T7" | "T8" | "T9" | "T10";

export type TierDefinition = {
    id: TierId;
    label: string;
    min: number;
    max: number | null;
    reason: string;
};

export type ZoneAggregated = {
    tiers: TierId[];
    aggressive_buy_value: number;
    aggressive_sell_value: number;
    passive_buy_value: number;
    passive_sell_value: number;
    aggressive_buy_lot: number;
    aggressive_sell_lot: number;
    passive_buy_lot: number;
    passive_sell_lot: number;
    net_value: number;
    net_lot: number;
};

export type BigplayerRetailDirection = "ACCUM" | "DIST" | "NEUTRAL";

export type DailyBidOfferEntry = {
    symbol: string;
    date: string;
    tiers: Record<TierId, TierAggregated>;
    zones: {
        bigplayer: ZoneAggregated;
        transition: ZoneAggregated;
        retail: ZoneAggregated;
    };
    summary: {
        total_aggressive_buy_value: number;
        total_aggressive_sell_value: number;
        total_passive_buy_value: number;
        total_passive_sell_value: number;
        total_aggressive_buy_lot: number;
        total_aggressive_sell_lot: number;
        total_passive_buy_lot: number;
        total_passive_sell_lot: number;
        total_net_value: number;
        total_net_lot: number;
        bigplayer_net_value: number;
        bigplayer_net_lot: number;
        retail_net_value: number;
        retail_net_lot: number;
        bigplayer_share_pct: number;
        retail_share_pct: number;
        bigplayer_vs_retail_direction: BigplayerRetailDirection;
    };
    meta: {
        total_sequences: number;
        total_buy_sequences: number;
        total_sell_sequences: number;
        generated_at: string;
    };
};

export type CounterBrokerShare = {
    broker: string;
    lot: number;
    value: number;
    percentage: number;
};
