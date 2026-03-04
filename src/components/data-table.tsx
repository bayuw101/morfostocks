import React from "react";

interface Column<T> {
    key: string;
    label: string;
    align?: "left" | "center" | "right";
    hidden?: string;
    headerClass?: string;
    render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    loading?: boolean;
    loadingText?: string;
    emptyText?: string;
    onRowClick?: (row: T) => void;
    keyExtractor: (row: T) => string;
}

/**
 * Standard data table matching the Morfostocks design system.
 * White card with rounded corners, gray header, hover states.
 */
export function DataTable<T>({ columns, data, loading, loadingText, emptyText, onRowClick, keyExtractor }: DataTableProps<T>) {
    return (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50/80">
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    className={`px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider ${col.align === "right" ? "text-right" :
                                        col.align === "center" ? "text-center" : "text-left"
                                        } ${col.hidden || ""} ${col.headerClass || ""}`}
                                >
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length} className="h-48 text-center text-gray-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-6 h-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                                        <p className="text-xs">{loadingText || "Loading..."}</p>
                                    </div>
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="h-32 text-center text-gray-400 text-xs">
                                    {emptyText || "No data found."}
                                </td>
                            </tr>
                        ) : (
                            data.map(row => (
                                <tr
                                    key={keyExtractor(row)}
                                    className={`hover:bg-blue-50/40 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                                    onClick={() => onRowClick?.(row)}
                                >
                                    {columns.map(col => (
                                        <td
                                            key={col.key}
                                            className={`px-4 py-2.5 ${col.align === "right" ? "text-right" :
                                                col.align === "center" ? "text-center" : "text-left"
                                                } ${col.hidden || ""}`}
                                        >
                                            {col.render(row)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
