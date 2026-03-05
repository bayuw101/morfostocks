"use client";

import React from "react";
import {
    LayoutDashboard,
    Settings,
    Database,
    List,
    BarChart2,
    TrendingUp,
    Users
} from "lucide-react";
import { cn } from "@/lib/utils";

import Link from "next/link";

import { usePathname } from "next/navigation";

interface NavItemProps {
    href?: string;
    icon: React.ReactNode;
    active?: boolean;
    tooltip: string;
    hasBadge?: boolean;
}

const NavItem = ({ href, icon, active, tooltip, hasBadge }: NavItemProps) => {
    const pathname = usePathname();
    const isActive = active || (href && href !== "/" && pathname?.startsWith(href)) || (href === "/" && pathname === "/");

    const content = (
        <div
            className={cn(
                "relative w-[42px] h-[42px] flex items-center justify-center rounded-[11px] cursor-pointer transition-colors text-slate-500 hover:bg-white/5 hover:text-slate-400 group",
                isActive && "bg-white/10 text-white"
            )}
            data-tip={tooltip}
        >
            {icon}
            {/* Tooltip */}
            <div className="absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 bg-slate-900 text-slate-100 text-[11px] font-medium px-2 py-1 rounded-md opacity-0 pointer-events-none transition-all group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1 shadow-lg z-50 whitespace-nowrap">
                {tooltip}
            </div>
            {/* Badge */}
            {hasBadge && (
                <span className="absolute top-[9px] right-[9px] w-[7px] h-[7px] bg-red-500 rounded-full border-[1.5px] border-[#1a2236] animate-pulse"></span>
            )}
        </div>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }

    return content;
};

export function Sidebar() {
    const renderNavItems = () => {
        return (
            <>
                <NavItem href="/dashboard" icon={<LayoutDashboard size={18} strokeWidth={1.9} />} tooltip="Dashboard" />
                <NavItem href="/analysis/technical" icon={<BarChart2 size={18} strokeWidth={1.9} />} tooltip="Technical Analysis" />
                <NavItem href="/analysis/fundamental" icon={<TrendingUp size={18} strokeWidth={1.9} />} tooltip="Fundamental Analysis" />

                <div className="w-6 my-2 border-t border-white/10 mx-auto"></div>

                <NavItem href="/collectors" icon={<Database size={18} strokeWidth={1.9} />} tooltip="Collectors" />
                <NavItem href="/list-stock" icon={<List size={18} strokeWidth={1.9} />} tooltip="List Emiten" />
                <NavItem href="/list-broker" icon={<Users size={18} strokeWidth={1.9} />} tooltip="List Broker" />
            </>
        );
    };

    return (
        <aside className="fixed left-0 top-0 bottom-0 w-[66px] bg-[#1a2236] hidden md:flex flex-col items-center py-5 z-50">
            {/* Logo */}
            <div className="mb-7">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-500">
                    <TrendingUp className="w-5 h-5 text-white" />
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col items-center gap-1 flex-1 w-full">
                {renderNavItems()}

                <div className="w-6 my-2 border-t border-white/10"></div>

                <NavItem icon={<Settings size={18} strokeWidth={1.9} />} tooltip="Pengaturan" />
            </nav>
        </aside>
    );
}
