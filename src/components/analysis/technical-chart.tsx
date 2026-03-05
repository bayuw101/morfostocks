"use client";

import { useState, useMemo, useRef } from "react";
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,

    ReferenceLine,
    ReferenceArea, // Import ReferenceArea
    Cell,
    Label as RechartsLabel // Import Label
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

// Helper: Find Nearest Fractal Support/Resistance
function calculateDynamicLevels(data: ChartData[]) {
    if (data.length < 5) return { support: Math.min(...data.map(d => d.low)), resistance: Math.max(...data.map(d => d.high)) };

    const pivotsHigh: number[] = [];
    const pivotsLow: number[] = [];

    // 5-bar fractal (2 left, 2 right)
    for (let i = 2; i < data.length - 2; i++) {
        const d = data[i];
        const isHigh = data[i - 1].high < d.high && data[i - 2].high < d.high && data[i + 1].high < d.high && data[i + 2].high < d.high;
        const isLow = data[i - 1].low > d.low && data[i - 2].low > d.low && data[i + 1].low > d.low && data[i + 2].low > d.low;

        if (isHigh) pivotsHigh.push(d.high);
        if (isLow) pivotsLow.push(d.low);
    }

    const currentPrice = data[data.length - 1].close;

    // Find nearest support (below price)
    // We sort descending to find the highest value that is LOWEST than current
    const supports = pivotsLow.filter(p => p < currentPrice).sort((a, b) => b - a);
    const nearestSupport = supports.length > 0 ? supports[0] : Math.min(...data.map(d => d.low));

    // Find nearest resistance (above price)
    // Sort ascending to find lowest value that is HIGHER than current
    const resistances = pivotsHigh.filter(p => p > currentPrice).sort((a, b) => a - b);
    const nearestResistance = resistances.length > 0 ? resistances[0] : Math.max(...data.map(d => d.high));

    return { support: nearestSupport, resistance: nearestResistance };
}

// Helper: Calculate Smart Support (Avg Price) for Broker
function calculateSmartSupport(data: ChartData[], brokers: BrokerHistoryItem[], selectedBroker: string | null): Record<string, number | null> {
    if (!selectedBroker || !brokers || brokers.length === 0) return {};

    console.log("[SmartSupport] Calculating for", selectedBroker, "Data Points:", data.length);

    const supportMap: Record<string, number | null> = {};

    // Create quick lookup for date -> broker value
    const brokerMap = new Map<string, number>();
    brokers.forEach(b => {
        if (b.brokers[selectedBroker]) {
            brokerMap.set(b.date, b.brokers[selectedBroker]);
        }
    });

    console.log("[SmartSupport] Broker Map Size:", brokerMap.size);

    // Strategy: Volume Weighted Average Price (VWAP) of Inventory
    // We assume we start from 0 inventory at the beginning of the loaded data.
    // Ideally we'd need historical start, but for this timeframe analysis, relative start is okay.

    let inventory = 0;
    let avgPrice = 0;

    // Use sorted full data to track evolution chronologically
    const cronData = [...data].sort((a, b) => a.date.localeCompare(b.date));

    cronData.forEach(d => {
        const netValue = brokerMap.get(d.date) || 0;

        // Estimate Avg Transaction Price for this day = Typical Price (H+L+C)/3
        const typicalPrice = (d.high + d.low + d.close) / 3;

        // Estimate Volume = Value / Price
        // Note: netValue is in Rupiah (presumably). 
        // If netValue is +ve (Buy), we add to inventory.
        // If netValue is -ve (Sell), we reduce inventory.

        if (Math.abs(netValue) > 0) {
            const estimatedVol = netValue / typicalPrice;
            const signedVol = estimatedVol; // netValue is signed

            // Update Inventory and Weighted Avg
            const oldTotalVal = inventory * avgPrice;
            const newTxVal = signedVol * typicalPrice;
            const newInventory = inventory + signedVol;

            if (Math.abs(newInventory) > 0.0001) { // Avoid float epsilon zero
                // Logic: 
                // If we are ADDING to position (Long Buy OR Short Sell), Avg Price moves towards Tx Price.
                // If we are CLOSING position (Long Sell OR Short Buy), Avg Price *should* stay same (realized PnL).

                const isIncreasingPosition = (inventory >= 0 && signedVol > 0) || (inventory <= 0 && signedVol < 0);
                const isFlipping = (inventory > 0 && newInventory < 0) || (inventory < 0 && newInventory > 0);

                if (isFlipping) {
                    // Reset to current price if we flip side
                    avgPrice = typicalPrice;
                } else if (isIncreasingPosition) {
                    // Averaging
                    avgPrice = (oldTotalVal + newTxVal) / newInventory;
                } else {
                    // Reducing -> Avg Price stays same
                }
            } else {
                avgPrice = 0;
            }
            inventory = newInventory;
        }

        // Show line if we have an active AvgPrice (meaning we had activity)
        if (Math.abs(avgPrice) > 0) {
            supportMap[d.date] = avgPrice;
        } else {
            supportMap[d.date] = null;
        }
    });

    return supportMap;
}

interface ChartData {
    date: string;
    close: number;
    open: number;
    high: number;
    low: number;
    volume: number;
    rsi: number | null;
    macd: number | null;
    macd_signal: number | null;
    macd_hist: number | null;
    bb_upper: number | null;
    bb_lower: number | null;
    bb_middle: number | null;
    vol_ma: number | null;
    net_foreign: number;
    broker_support?: number | null; // New Field
}


// Helper for compact number formatting (T/B/M/K)
const formatCompactNumber = (number: number) => {
    if (Math.abs(number) >= 1_000_000_000_000) {
        return (number / 1_000_000_000_000).toFixed(2) + "T";
    }
    if (Math.abs(number) >= 1_000_000_000) {
        return (number / 1_000_000_000).toFixed(2) + "B";
    }
    if (Math.abs(number) >= 1_000_000) {
        return (number / 1_000_000).toFixed(2) + "M";
    }
    if (Math.abs(number) >= 1_000) {
        return (number / 1_000).toFixed(2) + "K";
    }
    return number.toString();
};

const formatPrice = (price: number) => {
    return price.toString();
};

const CustomTooltip = (props: any) => {
    const { active, payload, label, activeChartId, ownId } = props;
    if (active && payload && payload.length) {
        // Prevent tooltip from showing if not the active chart
        if (activeChartId && ownId && activeChartId !== ownId) return null;

        // Find the main data point (merged object)
        const d = payload[0].payload;
        return (
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-xl text-xs space-y-2 min-w-[140px] z-50 pointer-events-none">
                <div className="font-bold border-b border-gray-100 pb-1 mb-1 text-gray-500">
                    {format(new Date(label), "dd MMM yyyy")}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className="text-gray-400">Open:</span>
                    <span className="font-mono text-right text-gray-700">{formatPrice(d.open)}</span>

                    <span className="text-gray-400">High:</span>
                    <span className="font-mono text-right text-gray-700">{formatPrice(d.high)}</span>

                    <span className="text-gray-400">Low:</span>
                    <span className="font-mono text-right text-gray-700">{formatPrice(d.low)}</span>

                    <span className="text-gray-400">Close:</span>
                    <div className="text-right">
                        <span className={`font-mono font-bold ${d.close >= d.open ? "text-emerald-600" : "text-rose-600"}`}>
                            {formatPrice(d.close)}
                        </span>
                        <span className={`text-[10px] ml-1 ${d.close >= d.open ? "text-emerald-500" : "text-rose-500"}`}>
                            ({((d.close - d.open) / d.open * 100).toFixed(2)}%)
                        </span>
                    </div>

                    <span className="text-gray-400">Volume:</span>
                    <span className="font-mono text-right text-gray-700">{formatCompactNumber(d.volume)}</span>

                    {d.broker_accum !== null && d.broker_accum !== undefined && (
                        <>
                            <span className="text-amber-500 font-medium">Accum:</span>
                            <span className="font-mono text-amber-500 text-right font-bold">{formatCompactNumber(d.broker_accum)}</span>
                        </>
                    )}

                    {d.net_foreign !== undefined && (
                        <>
                            <span className="text-gray-400">Net Foreign:</span>
                            <span className={`font-mono text-right font-bold ${d.net_foreign >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                {formatCompactNumber(d.net_foreign)}
                            </span>
                        </>
                    )}
                </div>

                {(d.rsi != null || d.macd != null) && (
                    <div className="border-t pt-1 mt-1 grid grid-cols-2 gap-x-4">
                        {d.rsi != null && (
                            <>
                                <span className="text-violet-500">RSI:</span>
                                <span className="font-mono text-right text-gray-700">{d.rsi.toFixed(1)}</span>
                            </>
                        )}
                        {d.macd != null && (
                            <>
                                <span className="text-blue-500">MACD:</span>
                                <span className="font-mono text-right text-gray-700">{d.macd.toFixed(2)}</span>
                            </>
                        )}
                    </div>
                )}
            </div>
        );
    }
    return null;
};

// Helper: Calculate EMA
function calculateEMA(data: ChartData[], period: number): number[] {
    const k = 2 / (period + 1);
    const emaArray: number[] = new Array(data.length).fill(null);

    // Simple Moving Average for the first 'period' point
    if (data.length < period) return emaArray;

    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i].close;
    }
    emaArray[period - 1] = sum / period;

    // Calculate EMA for the rest
    for (let i = period; i < data.length; i++) {
        const prevEMA = emaArray[i - 1];
        const close = data[i].close;
        emaArray[i] = (close * k) + (prevEMA * (1 - k));
    }

    return emaArray;
}



interface BrokerHistoryItem {
    date: string;
    brokers: Record<string, number>;
}
// ... (Interfaces remain roughly same, skipping re-definition if not needed, but I need to insert state)

// wait, I can't insert state here. I need to insert the function outside and state inside component. 
// I will split this modification. First, insert helper function at top.


interface TechnicalChartProps {
    data: ChartData[];
    symbol: string;
    brokers?: BrokerHistoryItem[];
    className?: string; // For container adjustments
    mainChartHeight?: string; // e.g., "h-[300px]"
    timeframe: string;
    showRSI?: boolean;
    showMACD?: boolean;
    showEMA?: boolean;
    selectedBroker: string | null;
    showForeignOnly?: boolean;
    compact?: boolean; // Strip card/header, minimize margins
}

// Define CustomTooltip props explicitly to avoid naming collision issues or scope issues
const CustomTooltipWrapper = (props: any) => <CustomTooltip {...props} />;

export function TechnicalChart({ data, symbol, brokers = [], className, mainChartHeight = "h-[300px]", timeframe, showRSI = false, showMACD = false, showEMA = false, selectedBroker, showForeignOnly = false, compact = false }: TechnicalChartProps) {
    // Interaction State
    const [boxes, setBoxes] = useState<Array<{ id: string, startPrice: number, endPrice: number, startDate: string, endDate: string }>>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [activeChartId, setActiveChartId] = useState<string | null>(null);

    // We still use state for the "Saved" box after drawing is done, if we want it to persist cleanly.
    // But for the drawing interaction itself, we use Refs.

    const containerRef = useState<HTMLDivElement | null>(null);
    const cursorLineRef = useRef<HTMLDivElement>(null);
    const cursorLabelRef = useRef<HTMLDivElement>(null);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const hoveredDateRef = useRef<string | null>(null);

    // DOM Refs for Box
    const measureBoxRef = useRef<HTMLDivElement>(null);
    const measureLabelRef = useRef<HTMLSpanElement>(null);
    const dragStartRef = useRef<{ x: number, y: number, price: number, date: string } | null>(null);
    const headerCursorPriceRef = useRef<HTMLSpanElement>(null);
    const currentCursorPriceRef = useRef<number | null>(null);

    // Handlers
    const handleMouseMove = (e: any) => {

        if (chartContainerRef.current && cursorLineRef.current && cursorLabelRef.current) {
            const rect = chartContainerRef.current.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const x = e.clientX - rect.left; // Needed for Box X
            const height = rect.height;
            const marginTop = 10;
            const plottingHeight = height - marginTop;

            // Clamp Y
            const clampedY = Math.max(marginTop, Math.min(height, y));

            // Update Crosshair Line
            cursorLineRef.current.style.top = `${clampedY}px`;
            cursorLineRef.current.style.display = 'block';

            // Calculate Price
            const relativeY = clampedY - marginTop;
            const yRatio = relativeY / plottingHeight;
            const domainRange = viewMax - viewMin;
            const price = viewMax - (yRatio * domainRange);

            // SNAP TO TICK
            let tick = 1;
            if (price < 200) tick = 1;
            else if (price < 500) tick = 2;
            else if (price < 2000) tick = 5;
            else if (price < 5000) tick = 10;
            else tick = 25;

            const snappedPrice = Math.round(price / tick) * tick;

            // Update Crosshair Label
            cursorLabelRef.current.innerText = snappedPrice.toLocaleString();

            // Store current price in Ref for Click handlers (avoiding state)
            currentCursorPriceRef.current = snappedPrice;

            // UPDATE DRAWING BOX (Direct DOM)
            if (isDrawing && measureBoxRef.current && dragStartRef.current) {
                const startY = dragStartRef.current.y;
                const startX = dragStartRef.current.x;

                // Calculate Box Dimensions
                const top = Math.min(startY, clampedY);
                const boxHeight = Math.abs(clampedY - startY);
                const left = Math.min(startX, x);
                const width = Math.abs(x - startX);

                measureBoxRef.current.style.display = 'flex';
                measureBoxRef.current.style.top = `${top}px`;
                measureBoxRef.current.style.height = `${boxHeight}px`;
                measureBoxRef.current.style.left = `${left}px`;
                measureBoxRef.current.style.width = `${width}px`;

                // Calculate % Change
                const startPrice = dragStartRef.current.price;
                const diff = snappedPrice - startPrice;
                const percent = (diff / startPrice) * 100;
                const changeText = `${diff > 0 ? '+' : ''}${percent.toFixed(2)}%`;

                if (measureLabelRef.current) {
                    measureLabelRef.current.innerText = `${changeText} (${(snappedPrice - startPrice).toLocaleString()})`;
                    measureBoxRef.current.style.backgroundColor = diff >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)';
                    measureBoxRef.current.style.borderColor = diff >= 0 ? '#22c55e' : '#ef4444';
                }
            }
        }
    };

    const handleChartClick = (e: any) => {
        if (!chartContainerRef.current) return;

        // If NOT drawing, START drawing
        if (!isDrawing) {
            // CHECK LIMIT: Max 2 boxes
            if (boxes.length >= 2) return;

            const rect = chartContainerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            // Use currentCursorPrice from Ref
            const cursorPrice = currentCursorPriceRef.current;
            const currentDate = hoveredDateRef.current;

            if (cursorPrice !== null && currentDate) {
                // We need the Y position corresponding to cursorPrice to align perfectly.
                const domainRange = viewMax - viewMin;
                const yRatio = (viewMax - cursorPrice) / domainRange;
                const marginTop = 10;
                const plottingHeight = rect.height - marginTop;
                const snappedY = (yRatio * plottingHeight) + marginTop;

                dragStartRef.current = { x, y: snappedY, price: cursorPrice, date: currentDate };
                setIsDrawing(true);

                // Reset Box Style
                if (measureBoxRef.current) {
                    measureBoxRef.current.style.display = 'none'; // Hide until move
                    measureBoxRef.current.style.width = '0px';
                    measureBoxRef.current.style.height = '0px';
                }
            }
        }
        // If DRAWING, FINISH drawing
        else {
            if (dragStartRef.current && currentCursorPriceRef.current && hoveredDateRef.current) {
                const newBox = {
                    id: Date.now().toString(),
                    startPrice: dragStartRef.current.price,
                    endPrice: currentCursorPriceRef.current,
                    startDate: dragStartRef.current.date,
                    endDate: hoveredDateRef.current
                };
                setBoxes([...boxes, newBox]);
            }
            setIsDrawing(false);
            // Hide DOM Box reset
            if (measureBoxRef.current) {
                measureBoxRef.current.style.display = 'none';
            }
        }
    };

    const removeBox = (id: string, e?: any) => {
        if (e) e.stopPropagation(); // Prevent chart click ? 
        setBoxes(boxes.filter(b => b.id !== id));
    };

    if (!data || data.length === 0) return <div>No data</div>;

    // DEBUG HEADER
    // return <div className="text-xs">Data: {data.length} items. Timeframe: {timeframe}</div>; // Just validating data exists

    // Filter data based on timeframe
    const filteredData = useMemo(() => {
        const period = parseInt(timeframe);
        return data.slice(-period);
    }, [data, timeframe]);

    // Calculate Top Brokers for the SELECTED timeframe
    const topBrokers = useMemo(() => {
        // 1. Get relevant dates from filteredData
        const validDates = new Set(filteredData.map(d => d.date));

        // 2. Filter broker history to these dates
        const relevantBrokerHistory = brokers.filter(b => validDates.has(b.date));

        // 3. Sum up net values per broker
        const brokerTotals: Record<string, number> = {};
        relevantBrokerHistory.forEach(day => {
            Object.entries(day.brokers).forEach(([code, val]) => {
                brokerTotals[code] = (brokerTotals[code] || 0) + val;
            });
        });

        // 4. Sort by Net Accum (Desc)
        return Object.entries(brokerTotals)
            .filter(([code]) => code !== "total_net") // Exclude total_net summary
            .sort(([, a], [, b]) => b - a)
            .map(([code, val]) => ({ code, val }));
    }, [filteredData, brokers]);

    // Preprocess data for Candlesticks (Ranges) AND Broker Line
    // We need to map 'net accumm' line for selected broker
    // Accum starts from 0 at the beginning of the VISIBLE period.

    // Create a fast lookup map for broker data [date] -> { [broker]: value }
    const brokerDataMap = useMemo(() => {
        const map = new Map<string, Record<string, number>>();
        brokers.forEach(b => {
            map.set(b.date, b.brokers);
        });
        return map;
    }, [brokers]);

    // Calculate Smart Broker Support (Avg Price)
    const brokerSupportMap = useMemo(() => {
        // Use memoized full data/brokers to prevent recalc on every zoom
        const map = calculateSmartSupport(data, brokers, selectedBroker);
        console.log("[SmartSupport] Broker:", selectedBroker, "Map Keys:", Object.keys(map).length);
        return map;
    }, [data, brokers, selectedBroker]);

    const chartData = useMemo(() => {
        // 1. Calculate EMAs on FULL data first to ensure accuracy across timeframes
        // Use raw 'data' prop here to calculate technicals correctly
        const ema20 = calculateEMA(data, 20);
        const ema200 = calculateEMA(data, 200);

        // Create a map for fast lookup of EMA values by date
        const emaMap = new Map<string, { ema20: number | null, ema200: number | null }>();
        data.forEach((d, i) => {
            emaMap.set(d.date, { ema20: ema20[i], ema200: ema200[i] });
        });

        let currentAccum = 0;
        return filteredData.map(d => {
            let brokerAccum = null;
            if (selectedBroker) {
                // Find broker value for this date using Map
                const dayBrokers = brokerDataMap.get(d.date);
                const dayVal = dayBrokers ? (dayBrokers[selectedBroker] || 0) : 0;

                currentAccum += dayVal;
                brokerAccum = currentAccum;
            }

            let bodyMin = Math.min(d.open, d.close);
            let bodyMax = Math.max(d.open, d.close);

            // If Open == Close (Doji / ARA), give it a minimal visual height
            if (bodyMin === bodyMax) {
                const offset = bodyMin * 0.002;
                bodyMax = bodyMin + (offset < 1 ? 1 : offset);
            }

            const emas = emaMap.get(d.date);
            const smartSupport = brokerSupportMap[d.date]; // Look up support

            return {
                ...d,
                candle_wick: [d.low, d.high],
                candle_body: [bodyMin, bodyMax],
                broker_accum: brokerAccum,
                broker_support: smartSupport, // Inject
                ema20: emas?.ema20,
                ema200: emas?.ema200
            };
        });
    }, [filteredData, data, selectedBroker, brokerDataMap, brokerSupportMap]);

    const timeframes = ["5", "20", "40", "60", "80", "100", "150", "200"];

    // Calculate Support/Resistance using Fractal Logic on the visible range
    // Note: calculateDynamicLevels internally uses the whole dataset or filtered set
    const { support, resistance } = useMemo(() => calculateDynamicLevels(filteredData), [filteredData]);

    // Calculate Cumulative Broker Data for Overlay

    // Calculate Cumulative Broker Data for Overlay
    const brokerOverlayData = useMemo(() => {
        // We use filteredData to ensure we match the visible chart logic if needed, 
        // but typically accumulation needs to be from start of time or start of dataset. 
        // Let's use 'data' (full range) for accumulation calc, but slice for domain.
        // Priority: Foreign Only > Selected Broker
        if (showForeignOnly) {
            let accum = 0;
            return data.map(item => {
                const val = item.net_foreign || 0;
                accum += val;
                return { date: item.date, value: accum };
            });
        }

        if (!selectedBroker || !brokers) return null;

        // Create a map of date -> value for selected broker from history
        const brokerMap = new Map<string, number>();

        // Sort brokers by date ascending to calc accum
        const sortedHistory = [...brokers].sort((a, b) => a.date.localeCompare(b.date));

        let cumulative = 0;
        sortedHistory.forEach(day => {
            const val = day.brokers[selectedBroker] || 0;
            cumulative += val;
            brokerMap.set(day.date, cumulative);
        });

        // Map to chart data dates
        return data.map(item => {
            // If we have exact date match, use it. 
            // If not, use the last known cumulative value (or 0 if before start)
            // Since sortedHistory might differ from chart frame.
            // Simplified: use exact match or undefined
            const val = brokerMap.get(item.date);
            return { date: item.date, value: val };
        });
    }, [selectedBroker, brokers, data, showForeignOnly]);

    // Compute domain for the secondary axis (Broker Accum)
    const brokerDomain = useMemo(() => {
        if (!brokerOverlayData) return null;
        // Filter for visible range roughly matches filteredData length.
        // Since filteredData is the viewed subset.

        // Map filteredData dates to brokerOverlayData values
        const visibleValues = filteredData.map(d => {
            const match = brokerOverlayData.find(b => b.date === d.date);
            return match ? match.value : undefined;
        }).filter(v => v !== undefined) as number[];

        if (visibleValues.length === 0) return null;

        const min = Math.min(...visibleValues);
        const max = Math.max(...visibleValues);
        const padding = (max - min) * 0.1; // 10% padding
        return [min - padding, max + padding];
    }, [brokerOverlayData, filteredData]);
    // Calculate Domain for Y-Axis (View Logic)
    const { viewMin, viewMax } = useMemo(() => {
        if (!filteredData || filteredData.length === 0) return { viewMin: 0, viewMax: 100 };

        const lows = filteredData.map(d => d.low);
        const highs = filteredData.map(d => d.high);
        const min = Math.min(...lows);
        const max = Math.max(...highs);
        const padding = (max - min) * 0.1; // 10% padding

        return {
            viewMin: min - padding,
            viewMax: max + padding
        };
    }, [filteredData]);

    // Support/Resistance are strictly for ReferenceLines, not Domain
    const minLow = support;
    const maxHigh = resistance;

    return (
        <div className={compact ? "space-y-2" : "space-y-4"}>
            {/* Global Style Override for Recharts Focus */}
            <style jsx global>{`
        .recharts-wrapper {
            outline: none !important;
            border: none !important;
        }
        .recharts-surface:focus {
            outline: none !important;
        }
      `}</style>


            {/* MAIN PRICE CHART */}
            <div className={compact ? "" : "bg-white dark:bg-white/[0.03] rounded-xl shadow-sm border border-gray-100 dark:border-white/10"}>
                {!compact && (
                    <div className="py-1.5 sm:py-2 px-3 sm:px-4 flex flex-row items-center justify-between border-b border-gray-100 dark:border-white/10">
                        <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                            Price History
                        </span>
                    </div>
                )}
                <div className={`${mainChartHeight} p-0 outline-none ring-0 focus:outline-none`}>
                    <div
                        ref={chartContainerRef}
                        className="w-full h-full relative cursor-crosshair outline-none ring-0 focus:outline-none focus:ring-0"
                        onMouseMove={(e) => {
                            setActiveChartId("main");
                            handleMouseMove(e);
                        }}
                        onMouseLeave={() => {
                            setActiveChartId(null);
                            if (cursorLineRef.current) cursorLineRef.current.style.display = 'none';
                        }}
                        onClick={handleChartClick}
                    >
                        {/* PERFORMANCE CROSSHAIR OVERLAY */}
                        <div
                            ref={cursorLineRef}
                            className="absolute left-0 right-0 border-t border-dashed border-gray-400 z-50 pointer-events-none hidden"
                            style={{ top: 0 }}
                        >
                            <div ref={cursorLabelRef} className="absolute left-0 -top-3 bg-slate-800 text-white text-[10px] px-1 rounded font-mono">
                                0
                            </div>
                        </div>

                        {/* MEASUREMENT BOX OVERLAY (DOM) */}
                        <div
                            ref={measureBoxRef}
                            className="absolute border z-40 flex items-center justify-center hidden pointer-events-none"
                            style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', borderColor: '#22c55e' }}
                        >
                            <span ref={measureLabelRef} className="bg-black/75 text-white text-xs px-1 rounded font-mono">0%</span>
                        </div>

                        <ResponsiveContainer width="100%" height="100%" className="outline-none ring-0 focus:outline-none focus:ring-0 [&_.recharts-wrapper]:outline-none [&_.recharts-wrapper]:ring-0">
                            <ComposedChart
                                syncId="tech-sync"
                                data={chartData}
                                margin={{ top: 10, right: compact ? 0 : 5, left: 0, bottom: 0 }} // Matched in mouse handler
                                onMouseMove={(e: any) => {
                                    if (e && e.activeLabel) {
                                        hoveredDateRef.current = e.activeLabel;
                                    }
                                    setActiveChartId("main");
                                }}
                                onMouseLeave={() => setActiveChartId(null)}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                <XAxis
                                    dataKey="date"
                                    hide
                                />
                                {/* Secondary XAxis for Layering Wick Bar properly (prevent side-by-side offset) */}
                                <XAxis
                                    xAxisId="wick"
                                    dataKey="date"
                                    hide
                                />
                                <YAxis
                                    yAxisId="price"
                                    domain={[viewMin, viewMax]}
                                    orientation="right"
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={(val: number) => val.toLocaleString()}
                                    // FORCE STRICT DOMAIN to match manual calculation
                                    allowDataOverflow={true}
                                    padding={{ top: 0, bottom: 0 }}
                                    type="number"
                                />
                                {/* Independent Axis for Broker Accumulation (Left Side) - Hidden Labels, Visible Line */}
                                <YAxis
                                    yAxisId="broker"
                                    orientation="left"
                                    hide={!selectedBroker && !showForeignOnly} // Hide if neither is active
                                    tick={false}
                                    axisLine={false}
                                    width={0}
                                    domain={brokerDomain || ['auto', 'auto']} // Use dynamic domain
                                />



                                <Tooltip
                                    content={(props: any) => <CustomTooltipWrapper {...props} activeChartId={activeChartId} ownId="main" />}
                                    cursor={{ stroke: '#666', strokeWidth: 1, strokeDasharray: '3 3' }}
                                />

                                {/* Support & Resistance Lines */}
                                <ReferenceLine yAxisId="price" y={maxHigh} label={{ position: 'right', value: `${maxHigh}`, fontSize: 10, fill: '#ef4444' }} stroke="#ef4444" strokeDasharray="3 3" opacity={0.6} />
                                <ReferenceLine yAxisId="price" y={minLow} label={{ position: 'right', value: `${minLow}`, fontSize: 10, fill: '#22c55e' }} stroke="#22c55e" strokeDasharray="3 3" opacity={0.6} />

                                {/* Bollinger Bands Area */}
                                <Area
                                    yAxisId="price"
                                    type="monotone"
                                    dataKey="bb_upper"
                                    stroke="none"
                                    fill="rgba(200, 200, 200, 0.1)"
                                    isAnimationActive={false}
                                />
                                <Area
                                    yAxisId="price"
                                    type="monotone"
                                    dataKey="bb_lower"
                                    stroke="none"
                                    fill="rgba(200, 200, 200, 0.1)"
                                    isAnimationActive={false}
                                />

                                <Line yAxisId="price" type="monotone" dataKey="bb_upper" stroke="#8884d8" strokeOpacity={0.3} dot={false} strokeWidth={1} isAnimationActive={false} />
                                <Line yAxisId="price" type="monotone" dataKey="bb_lower" stroke="#8884d8" strokeOpacity={0.3} dot={false} strokeWidth={1} isAnimationActive={false} />

                                {/* EMA Lines */}
                                {/* EMA Lines */}
                                {showEMA && (
                                    <>
                                        <Line yAxisId="price" type="monotone" dataKey="ema20" stroke="blue" dot={false} strokeWidth={2} isAnimationActive={false} />
                                        <Line yAxisId="price" type="monotone" dataKey="ema200" stroke="red" dot={false} strokeWidth={2} isAnimationActive={false} />
                                    </>
                                )}

                                {/* SMART BROKER SUPPORT LINE (Overlay) */}
                                {selectedBroker && (
                                    <Line
                                        yAxisId="price"
                                        type="stepAfter" // Step or Monotone? Step is cleaner for levels.
                                        dataKey="broker_support"
                                        stroke="#a855f7" // Purple-500
                                        strokeWidth={2}
                                        strokeDasharray="4 4" // Dotted/Dashed
                                        dot={false}
                                        isAnimationActive={false}
                                        connectNulls
                                    />
                                )}

                                {/* Broker Accumulation Line (Overlay) */}
                                {brokerOverlayData && (selectedBroker || showForeignOnly) && (
                                    <Line
                                        yAxisId="broker"
                                        type="monotone"
                                        dataKey={(item: any) => {
                                            // Find the corresponding broker value for the current item.date
                                            const b = brokerOverlayData.find(b => b.date === item.date);
                                            return b ? b.value : null;
                                        }}
                                        stroke="#f59e0b"
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                        name={showForeignOnly ? "Foreign Accum" : (selectedBroker || "")}
                                        isAnimationActive={false}
                                    />
                                )}

                                {/* Candlestick - Wick (High/Low) - Layered on second axis */}
                                <Bar
                                    yAxisId="price"
                                    xAxisId="wick"
                                    dataKey="candle_wick"
                                    barSize={1.5}
                                    fill="transparent"
                                    isAnimationActive={false}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`wick-${index}`} fill={entry.close >= entry.open ? "#22c55e" : "#ef4444"} />
                                    ))}
                                </Bar>

                                {/* Candlestick - Body (Open/Close) */}
                                <Bar
                                    yAxisId="price"
                                    dataKey="candle_body"
                                    fill="transparent"
                                    isAnimationActive={false}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`body-${index}`} fill={entry.close >= entry.open ? "#22c55e" : "#ef4444"} />
                                    ))}
                                </Bar>



                                {/* Use Direct DOM for Crosshair to improve performance (removed ReferenceLine) */}

                                {/* Interaction: Measurement Box (Rendered Last for Z-Index) moved to DOM */}
                                {/* RENDER SAVED BOXES */}
                                {boxes.map((box) => {
                                    const diff = box.endPrice - box.startPrice;
                                    const percent = (diff / box.startPrice) * 100;
                                    const isProfit = diff >= 0;
                                    const color = isProfit ? "#22c55e" : "#ef4444";

                                    return (
                                        <ReferenceArea
                                            key={box.id}
                                            yAxisId="price"
                                            x1={box.startDate}
                                            x2={box.endDate}
                                            y1={box.startPrice}
                                            y2={box.endPrice}
                                            fill={color}
                                            fillOpacity={0.2}
                                            stroke={color}
                                            strokeOpacity={0.5}
                                        >
                                            <RechartsLabel
                                                position="center"
                                                // @ts-ignore
                                                content={(props: any) => {
                                                    const { viewBox } = props;
                                                    // Normalize Rect (handle negative width/height if dragged backwards)
                                                    const rawX = viewBox?.x || 0;
                                                    const rawY = viewBox?.y || 0;
                                                    const rawW = viewBox?.width || 0;
                                                    const rawH = viewBox?.height || 0;

                                                    const x = rawW >= 0 ? rawX : rawX + rawW;
                                                    const y = rawH >= 0 ? rawY : rawY + rawH;
                                                    const width = Math.abs(rawW);
                                                    const height = Math.abs(rawH);

                                                    const centerX = x + width / 2;
                                                    const centerY = y + height / 2;

                                                    return (
                                                        <g>
                                                            <rect
                                                                x={x}
                                                                y={y}
                                                                width={width}
                                                                height={height}
                                                                fill="transparent"
                                                            // Make the whole area clickable to delete? No, too aggressive.
                                                            />

                                                            {/* Background for text visibility */}
                                                            <rect
                                                                x={centerX - 60}
                                                                y={centerY - 25}
                                                                width={120}
                                                                height={50}
                                                                rx={4}
                                                                fill="rgba(0,0,0,0.7)"
                                                            />

                                                            {/* Percent Change */}
                                                            <text x={centerX} y={centerY - 8} fill={color} textAnchor="middle" fontSize={12} fontWeight="bold">
                                                                {percent > 0 ? '+' : ''}{percent.toFixed(2)}%
                                                            </text>

                                                            {/* Price Range */}
                                                            <text x={centerX} y={centerY + 8} fill="white" textAnchor="middle" fontSize={10}>
                                                                {box.startPrice.toLocaleString()} → {box.endPrice.toLocaleString()}
                                                            </text>

                                                            {/* Trash Icon / Button */}
                                                            <foreignObject x={x} y={y} width={20} height={20}>
                                                                <div
                                                                    className="flex items-center justify-center w-full h-full cursor-pointer bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold rounded-br"
                                                                    onClick={(e) => {
                                                                        // This might not bubble correctly depending on Recharts implementation of foreignObject
                                                                        // But normally standard React onClick works in foreignObject
                                                                        removeBox(box.id, e);
                                                                    }}
                                                                    title="Remove Box"
                                                                >
                                                                    ✕
                                                                </div>
                                                            </foreignObject>
                                                        </g>
                                                    );
                                                }}
                                            />
                                        </ReferenceArea>
                                    );
                                })}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* SUB-CHART: VOLUME */}
            <div className={compact ? "" : "bg-white dark:bg-white/[0.03] rounded-xl shadow-sm border border-gray-100 dark:border-white/10"}>
                <div className="h-[80px] p-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            syncId="tech-sync"
                            data={chartData}
                            margin={{ top: 0, right: compact ? 0 : 5, left: 0, bottom: 0 }}
                            onMouseMove={() => setActiveChartId("volume")}
                            onMouseLeave={() => setActiveChartId(null)}
                        >
                            <XAxis dataKey="date" hide />
                            <YAxis yAxisId="vol" orientation="right" tick={{ fontSize: 9 }} tickFormatter={(v: number) => (v / 1_000_000).toFixed(0) + "M"} />
                            <Tooltip content={(props: any) => <CustomTooltipWrapper {...props} activeChartId={activeChartId} ownId="volume" />} cursor={{ fill: 'rgba(255,255,255,0.1)' }} />
                            <Bar yAxisId="vol" dataKey="volume" opacity={0.8} isAnimationActive={false}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.close >= entry.open ? "#22c55e" : "#ef4444"} />
                                ))}
                            </Bar>
                            <Line yAxisId="vol" type="monotone" dataKey="vol_ma" stroke="#f59e0b" dot={false} strokeWidth={1} isAnimationActive={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>


            {/* SUB-CHART: FOREIGN FLOW */}
            <div className={compact ? "" : "bg-white dark:bg-white/[0.03] rounded-xl shadow-sm border border-gray-100 dark:border-white/10"}>
                {!compact && (
                    <div className="py-1.5 sm:py-2 px-3 sm:px-4 border-b border-gray-100 dark:border-white/10">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Net Foreign Flow</span>
                    </div>
                )}
                <div className="h-[90px] p-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            syncId="tech-sync"
                            data={chartData}
                            margin={{ top: 0, right: compact ? 0 : 5, left: 0, bottom: 0 }}
                            onMouseMove={() => setActiveChartId("foreign")}
                            onMouseLeave={() => setActiveChartId(null)}
                        >
                            <XAxis dataKey="date" hide />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                            <YAxis yAxisId="foreign" orientation="right" tick={{ fontSize: 9 }} tickFormatter={(v: number) => (v / 1_000_000_000).toFixed(0) + "B"} />
                            <Tooltip content={(props: any) => <CustomTooltipWrapper {...props} activeChartId={activeChartId} ownId="foreign" />} cursor={{ fill: 'rgba(255,255,255,0.1)' }} />
                            <ReferenceLine yAxisId="foreign" y={0} stroke="#666" strokeOpacity={0.5} />
                            <Bar yAxisId="foreign" dataKey="net_foreign" isAnimationActive={false}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-foreign-${index}`} fill={entry.net_foreign >= 0 ? "#22c55e" : "#ef4444"} />
                                ))}
                            </Bar>
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* SUB-CHART: RSI */}
            {
                showRSI && (
                    <div className={compact ? "" : "bg-white dark:bg-white/[0.03] rounded-xl shadow-sm border border-gray-100 dark:border-white/10"}>
                        {!compact && (
                            <div className="py-1.5 sm:py-2 px-3 sm:px-4 border-b border-gray-100 dark:border-white/10">
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">RSI</span>
                            </div>
                        )}
                        <div className="h-[120px] p-0 pt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    syncId="tech-sync"
                                    data={chartData}
                                    margin={{ top: 5, right: compact ? 0 : 5, left: 0, bottom: 0 }}
                                    onMouseMove={() => setActiveChartId("rsi")}
                                    onMouseLeave={() => setActiveChartId(null)}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                    <XAxis dataKey="date" hide />

                                    <Tooltip content={(props: any) => <CustomTooltipWrapper {...props} activeChartId={activeChartId} ownId="rsi" />} cursor={{ stroke: '#666', strokeDasharray: '3 3' }} />
                                    <YAxis domain={[0, 100]} orientation="right" tick={{ fontSize: 10 }} ticks={[30, 50, 70]} />
                                    <ReferenceLine y={70} stroke="red" strokeDasharray="3 3" opacity={0.5} />
                                    <ReferenceLine y={30} stroke="green" strokeDasharray="3 3" opacity={0.5} />
                                    <Line type="monotone" dataKey="rsi" stroke="#8884d8" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )
            }

            {/* SUB-CHART: MACD */}
            {
                showMACD && (
                    <div className={compact ? "" : "bg-white dark:bg-white/[0.03] rounded-xl shadow-sm border border-gray-100 dark:border-white/10"}>
                        {!compact && (
                            <div className="py-1.5 sm:py-2 px-3 sm:px-4 border-b border-gray-100 dark:border-white/10">
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">MACD</span>
                            </div>
                        )}
                        <div className="h-[150px] p-0 pt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    syncId="tech-sync"
                                    data={chartData}
                                    margin={{ top: 5, right: compact ? 0 : 5, left: 0, bottom: 0 }}
                                    onMouseMove={() => setActiveChartId("macd")}
                                    onMouseLeave={() => setActiveChartId(null)}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 10 }}
                                        tickFormatter={(val: any) => format(new Date(val), "dd/MM")}
                                        minTickGap={30}
                                    />

                                    <Tooltip content={(props: any) => <CustomTooltipWrapper {...props} activeChartId={activeChartId} ownId="macd" />} cursor={{ stroke: '#666', strokeDasharray: '3 3' }} />
                                    <YAxis orientation="right" tick={{ fontSize: 10 }} />
                                    <ReferenceLine y={0} stroke="#666" opacity={0.3} />
                                    <Bar dataKey="macd_hist" fill="#94a3b8" barSize={2} isAnimationActive={false} />
                                    <Line type="monotone" dataKey="macd" stroke="#2563eb" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                                    <Line type="monotone" dataKey="macd_signal" stroke="#f59e0b" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
