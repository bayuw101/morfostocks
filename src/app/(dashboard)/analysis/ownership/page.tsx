"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { WavyBackground } from "@/components/layout/wavy-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FloatingInput } from "@/components/ui/floating-input";
import { FloatingSelect } from "@/components/ui/floating-select";
import { SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    Search, Users, Loader2, ChevronDown, Network,
    Globe, Building2, User, Landmark, Shield, PiggyBank,
    Briefcase, HelpCircle, BarChart3
} from "lucide-react";
import OwnershipNetwork from "@/components/analysis/ownership-network";

/* ------------------------------------------------------------------ */
/*  CONSTANTS                                                         */
/* ------------------------------------------------------------------ */
const INVESTOR_TYPE_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    CP: { label: "Corporate", color: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300", icon: <Building2 className="w-3 h-3" /> },
    ID: { label: "Individual", color: "bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-300", icon: <User className="w-3 h-3" /> },
    IB: { label: "Bank", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300", icon: <Landmark className="w-3 h-3" /> },
    IS: { label: "Insurance", color: "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300", icon: <Shield className="w-3 h-3" /> },
    MF: { label: "Mutual Fund", color: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300", icon: <PiggyBank className="w-3 h-3" /> },
    PF: { label: "Pension Fund", color: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300", icon: <Briefcase className="w-3 h-3" /> },
    SC: { label: "Securities", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300", icon: <Globe className="w-3 h-3" /> },
    FD: { label: "Foundation", color: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300", icon: <Building2 className="w-3 h-3" /> },
    OT: { label: "Other", color: "bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-300", icon: <HelpCircle className="w-3 h-3" /> },
};

const STOCK_SORT_OPTIONS = [
    { value: "ticker_asc", label: "Ticker A → Z" },
    { value: "ticker_desc", label: "Ticker Z → A" },
    { value: "freeFloat_asc", label: "Free Float ↑ (Low → High)" },
    { value: "freeFloat_desc", label: "Free Float ↓ (High → Low)" },
    { value: "holders_desc", label: "Holders ↓ (Most)" },
];

const INVESTOR_SORT_OPTIONS = [
    { value: "name_asc", label: "Name A → Z" },
    { value: "name_desc", label: "Name Z → A" },
    { value: "stocks_desc", label: "Stocks ↓ (Most)" },
    { value: "shares_desc", label: "Total Shares ↓ (Largest)" },
];

const BATCH_SIZE = 30;

/* ------------------------------------------------------------------ */
/*  TYPES                                                             */
/* ------------------------------------------------------------------ */
interface OwnershipRecord {
    stockSymbol: string;
    investorName: string;
    investorType: string;
    localForeign: string;
    nationality: string;
    domicile: string;
    scrip: string;
    scripless: string;
    total: string;
    percentage: number;
}

interface StockGroup {
    stockSymbol: string;
    records: OwnershipRecord[];
    holderCount: number;
    pctSum: number;
    freeFloat: number;
}

interface InvestorGroup {
    investorName: string;
    records: OwnershipRecord[];
    stockCount: number;
    totalShares: string;
}

/* ------------------------------------------------------------------ */
/*  HELPERS                                                           */
/* ------------------------------------------------------------------ */
function fmtNum(n: string | number): string {
    const num = typeof n === "string" ? parseInt(n, 10) : n;
    if (isNaN(num)) return "0";
    return num.toLocaleString("id-ID");
}

function fmtPct(p: number): string {
    return p.toFixed(2).replace(".", ",") + "%";
}

function getTypeBadge(code: string) {
    return INVESTOR_TYPE_MAP[code] || INVESTOR_TYPE_MAP["OT"];
}

/* ------------------------------------------------------------------ */
/*  STOCK GROUP CARD                                                  */
/* ------------------------------------------------------------------ */
function StockGroupCard({ group }: { group: StockGroup }) {
    const [isOpen, setIsOpen] = useState(false);

    const localCount = group.records.filter((r) => r.localForeign === "L").length;
    const foreignCount = group.records.filter((r) => r.localForeign === "A").length;

    return (
        <div className={`border rounded-xl overflow-hidden transition-all duration-300
            ${isOpen ? "border-blue-200 dark:border-blue-500/30 shadow-lg shadow-blue-500/5" : "border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20"}
            bg-white dark:bg-[#1e293b]`}>
            <button onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 sm:px-5 py-3.5 flex items-center gap-3 sm:gap-4 text-left hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                <span className="shrink-0 px-2.5 py-1 rounded-lg text-sm font-bold bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 tracking-wide font-mono">
                    {group.stockSymbol}
                </span>
                <div className="flex items-center gap-3 sm:gap-5 flex-1 min-w-0 text-xs sm:text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                        <span className="font-semibold text-gray-700 dark:text-gray-200">{group.holderCount}</span> holder{group.holderCount > 1 ? "s" : ""}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 hidden sm:inline">
                        Held: <span className="font-semibold text-gray-700 dark:text-gray-200">{fmtPct(group.pctSum)}</span>
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                        FF: <span className={`font-bold ${group.freeFloat > 50 ? "text-emerald-600 dark:text-emerald-400" : group.freeFloat > 20 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {fmtPct(group.freeFloat)}
                        </span>
                    </span>
                    {localCount > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-teal-200 text-teal-700 dark:border-teal-500/30 dark:text-teal-400 hidden sm:inline-flex">L:{localCount}</Badge>}
                    {foreignCount > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-rose-200 text-rose-700 dark:border-rose-500/30 dark:text-rose-400 hidden sm:inline-flex">A:{foreignCount}</Badge>}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="border-t border-gray-100 dark:border-white/10">
                    <HoldersTable records={group.records} columnLabel="Investor" />
                    {/* Connections — auto-open */}
                    <div className="border-t border-gray-100 dark:border-white/10">
                        <div className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                            <Network className="w-4 h-4" /> Connections
                        </div>
                        <div className="px-4 pb-4">
                            <OwnershipNetwork stock={group.stockSymbol} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  INVESTOR GROUP CARD                                               */
/* ------------------------------------------------------------------ */
function InvestorGroupCard({ group }: { group: InvestorGroup }) {
    const [isOpen, setIsOpen] = useState(false);

    // Get the dominant investor type from the first record
    const firstType = group.records[0]?.investorType || "OT";
    const typeBadge = getTypeBadge(firstType);

    return (
        <div className={`border rounded-xl overflow-hidden transition-all duration-300
            ${isOpen ? "border-teal-200 dark:border-teal-500/30 shadow-lg shadow-teal-500/5" : "border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20"}
            bg-white dark:bg-[#1e293b]`}>
            <button onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 sm:px-5 py-3.5 flex items-center gap-3 sm:gap-4 text-left hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${typeBadge.color}`}>
                    {typeBadge.icon}
                    {firstType}
                </span>
                <div className="flex items-center gap-3 sm:gap-5 flex-1 min-w-0 text-xs sm:text-sm">
                    <span className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[200px] sm:max-w-[400px]">
                        {group.investorName}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                        <span className="font-semibold text-gray-700 dark:text-gray-200">{group.stockCount}</span> stock{group.stockCount > 1 ? "s" : ""}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 hidden sm:inline">
                        <span className="font-mono text-xs">{fmtNum(group.totalShares)}</span> lbr
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="border-t border-gray-100 dark:border-white/10">
                    <HoldersTable records={group.records} columnLabel="Emiten" />
                    {/* Connections — auto-open */}
                    <div className="border-t border-gray-100 dark:border-white/10">
                        <div className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-teal-600 dark:text-teal-400">
                            <Network className="w-4 h-4" /> Connections
                        </div>
                        <div className="px-4 pb-4">
                            <OwnershipNetwork investor={group.investorName} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  SHARED HOLDERS TABLE                                              */
/* ------------------------------------------------------------------ */
function HoldersTable({ records, columnLabel }: { records: OwnershipRecord[]; columnLabel: string }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
                        <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-400 text-xs">#</th>
                        <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-400 text-xs">{columnLabel}</th>
                        <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-400 text-xs hidden sm:table-cell">Type</th>
                        <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-400 text-xs hidden sm:table-cell">L/F</th>
                        <th className="text-right px-4 py-2 font-semibold text-gray-600 dark:text-gray-400 text-xs">Shares</th>
                        <th className="text-right px-4 py-2 font-semibold text-gray-600 dark:text-gray-400 text-xs">%</th>
                    </tr>
                </thead>
                <tbody>
                    {records.map((rec, i) => {
                        const typeBadge = getTypeBadge(rec.investorType);
                        const displayName = columnLabel === "Emiten" ? rec.stockSymbol : rec.investorName;
                        return (
                            <tr key={`${rec.investorName}-${rec.stockSymbol}-${i}`}
                                className="border-b border-gray-50 dark:border-white/5 hover:bg-blue-50/30 dark:hover:bg-white/[0.02] transition-colors">
                                <td className="px-4 py-2.5 text-gray-400 text-xs tabular-nums">{i + 1}</td>
                                <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {columnLabel === "Emiten" ? (
                                            <span className="font-bold font-mono text-blue-700 dark:text-blue-300 text-xs">{displayName}</span>
                                        ) : (
                                            <span className="text-gray-800 dark:text-gray-200 truncate max-w-[200px] sm:max-w-[300px]">{displayName}</span>
                                        )}
                                        <span className={`sm:hidden shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${typeBadge.color}`}>
                                            {rec.investorType || "OT"}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-2.5 hidden sm:table-cell">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${typeBadge.color}`}>
                                        {typeBadge.icon} {typeBadge.label}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 hidden sm:table-cell">
                                    {rec.localForeign === "L" ? (
                                        <span className="text-teal-700 dark:text-teal-400 font-medium text-xs">Lokal</span>
                                    ) : rec.localForeign === "A" ? (
                                        <span className="text-rose-600 dark:text-rose-400 font-medium text-xs">
                                            Asing {rec.nationality && <span className="text-gray-400 font-normal">• {rec.nationality}</span>}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 text-xs">—</span>
                                    )}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300 font-mono text-xs">
                                    {fmtNum(rec.total)}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden hidden sm:block">
                                            <div className="h-full rounded-full bg-blue-500 dark:bg-blue-400" style={{ width: `${Math.min(100, rec.percentage)}%` }} />
                                        </div>
                                        <span className="font-semibold text-gray-800 dark:text-gray-200 tabular-nums text-xs">{fmtPct(rec.percentage)}</span>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  MAIN PAGE                                                         */
/* ------------------------------------------------------------------ */
export default function OwnershipAnalysisPage() {
    const [pov, setPov] = useState<"emiten" | "investor">("emiten");
    const [stockData, setStockData] = useState<StockGroup[] | null>(null);
    const [investorData, setInvestorData] = useState<InvestorGroup[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [stockSort, setStockSort] = useState("ticker_asc");
    const [investorSort, setInvestorSort] = useState("name_asc");
    const [latestDate, setLatestDate] = useState<string | null>(null);
    const [displayedCount, setDisplayedCount] = useState(BATCH_SIZE);

    useEffect(() => {
        fetchData(pov);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pov]);

    const fetchData = async (mode: "emiten" | "investor") => {
        setLoading(true);
        try {
            const groupBy = mode === "investor" ? "investor" : "stock";
            const res = await fetch(`/api/analysis/ownership?groupBy=${groupBy}`);
            const json = await res.json();
            if (json.data) {
                if (mode === "investor") {
                    setInvestorData(json.data);
                } else {
                    setStockData(json.data);
                }
                setLatestDate(json.latestDate);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Stock filtering/sorting (client-side)
    const filteredStocks = useMemo(() => {
        if (!stockData) return [];
        let result = stockData;
        if (search) {
            const q = search.toLowerCase();
            result = result.filter((g) =>
                g.stockSymbol.toLowerCase().includes(q) || g.records.some((r) => r.investorName.toLowerCase().includes(q))
            );
        }
        const [sortKey, sortDir] = stockSort.split("_");
        const sorted = [...result];
        if (sortKey === "freeFloat") sorted.sort((a, b) => sortDir === "asc" ? a.freeFloat - b.freeFloat : b.freeFloat - a.freeFloat);
        else if (sortKey === "holders") sorted.sort((a, b) => b.holderCount - a.holderCount);
        else sorted.sort((a, b) => sortDir === "asc" ? a.stockSymbol.localeCompare(b.stockSymbol) : b.stockSymbol.localeCompare(a.stockSymbol));
        return sorted;
    }, [stockData, search, stockSort]);

    // Investor filtering/sorting (client-side)
    const filteredInvestors = useMemo(() => {
        if (!investorData) return [];
        let result = investorData;
        if (search) {
            const q = search.toLowerCase();
            result = result.filter((g) =>
                g.investorName.toLowerCase().includes(q) || g.records.some((r) => r.stockSymbol.toLowerCase().includes(q))
            );
        }
        const [sortKey, sortDir] = investorSort.split("_");
        const sorted = [...result];
        if (sortKey === "stocks") sorted.sort((a, b) => b.stockCount - a.stockCount);
        else if (sortKey === "shares") sorted.sort((a, b) => parseInt(b.totalShares) - parseInt(a.totalShares));
        else sorted.sort((a, b) => sortDir === "asc" ? a.investorName.localeCompare(b.investorName) : b.investorName.localeCompare(a.investorName));
        return sorted;
    }, [investorData, search, investorSort]);

    const currentData = pov === "emiten" ? filteredStocks : filteredInvestors;
    const currentSortOptions = pov === "emiten" ? STOCK_SORT_OPTIONS : INVESTOR_SORT_OPTIONS;
    const currentSort = pov === "emiten" ? stockSort : investorSort;
    const setCurrentSort = pov === "emiten" ? setStockSort : setInvestorSort;

    // Infinite scroll
    const handleScroll = useCallback(() => {
        if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 400) {
            setDisplayedCount((prev) => Math.min(prev + BATCH_SIZE, currentData.length));
        }
    }, [currentData.length]);

    useEffect(() => {
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [handleScroll]);

    useEffect(() => { setDisplayedCount(BATCH_SIZE); }, [search, stockSort, investorSort, pov]);

    const visibleItems = currentData.slice(0, displayedCount);

    return (
        <div className="w-full pb-20">
            <WavyBackground
                title="Ownership Analysis"
                subtitle="KSEI 1% ownership data — shareholder mapping & network connections"
            />

            <main className="max-w-7xl mx-auto md:px-6 lg:px-8 md:-mt-20 relative z-10 pb-0 md:pb-12">
                <Card className="gap-0 border-0 sm:border border-gray-100 dark:border-white/10 shadow-none sm:shadow-xl shadow-blue-900/5 bg-transparent sm:bg-white sm:dark:bg-[#1e293b] rounded-none sm:rounded-xl">

                    {/* Controls Header */}
                    <div className="p-4 sm:pt-0 sm:p-6 border-b border-gray-100 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white sm:bg-transparent dark:bg-[#1e293b] sm:dark:bg-transparent">
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
                                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">Kepemilikan Saham</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {currentData.length > 0
                                        ? `${fmtNum(currentData.length)} ${pov === "emiten" ? "emiten" : "investors"}${latestDate ? ` • ${new Date(latestDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}` : ""}`
                                        : loading ? "Loading…" : "No data"
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                            <div className="w-full sm:w-[240px]">
                                <FloatingSelect label="Sort" value={currentSort} onValueChange={(v) => setCurrentSort(v)}>
                                    {currentSortOptions.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                </FloatingSelect>
                            </div>
                            <div className="w-full sm:w-[300px]">
                                <FloatingInput
                                    id="ownership-search"
                                    label={pov === "emiten" ? "Search ticker / investor…" : "Search investor / ticker…"}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    icon={<Search className="w-4 h-4 text-gray-400" />}
                                />
                            </div>
                        </div>
                    </div>

                    {/* POV Tabs */}
                    <div className="px-4 sm:px-6 pt-4">
                        <Tabs value={pov} onValueChange={(v) => setPov(v as "emiten" | "investor")}>
                            <TabsList className="w-full sm:w-auto flex justify-start bg-white/80 dark:bg-white/5 backdrop-blur-md border border-gray-200/50 dark:border-white/10 px-1 py-1 shadow-sm rounded-xl">
                                <TabsTrigger value="emiten" className="flex items-center gap-1.5">
                                    <BarChart3 className="w-3.5 h-3.5" /> Emiten
                                </TabsTrigger>
                                <TabsTrigger value="investor" className="flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5" /> Investor
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* Content */}
                    <CardContent className="p-3 sm:p-5">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
                                <p className="text-sm text-gray-500 dark:text-gray-400">Memuat data kepemilikan…</p>
                            </div>
                        ) : currentData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Users className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                                <p className="text-gray-500 dark:text-gray-400 text-sm">Tidak ada data ditemukan</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2.5">
                                {visibleItems.map((item) =>
                                    pov === "emiten"
                                        ? <StockGroupCard key={(item as StockGroup).stockSymbol} group={item as StockGroup} />
                                        : <InvestorGroupCard key={(item as InvestorGroup).investorName} group={item as InvestorGroup} />
                                )}

                                {displayedCount < currentData.length && (
                                    <div className="text-center py-4 text-sm text-gray-400 dark:text-gray-500">
                                        Showing {fmtNum(displayedCount)} of {fmtNum(currentData.length)} — scroll for more
                                    </div>
                                )}
                                {displayedCount >= currentData.length && currentData.length > 0 && (
                                    <div className="text-center py-4 text-sm text-gray-400 dark:text-gray-500">
                                        Showing all {fmtNum(currentData.length)} {pov === "emiten" ? "emiten" : "investors"}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
