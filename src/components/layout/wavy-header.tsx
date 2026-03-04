"use client";

import React from "react";
import { useTheme } from "@/components/theme-provider";

export function WavyBackground({ children, title, subtitle }: { children?: React.ReactNode, title?: string, subtitle?: string }) {
    const { theme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => setMounted(true), []);

    const isDark = mounted && (
        theme === "dark" ||
        (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    );

    const waveFill = isDark ? "#1a2236" : "#f8fafc";

    return (
        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 pt-8 pb-8 md:pt-24 md:pb-40 overflow-hidden -mt-10 shrink-0">
            {/* SVG Waves */}
            <div className="hidden md:block absolute bottom-0 left-0 right-0 overflow-hidden leading-none z-0">
                <svg className="relative block w-full h-[80px] md:h-[120px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" preserveAspectRatio="none">
                    <path fill="#3b82f6" fillOpacity="0.4" d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.6C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                    <path fill="#60a5fa" fillOpacity="0.2" d="M0,128L48,154.7C96,181,192,235,288,256C384,277,480,267,576,240C672,213,768,171,864,154.7C960,139,1056,149,1152,176C1248,203,1344,245,1392,266.7L1440,288L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                    <path fill={waveFill} d="M0,256L48,261.3C96,267,192,277,288,261.3C384,245,480,203,576,192C672,181,768,203,864,224C960,245,1056,267,1152,266.7C1248,267,1344,245,1392,234.7L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                </svg>
            </div>

            {/* Decorative blurs */}
            <div className="absolute -top-24 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-0 right-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-6 px-4 sm:px-6 lg:px-8 z-10 pt-2">
                <div className="flex items-center gap-5 text-white">
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black tracking-tight text-white uppercase">{title || "Morfostocks"}</h2>
                        {subtitle && <p className="text-sm text-blue-100/80 font-bold uppercase tracking-widest">{subtitle}</p>}
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
}

