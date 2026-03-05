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
import { useTheme } from "@/components/providers/theme-provider";
import { TokenSettingsModal } from "@/components/layout/token-settings-modal";

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
            {/* <div className="hidden md:flex items-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 w-44">
                <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input
                    placeholder="Cari…"
                    className="bg-transparent text-xs text-gray-600 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 outline-none w-full"
                />
            </div> */}

            {/* Notif */}
            {/* <button className="relative w-8 h-8 hidden md:flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition text-gray-500 dark:text-gray-400">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
            </button> */}

            {/* Token Settings */}
            {mounted && <TokenSettingsModal />}

            {/* Theme Toggle */}
            {/* Theme Toggle */}
            <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="w-8 h-8 hidden md:flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition text-gray-500 dark:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500/20"
                title="Toggle theme"
                suppressHydrationWarning
            >
                {mounted && theme === "dark" ? (
                    <Sun className="w-4 h-4 text-amber-500" />
                ) : (
                    <Moon className="w-4 h-4 text-indigo-400" />
                )}
            </button>

            {/* Avatar */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="group flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 ml-1 border border-transparent hover:border-gray-200 dark:hover:border-white/10 cursor-pointer outline-none bg-transparent hover:bg-gray-50 dark:hover:bg-white/5 rounded-full transition-all focus:ring-2 focus:ring-blue-500/20 data-[state=open]:bg-gray-50 dark:data-[state=open]:bg-white/10 data-[state=open]:border-gray-200 dark:data-[state=open]:border-white/10" suppressHydrationWarning>
                        {user?.avatarUrl ? (
                            <img
                                src={user.avatarUrl}
                                className="w-8 h-8 rounded-full object-cover shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                                alt="User"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                                {user?.name ? user.name.substring(0, 2).toUpperCase() : "US"}
                            </div>
                        )}
                        <div className="hidden sm:flex flex-col items-start justify-center">
                            <span className="block text-xs font-bold text-gray-700 dark:text-gray-200 leading-tight">{user?.name || "Loading..."}</span>
                            <span className="block text-[10px] text-gray-500 font-medium leading-tight">{user?.role ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : ""}</span>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-0.5 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[280px] rounded-2xl shadow-xl shadow-blue-900/5 dark:shadow-black/40 border border-gray-100 dark:border-white/10 p-2 mt-2 bg-white/95 dark:bg-[#1e293b]/95 backdrop-blur-xl">
                    <DropdownMenuLabel className="font-normal p-3 bg-gradient-to-br from-gray-50/80 to-transparent dark:from-white/[0.03] dark:to-transparent rounded-xl mb-2 border border-gray-50 dark:border-white/[0.02]">
                        <div className="flex items-center gap-3.5">
                            {user?.avatarUrl ? (
                                <img src={user.avatarUrl} className="w-11 h-11 rounded-full object-cover shadow-sm ring-2 ring-white dark:ring-[#1e293b]" alt="User" />
                            ) : (
                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm ring-2 ring-white dark:ring-[#1e293b]">
                                    {user?.name ? user.name.substring(0, 2).toUpperCase() : "US"}
                                </div>
                            )}
                            <div className="flex flex-col space-y-0.5 overflow-hidden">
                                <p className="text-[13px] font-bold text-gray-900 dark:text-gray-50 truncate tracking-tight">{user?.name}</p>
                                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                            </div>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-gray-100 dark:bg-white/[0.05] mx-2 mb-2" />
                    <DropdownMenuItem className="cursor-pointer gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-gray-50 dark:hover:bg-white/5 focus:bg-gray-50 dark:focus:bg-white/5 group" onClick={() => router.push("/profile")}>
                        <UserIcon className="h-4 w-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                        <span className="font-medium text-[13px] text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Edit Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 focus:bg-red-50 dark:focus:bg-red-500/10 mt-1" onClick={handleLogout}>
                        <LogOut className="h-4 w-4 opacity-80" />
                        <span className="font-medium text-[13px]">Log out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </header>
    );
}
