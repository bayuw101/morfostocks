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
                        icon: <LayoutDashboard size={20} strokeWidth={1.5} />,
                        activeIcon: <LayoutDashboard size={20} strokeWidth={2.2} />,
                        label: "Home",
                    },
                    {
                        href: "/quizzes",
                        icon: <FileQuestion size={20} strokeWidth={1.5} />,
                        activeIcon: <FileQuestion size={20} strokeWidth={2.2} />,
                        label: "Quizzes",
                    },
                    {
                        href: "/question-bank",
                        icon: <Database size={20} strokeWidth={1.5} />,
                        activeIcon: <Database size={20} strokeWidth={2.2} />,
                        label: "Bank",
                    },
                ];
            case "TEACHER":
                return [
                    {
                        href: "/teacher",
                        icon: <LayoutDashboard size={20} strokeWidth={1.5} />,
                        activeIcon: <LayoutDashboard size={20} strokeWidth={2.2} />,
                        label: "Home",
                    },
                    {
                        href: "/quizzes",
                        icon: <FileQuestion size={20} strokeWidth={1.5} />,
                        activeIcon: <FileQuestion size={20} strokeWidth={2.2} />,
                        label: "Quizzes",
                    },
                    {
                        href: "/question-bank",
                        icon: <Database size={20} strokeWidth={1.5} />,
                        activeIcon: <Database size={20} strokeWidth={2.2} />,
                        label: "Bank",
                    },
                ];
            case "STUDENT":
                return [
                    {
                        href: "/student",
                        icon: <LayoutDashboard size={20} strokeWidth={1.5} />,
                        activeIcon: <LayoutDashboard size={20} strokeWidth={2.2} />,
                        label: "Home",
                    },
                    {
                        href: "/student/quizzes",
                        icon: <FileQuestion size={20} strokeWidth={1.5} />,
                        activeIcon: <FileQuestion size={20} strokeWidth={2.2} />,
                        label: "Quiz",
                    },
                    {
                        href: "/student/grades",
                        icon: <Award size={20} strokeWidth={1.5} />,
                        activeIcon: <Award size={20} strokeWidth={2.2} />,
                        label: "Grades",
                    },
                ];
            default:
                return [
                    {
                        href: "/",
                        icon: <LayoutDashboard size={20} strokeWidth={1.5} />,
                        activeIcon: <LayoutDashboard size={20} strokeWidth={2.2} />,
                        label: "Home",
                    },
                ];
        }
    };

    const navItems = getNavItems();

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
