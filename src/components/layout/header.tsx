"use client";

import { Search, Bell, Sun, Moon, Laptop, ChevronDown, User as UserIcon, LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";

interface UserData {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl?: string | null;
}

export function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const segments = pathname?.split('/').filter(Boolean) || [];
    const [user, setUser] = useState<UserData | null>(null);
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        fetch("/api/auth/me")
            .then(res => {
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    return res.json();
                }
                return null;
            })
            .then(data => {
                if (data?.user) setUser(data.user);
            })
            .catch(() => { });
    }, []);

    const handleLogout = async () => {
        console.log("Logout triggered");
    };

    const breadcrumbs = segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join('/')}`;
        const isLast = index === segments.length - 1;

        const title = decodeURIComponent(segment)
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        return { href, title, isLast };
    });

    return (
        <header className="flex items-center gap-3 px-3 md:px-5 py-2.5 border-b border-gray-100 dark:border-white/10 bg-white dark:bg-[#1a2236] rounded-t-none md:rounded-t-2xl shrink-0">
            {/* Breadcrumb - Truncate long IDs on mobile */}
            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 min-w-0 pr-4">
                <Link href="/" className="hover:text-gray-600 transition-colors shrink-0">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                </Link>

                {breadcrumbs.map((crumb) => (
                    <React.Fragment key={crumb.href}>
                        <span className="text-gray-300">/</span>
                        {crumb.isLast ? (
                            <span className="text-gray-700 dark:text-gray-200 font-medium truncate max-w-[120px] sm:max-w-[200px] md:max-w-xs">{crumb.title}</span>
                        ) : (
                            <Link href={crumb.href} className="hover:text-gray-600 transition-colors truncate max-w-[80px] sm:max-w-[150px] md:max-w-xs">
                                {crumb.title}
                            </Link>
                        )}
                    </React.Fragment>
                ))}

                {breadcrumbs.length === 0 && (
                    <>
                        <span className="text-gray-300">/</span>
                        <span className="text-gray-700 dark:text-gray-200 font-medium">Dasbor</span>
                    </>
                )}
            </div>

            <div className="flex-1"></div>

            {/* Search */}
            <div className="hidden md:flex items-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 w-44">
                <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input
                    placeholder="Cari…"
                    className="bg-transparent text-xs text-gray-600 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 outline-none w-full"
                />
            </div>

            {/* Notif */}
            <button className="relative w-8 h-8 hidden md:flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition text-gray-500 dark:text-gray-400">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
            </button>

            {/* Theme Toggle */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="w-8 h-8 hidden md:flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition text-gray-500 dark:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500/20">
                        {mounted && theme === "dark" ? <Moon className="w-4 h-4 text-indigo-400" /> : mounted && theme === "light" ? <Sun className="w-4 h-4 text-amber-500" /> : <Laptop className="w-4 h-4" />}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36 rounded-xl shadow-xl border-gray-100 p-1">
                    <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg" onClick={() => setTheme("light")}>
                        <Sun className="w-3.5 h-3.5" /> Light
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg" onClick={() => setTheme("dark")}>
                        <Moon className="w-3.5 h-3.5" /> Dark
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg" onClick={() => setTheme("system")}>
                        <Laptop className="w-3.5 h-3.5" /> System
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Avatar */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2.5 pl-3 border-l border-gray-100 dark:border-white/10 cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-white/5 py-1.5 px-2 rounded-xl transition-all" suppressHydrationWarning>
                        {user?.avatarUrl ? (
                            <img
                                src={user.avatarUrl}
                                className="w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-[#1a2236] shadow-sm"
                                alt="User"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold ring-2 ring-white dark:ring-[#1a2236] shadow-sm">
                                {user?.name ? user.name.substring(0, 2).toUpperCase() : "US"}
                            </div>
                        )}
                        <div className="hidden sm:flex flex-col items-start justify-center">
                            <span className="block text-xs font-semibold text-gray-700 dark:text-gray-200 leading-tight">{user?.name || "Loading..."}</span>
                            <span className="block text-[10px] text-gray-400 font-medium leading-tight">{user?.role ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : ""}</span>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-0.5 transition-transform duration-200" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 p-2 mt-2 bg-white/95 dark:bg-[#1e293b]/95 backdrop-blur-xl">
                    <DropdownMenuLabel className="font-normal p-3 bg-gray-50/50 dark:bg-white/[0.02] rounded-xl mb-2">
                        <div className="flex items-center gap-3">
                            {user?.avatarUrl ? (
                                <img src={user.avatarUrl} className="w-10 h-10 rounded-full object-cover shadow-sm" alt="User" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                    {user?.name ? user.name.substring(0, 2).toUpperCase() : "US"}
                                </div>
                            )}
                            <div className="flex flex-col space-y-0.5 overflow-hidden">
                                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{user?.name}</p>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                            </div>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuItem className="cursor-pointer gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-gray-100 dark:hover:bg-white/5 focus:bg-gray-100 dark:focus:bg-white/5" onClick={() => router.push("/profile")}>
                        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400">
                            <UserIcon className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-sm text-gray-700 dark:text-gray-200">Edit Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer gap-3 px-3 py-2.5 rounded-xl transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 focus:text-red-700 dark:focus:text-red-300 focus:bg-red-50 dark:focus:bg-red-500/10 mt-1" onClick={handleLogout}>
                        <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400">
                            <LogOut className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-sm">Log out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </header>
    );
}
