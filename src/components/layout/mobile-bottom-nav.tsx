"use client";

import React from "react";
import {
    LayoutDashboard,
    Database,
    BarChart2,
    TrendingUp,
    Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface MobileNavItem {
    href: string;
    icon: React.ReactNode;
    activeIcon: React.ReactNode;
    label: string;
}

function NavButton({ href, icon, activeIcon, label }: MobileNavItem) {
    const pathname = usePathname();
    const isActive =
        (href !== "/" && pathname?.startsWith(href)) ||
        (href === "/" && pathname === "/");

    return (
        <Link href={href} className="flex-1 flex items-center justify-center py-1">
            <div
                className={cn(
                    "flex flex-col items-center justify-center gap-1 w-full transition-all duration-200",
                    isActive
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-gray-400 dark:text-gray-500 active:scale-90"
                )}
            >
                {/* Active dot indicator */}
                <div className={cn(
                    "w-1 h-1 rounded-full transition-all duration-300",
                    isActive ? "bg-indigo-600 dark:bg-indigo-400 scale-100" : "scale-0"
                )} />

                {/* Icon */}
                <div className={cn(
                    "w-10 h-8 flex items-center justify-center transition-all duration-200",
                    isActive && "scale-110"
                )}>
                    {isActive ? activeIcon : icon}
                </div>

                {/* Label — always visible */}
                <span className={cn(
                    "text-[10px] leading-none font-medium transition-colors duration-200",
                    isActive ? "text-indigo-600 dark:text-indigo-400 font-semibold" : "text-gray-400 dark:text-gray-500"
                )}>
                    {label}
                </span>
            </div>
        </Link>
    );
}

export function MobileBottomNav() {
    const navItems: MobileNavItem[] = [
        {
            href: "/dashboard",
            icon: <LayoutDashboard size={20} strokeWidth={1.5} />,
            activeIcon: <LayoutDashboard size={20} strokeWidth={2.2} />,
            label: "Home",
        },
        {
            href: "/analysis/technical",
            icon: <BarChart2 size={20} strokeWidth={1.5} />,
            activeIcon: <BarChart2 size={20} strokeWidth={2.2} />,
            label: "Technical",
        },
        {
            href: "/analysis/fundamental",
            icon: <TrendingUp size={20} strokeWidth={1.5} />,
            activeIcon: <TrendingUp size={20} strokeWidth={2.2} />,
            label: "Fundamental",
        },
        {
            href: "/analysis/ownership",
            icon: <Users size={20} strokeWidth={1.5} />,
            activeIcon: <Users size={20} strokeWidth={2.2} />,
            label: "Ownership",
        },
        {
            href: "/collectors",
            icon: <Database size={20} strokeWidth={1.5} />,
            activeIcon: <Database size={20} strokeWidth={2.2} />,
            label: "Collectors",
        },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-[max(8px,env(safe-area-inset-bottom))] px-5 md:hidden pointer-events-none">
            <nav className="flex items-center justify-around bg-white/95 dark:bg-[#1a2236]/95 backdrop-blur-2xl rounded-2xl px-1 py-1.5 shadow-lg shadow-black/8 dark:shadow-black/40 border border-gray-200/60 dark:border-white/8 pointer-events-auto w-full max-w-[380px]">
                {navItems.map((item) => (
                    <NavButton key={item.href} {...item} />
                ))}
            </nav>
        </div>
    );
}
