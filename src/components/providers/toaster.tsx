"use client";

import { Toaster as Sonner } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";

/**
 * Premium Toaster – Morfostocks Design System
 */
export function Toaster() {
    return (
        <Sonner
            position="bottom-right"
            expand={false}
            richColors={false}
            gap={8}
            toastOptions={{
                unstyled: true,
                classNames: {
                    toast:
                        "flex items-start gap-3 w-full max-w-sm px-4 py-3.5 rounded-xl bg-white dark:bg-[#1e293b] border border-gray-100 dark:border-white/10 shadow-lg font-[var(--font-geist-sans)]",
                    title: "text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight",
                    description: "text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed",
                    actionButton:
                        "text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors",
                    cancelButton:
                        "text-xs font-medium text-gray-400 hover:text-gray-500 transition-colors",
                    closeButton:
                        "absolute top-2 right-2 w-5 h-5 rounded-md bg-gray-50 dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors",
                    success: "!border-emerald-100 dark:!border-emerald-800/30",
                    error: "!border-red-100 dark:!border-red-800/30",
                    warning: "!border-amber-100 dark:!border-amber-800/30",
                    info: "!border-blue-100 dark:!border-blue-800/30",
                },
            }}
            icons={{
                success: (
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                ),
                error: (
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                        <XCircle className="w-4 h-4 text-red-500" />
                    </div>
                ),
                warning: (
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                    </div>
                ),
                info: (
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Info className="w-4 h-4 text-blue-500" />
                    </div>
                ),
            }}
        />
    );
}
