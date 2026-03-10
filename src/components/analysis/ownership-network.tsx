"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";
import * as d3 from "d3";

/* ------------------------------------------------------------------ */
/*  TYPES                                                             */
/* ------------------------------------------------------------------ */
interface GraphNode extends d3.SimulationNodeDatum {
    id: string;
    type: "stock" | "investor";
    label: string;
    depth: number;
    percentage?: number;
    investorType?: string;
    localForeign?: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
    source: string | GraphNode;
    target: string | GraphNode;
    depth: number;
    width: number;
    percentage: number;
    totalShares: string;
}

interface Props {
    stock?: string;
    investor?: string;
}

/* ------------------------------------------------------------------ */
/*  COLOR PALETTES                                                    */
/* ------------------------------------------------------------------ */
function getColors(isDark: boolean) {
    return {
        link: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
        linkHi: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.35)",
        stockFill: isDark ? "#3b82f6" : "#2563eb",
        stockCenter: isDark ? "#60a5fa" : "#3b82f6",
        invFill: isDark ? "#14b8a6" : "#0d9488",
        invCenter: isDark ? "#2dd4bf" : "#14b8a6",
        text: isDark ? "#e2e8f0" : "#1e293b",
        textMuted: isDark ? "#94a3b8" : "#64748b",
        bg: isDark ? "#0f172a" : "#f8fafc",
        tooltipBg: isDark ? "#1e293b" : "#ffffff",
        tooltipBorder: isDark ? "#334155" : "#e2e8f0",
    };
}

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                         */
/* ------------------------------------------------------------------ */
export default function OwnershipNetwork({ stock, investor }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

    useEffect(() => {
        fetchAndRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stock, investor]);

    async function fetchAndRender() {
        setLoading(true);
        setError(null);

        try {
            const params = stock ? `stock=${encodeURIComponent(stock)}` : `investor=${encodeURIComponent(investor!)}`;
            const res = await fetch(`/api/analysis/ownership/network?${params}`);
            const json = await res.json();

            if (json.error) {
                setError(json.error);
                return;
            }

            if (!json.nodes || json.nodes.length === 0) {
                setError("No connection data available");
                return;
            }

            renderGraph(json.nodes, json.links, json.center);
        } catch (e: any) {
            setError(e.message || "Failed to load graph");
        } finally {
            setLoading(false);
        }
    }

    function renderGraph(nodes: GraphNode[], links: GraphLink[], centerNodeId: string) {
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const container = containerRef.current;
        if (!container) return;

        const width = container.clientWidth || 600;
        const height = isFullscreen ? window.innerHeight - 100 : 450;

        svg
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", `0 0 ${width} ${height}`);

        const isDark = document.documentElement.classList.contains("dark") ||
            document.documentElement.getAttribute("data-theme") === "dark";
        const colors = getColors(isDark);

        // Create zoom behavior
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.3, 4])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoom as any);
        zoomRef.current = zoom;

        const g = svg.append("g");

        // Force simulation
        const simulation = d3.forceSimulation<GraphNode>(nodes)
            .force("link", d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance((d) => (d as GraphLink).depth === 1 ? 100 : 140))
            .force("charge", d3.forceManyBody().strength(-200))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius(35));

        // Draw links
        const link = g.append("g")
            .selectAll("line")
            .data(links)
            .enter()
            .append("line")
            .attr("stroke", (d) => d.depth === 1 ? colors.linkHi : colors.link)
            .attr("stroke-width", (d) => d.width)
            .attr("stroke-opacity", (d) => d.depth === 1 ? 0.6 : 0.3);

        // Draw nodes
        const node = g.append("g")
            .selectAll<SVGGElement, GraphNode>("g")
            .data(nodes)
            .enter()
            .append("g")
            .attr("cursor", "pointer")
            .call(
                d3.drag<SVGGElement, GraphNode>()
                    .on("start", (event, d) => {
                        if (!event.active) simulation.alphaTarget(0.3).restart();
                        d.fx = d.x;
                        d.fy = d.y;
                    })
                    .on("drag", (event, d) => {
                        d.fx = event.x;
                        d.fy = event.y;
                    })
                    .on("end", (event, d) => {
                        if (!event.active) simulation.alphaTarget(0);
                        d.fx = null;
                        d.fy = null;
                    })
            );

        // Stock nodes → rounded rect (pill shape)
        node.filter((d) => d.type === "stock")
            .append("rect")
            .attr("rx", 12)
            .attr("ry", 12)
            .attr("width", (d) => Math.max(50, d.label.length * 9 + 20))
            .attr("height", 28)
            .attr("x", (d) => -Math.max(50, d.label.length * 9 + 20) / 2)
            .attr("y", -14)
            .attr("fill", (d) => d.id === centerNodeId ? colors.stockCenter : colors.stockFill)
            .attr("stroke", "rgba(255,255,255,0.2)")
            .attr("stroke-width", (d) => d.id === centerNodeId ? 2.5 : 1);

        // Investor nodes → circle
        node.filter((d) => d.type === "investor")
            .append("circle")
            .attr("r", (d) => d.id === centerNodeId ? 18 : d.depth === 1 ? 14 : 10)
            .attr("fill", (d) => d.id === centerNodeId ? colors.invCenter : colors.invFill)
            .attr("stroke", "rgba(255,255,255,0.2)")
            .attr("stroke-width", (d) => d.id === centerNodeId ? 2.5 : 1);

        // Labels
        node.append("text")
            .text((d) => {
                if (d.type === "stock") return d.label;
                // Truncate long investor names
                return d.label.length > 18 ? d.label.slice(0, 16) + "…" : d.label;
            })
            .attr("text-anchor", "middle")
            .attr("dy", (d) => d.type === "stock" ? "0.35em" : (d.id === centerNodeId ? 30 : 22))
            .attr("font-size", (d) => {
                if (d.type === "stock") return d.id === centerNodeId ? "11px" : "9px";
                return d.id === centerNodeId ? "10px" : "8px";
            })
            .attr("font-weight", (d) => d.id === centerNodeId ? "700" : "500")
            .attr("fill", (d) => d.type === "stock" ? "#fff" : colors.textMuted)
            .attr("font-family", "'Plus Jakarta Sans', system-ui, sans-serif")
            .attr("pointer-events", "none");

        // Percentage labels on links (for depth 1 only)
        const linkLabel = g.append("g")
            .selectAll("text")
            .data(links.filter((l) => l.depth === 1))
            .enter()
            .append("text")
            .text((d) => d.percentage.toFixed(1) + "%")
            .attr("font-size", "8px")
            .attr("fill", colors.textMuted)
            .attr("text-anchor", "middle")
            .attr("font-family", "'JetBrains Mono', monospace")
            .attr("pointer-events", "none");

        // Tooltip
        const tooltip = d3.select(container)
            .append("div")
            .style("position", "absolute")
            .style("display", "none")
            .style("padding", "10px 14px")
            .style("background", colors.tooltipBg)
            .style("border", `1px solid ${colors.tooltipBorder}`)
            .style("border-radius", "10px")
            .style("font-size", "11px")
            .style("font-family", "'Plus Jakarta Sans', system-ui, sans-serif")
            .style("color", colors.text)
            .style("pointer-events", "none")
            .style("z-index", "50")
            .style("box-shadow", "0 8px 24px rgba(0,0,0,0.2)")
            .style("min-width", "180px")
            .style("max-height", "300px")
            .style("overflow-y", "auto");

        // Helper to format share number with dots separator
        function fmtShares(n: string): string {
            const num = parseInt(n, 10);
            if (isNaN(num)) return "0";
            return num.toLocaleString("id-ID");
        }

        node.on("mouseenter", function (event, d) {
            // Find all connected links and their target/source nodes
            const connectedItems: { label: string; pct: number; shares: string; type: string }[] = [];

            links.forEach((l) => {
                const src = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
                const tgt = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;

                if (src === d.id) {
                    const targetNode = nodes.find((n) => n.id === tgt);
                    if (targetNode) {
                        connectedItems.push({ label: targetNode.label, pct: l.percentage, shares: l.totalShares, type: targetNode.type });
                    }
                } else if (tgt === d.id) {
                    const sourceNode = nodes.find((n) => n.id === src);
                    if (sourceNode) {
                        connectedItems.push({ label: sourceNode.label, pct: l.percentage, shares: l.totalShares, type: sourceNode.type });
                    }
                }
            });

            // Sort by percentage desc
            connectedItems.sort((a, b) => b.pct - a.pct);

            const isStock = d.type === "stock";
            const tagColor = isStock ? "color:#60a5fa" : "color:#2dd4bf";
            const tagLabel = isStock ? "Stock" : (d.investorType || "Investor");

            let html = `<div style="display:flex;align-items:center;gap:6px;margin-bottom:${connectedItems.length > 0 ? '6' : '0'}px">`;
            html += `<strong style="font-size:12px">${d.label}</strong>`;
            html += `<span style="${tagColor};font-size:9px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase">${tagLabel}</span>`;
            html += `</div>`;

            if (connectedItems.length > 0) {
                html += `<div style="border-top:1px solid ${colors.tooltipBorder};padding-top:5px">`;
                connectedItems.forEach((item) => {
                    // Single line: name ... pct (and shares only for investor hover → stock items)
                    const showShares = isStock ? false : true;
                    const valStr = showShares
                        ? `${item.pct.toFixed(2)}%  ${fmtShares(item.shares)} lbr`
                        : `${item.pct.toFixed(2)}%`;

                    html += `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:2px 0;font-family:'JetBrains Mono',monospace;font-size:10px">`;
                    html += `<span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px">${item.label}</span>`;
                    html += `<span style="color:${colors.textMuted};white-space:nowrap;flex-shrink:0">${valStr}</span>`;
                    html += `</div>`;
                });
                html += `</div>`;
            }

            tooltip.html(html).style("display", "block");
        })
            .on("mousemove", function (event) {
                const rect = container.getBoundingClientRect();
                tooltip
                    .style("left", (event.clientX - rect.left + 12) + "px")
                    .style("top", (event.clientY - rect.top - 10) + "px");
            })
            .on("mouseleave", function () {
                tooltip.style("display", "none");
            });

        // Highlight on hover
        node.on("mouseenter.highlight", function (event, d) {
            const connectedIds = new Set<string>();
            connectedIds.add(d.id);
            links.forEach((l) => {
                const src = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
                const tgt = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
                if (src === d.id) connectedIds.add(tgt);
                if (tgt === d.id) connectedIds.add(src);
            });

            node.style("opacity", (n) => connectedIds.has(n.id) ? 1 : 0.15);
            link.style("opacity", (l) => {
                const src = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
                const tgt = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
                return src === d.id || tgt === d.id ? 0.8 : 0.05;
            });
        })
            .on("mouseleave.highlight", function () {
                node.style("opacity", 1);
                link.style("opacity", (l) => l.depth === 1 ? 0.6 : 0.3);
            });

        // Tick
        simulation.on("tick", () => {
            link
                .attr("x1", (d) => (d.source as GraphNode).x!)
                .attr("y1", (d) => (d.source as GraphNode).y!)
                .attr("x2", (d) => (d.target as GraphNode).x!)
                .attr("y2", (d) => (d.target as GraphNode).y!);

            node.attr("transform", (d) => `translate(${d.x},${d.y})`);

            linkLabel
                .attr("x", (d) => ((d.source as GraphNode).x! + (d.target as GraphNode).x!) / 2)
                .attr("y", (d) => ((d.source as GraphNode).y! + (d.target as GraphNode).y!) / 2 - 4);
        });

        // Initial zoom to fit
        setTimeout(() => {
            const bounds = (g.node() as SVGGElement)?.getBBox();
            if (bounds) {
                const padding = 40;
                const fullW = bounds.width + padding * 2;
                const fullH = bounds.height + padding * 2;
                const scale = Math.min(width / fullW, height / fullH, 1.5);
                const tx = width / 2 - (bounds.x + bounds.width / 2) * scale;
                const ty = height / 2 - (bounds.y + bounds.height / 2) * scale;
                svg.transition().duration(500).call(
                    (zoom as any).transform,
                    d3.zoomIdentity.translate(tx, ty).scale(scale)
                );
            }
        }, 1500);
    }

    function handleZoom(factor: number) {
        if (zoomRef.current && svgRef.current) {
            const svg = d3.select(svgRef.current);
            svg.transition().duration(300).call(
                (zoomRef.current as any).scaleBy,
                factor
            );
        }
    }

    return (
        <div
            ref={containerRef}
            className={`
                relative rounded-lg overflow-hidden border border-gray-100 dark:border-white/10
                bg-gradient-to-br from-gray-50 to-white dark:from-[#0f172a] dark:to-[#1e293b]
                ${isFullscreen ? "fixed inset-4 z-50 rounded-2xl shadow-2xl" : ""}
            `}
            style={{ minHeight: isFullscreen ? "calc(100vh - 2rem)" : 450 }}
        >
            {/* Fullscreen backdrop */}
            {isFullscreen && (
                <div className="fixed inset-0 bg-black/50 -z-10" onClick={() => setIsFullscreen(false)} />
            )}

            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-[#0f172a]/80 z-10">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        <span className="text-xs text-gray-500">Memuat jaringan koneksi…</span>
                    </div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <p className="text-sm text-gray-400 dark:text-gray-500">{error}</p>
                </div>
            )}

            {/* Controls */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
                <button
                    onClick={() => handleZoom(1.3)}
                    className="p-1.5 rounded-md bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Zoom In"
                >
                    <ZoomIn className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                </button>
                <button
                    onClick={() => handleZoom(0.7)}
                    className="p-1.5 rounded-md bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Zoom Out"
                >
                    <ZoomOut className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                </button>
                <button
                    onClick={() => {
                        setIsFullscreen(!isFullscreen);
                        setTimeout(() => fetchAndRender(), 100);
                    }}
                    className="p-1.5 rounded-md bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                    {isFullscreen ? (
                        <Minimize2 className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                    ) : (
                        <Maximize2 className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                    )}
                </button>
            </div>

            {/* Legend */}
            <div className="absolute bottom-3 left-3 flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400 z-20">
                <span className="flex items-center gap-1">
                    <span className="w-3 h-2 rounded-sm bg-blue-500 inline-block" /> Stock
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" /> Investor
                </span>
            </div>

            <svg ref={svgRef} className="w-full" style={{ minHeight: isFullscreen ? "calc(100vh - 2rem)" : 450 }} />
        </div>
    );
}
