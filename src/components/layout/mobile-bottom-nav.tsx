"use client";

import React, { useEffect, useState } from "react";
import {
    LayoutDashboard,
    FileQuestion,
    Database,
    BookOpen,
    Award,
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
        <Link href={href} className="flex-1 flex items-center justify-center">
            <div
                className={cn(
                    "flex flex-col items-center justify-center gap-0.5 px-3 rounded-2xl transition-all duration-200",
                    isActive
                        ? "text-white"
                        : "text-slate-500 active:scale-95"
                )}
            >
                <div
                    className={cn(
                        "w-12 h-10 flex items-center justify-center rounded-xl transition-all duration-300",
                        isActive &&
                        "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold"
                    )}
                >
                    {isActive ? activeIcon : icon}
                </div>
                <span className={cn(
                    "text-[10px] font-medium transition-all duration-200 mt-1",
                    isActive ? "text-blue-600 dark:text-blue-400 opacity-100" : "opacity-0 h-0 overflow-hidden"
                )}>
                    {label}
                </span>
            </div>
        </Link>
    );
}

export function MobileBottomNav() {
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/auth/me")
            .then((res) => {
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    return res.json();
                }
                return null;
            })
            .then((data) => {
                if (data?.user) setUserRole(data.user.role);
            })
            .catch(() => { });
    }, []);

    const getNavItems = (): MobileNavItem[] => {
        switch (userRole) {
            case "ADMIN":
                return [
                    {
                        href: "/admin",
                        icon: <LayoutDashboard size={20} strokeWidth={1.8} />,
                        activeIcon: <LayoutDashboard size={20} strokeWidth={2.2} />,
                        label: "Home",
                    },
                    {
                        href: "/quizzes",
                        icon: <FileQuestion size={20} strokeWidth={1.8} />,
                        activeIcon: <FileQuestion size={20} strokeWidth={2.2} />,
                        label: "Quizzes",
                    },
                    {
                        href: "/question-bank",
                        icon: <Database size={20} strokeWidth={1.8} />,
                        activeIcon: <Database size={20} strokeWidth={2.2} />,
                        label: "Bank",
                    },
                ];
            case "TEACHER":
                return [
                    {
                        href: "/teacher",
                        icon: <LayoutDashboard size={20} strokeWidth={1.8} />,
                        activeIcon: <LayoutDashboard size={20} strokeWidth={2.2} />,
                        label: "Home",
                    },
                    {
                        href: "/quizzes",
                        icon: <FileQuestion size={20} strokeWidth={1.8} />,
                        activeIcon: <FileQuestion size={20} strokeWidth={2.2} />,
                        label: "Quizzes",
                    },
                    {
                        href: "/question-bank",
                        icon: <Database size={20} strokeWidth={1.8} />,
                        activeIcon: <Database size={20} strokeWidth={2.2} />,
                        label: "Bank",
                    },
                ];
            case "STUDENT":
                return [
                    {
                        href: "/student",
                        icon: <LayoutDashboard size={20} strokeWidth={1.8} />,
                        activeIcon: <LayoutDashboard size={20} strokeWidth={2.2} />,
                        label: "Home",
                    },
                    {
                        href: "/student/quizzes",
                        icon: <FileQuestion size={20} strokeWidth={1.8} />,
                        activeIcon: <FileQuestion size={20} strokeWidth={2.2} />,
                        label: "Quiz",
                    },
                    {
                        href: "/student/grades",
                        icon: <Award size={20} strokeWidth={1.8} />,
                        activeIcon: <Award size={20} strokeWidth={2.2} />,
                        label: "Grades",
                    },
                ];
            default:
                return [
                    {
                        href: "/",
                        icon: <LayoutDashboard size={20} strokeWidth={1.8} />,
                        activeIcon: <LayoutDashboard size={20} strokeWidth={2.2} />,
                        label: "Home",
                    },
                ];
        }
    };

    const navItems = getNavItems();

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-[max(12px,env(safe-area-inset-bottom))] px-4 md:hidden pointer-events-none">
            <nav className="flex items-center justify-around bg-white/90 dark:bg-[#1e293b]/90 backdrop-blur-xl rounded-2xl px-2 py-2 shadow-2xl shadow-blue-900/10 dark:shadow-black/40 border border-gray-100 dark:border-white/10 pointer-events-auto w-full max-w-[340px]">
                {navItems.map((item) => (
                    <NavButton key={item.href} {...item} />
                ))}
            </nav>
        </div>
    );
}
