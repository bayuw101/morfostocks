"use client";

import React, { useEffect, useState } from "react";
import {
    LayoutDashboard,
    BookOpen,
    Users,
    ClipboardList,
    Award,
    Settings,
    GraduationCap,
    FileQuestion,
    Database,
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
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/auth/me")
            .then(res => {
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    return res.json();
                }
                return null;
            })
            .then(data => {
                if (data?.user) setUserRole(data.user.role);
            })
            .catch(() => { });
    }, []);

    const renderNavItems = () => {
        if (!userRole) {
            return <NavItem href="/" icon={<LayoutDashboard size={18} strokeWidth={1.9} />} tooltip="Loading..." />;
        }

        switch (userRole) {
            case "ADMIN":
                return (
                    <>
                        <NavItem href="/admin" icon={<LayoutDashboard size={18} strokeWidth={1.9} />} tooltip="Dasbor" />
                        <NavItem href="/admin/accounts" icon={<Users size={18} strokeWidth={1.9} />} tooltip="Akun" />
                        <NavItem href="/admin/classes" icon={<BookOpen size={18} strokeWidth={1.9} />} tooltip="Kelas" />
                        <NavItem href="/admin/subjects" icon={<ClipboardList size={18} strokeWidth={1.9} />} tooltip="Mata Pelajaran" />
                        <NavItem href="/quizzes" icon={<FileQuestion size={18} strokeWidth={1.9} />} tooltip="Asesmen" />
                        <NavItem href="/question-bank" icon={<Database size={18} strokeWidth={1.9} />} tooltip="Bank Soal" />
                    </>
                );
            case "TEACHER":
                return (
                    <>
                        <NavItem href="/teacher" icon={<LayoutDashboard size={18} strokeWidth={1.9} />} tooltip="Dasbor" />
                        <NavItem href="/teacher/classes" icon={<BookOpen size={18} strokeWidth={1.9} />} tooltip="Kelas Saya" />
                        <NavItem href="/teacher/assignments" icon={<ClipboardList size={18} strokeWidth={1.9} />} tooltip="Tugas" />
                        <NavItem href="/quizzes" icon={<FileQuestion size={18} strokeWidth={1.9} />} tooltip="Asesmen" />
                        <NavItem href="/question-bank" icon={<Database size={18} strokeWidth={1.9} />} tooltip="Bank Soal" />
                    </>
                );
            case "STUDENT":
                return (
                    <>
                        <NavItem href="/student" icon={<LayoutDashboard size={18} strokeWidth={1.9} />} tooltip="Dasbor" />
                        <NavItem href="/student/courses" icon={<BookOpen size={18} strokeWidth={1.9} />} tooltip="Kursus" />
                        <NavItem href="/student/assignments" icon={<ClipboardList size={18} strokeWidth={1.9} />} tooltip="Tugas" />
                        <NavItem href="/student/quizzes" icon={<FileQuestion size={18} strokeWidth={1.9} />} tooltip="Asesmen" />
                        <NavItem href="/student/grades" icon={<Award size={18} strokeWidth={1.9} />} tooltip="Nilai" />
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <aside className="fixed left-0 top-0 bottom-0 w-[66px] bg-[#1a2236] hidden md:flex flex-col items-center py-5 z-50">
            {/* Logo */}
            <div className="mb-7">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-500">
                    <GraduationCap className="w-5 h-5 text-white" />
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
