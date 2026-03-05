"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="dashboard-shell flex h-screen bg-[#1a2236] overflow-hidden">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 pl-0 md:pl-[66px] p-0 md:p-3 h-screen overflow-hidden">
                <div className="bg-gray-50 dark:border-white/10 dark:border     dark:bg-[#1a2236] rounded-none md:rounded-2xl h-full flex flex-col overflow-hidden shadow-2xl">
                    {/* Header */}
                    <Header />

                    {/* Scrollable Content */}
                    <main className="main-scroll flex-1 space-y-5 pb-24 md:pb-5">
                        {children}
                        <div className="h-2"></div>
                    </main>
                </div>
            </div>

            {/* Mobile Bottom Navigation */}
            <MobileBottomNav />
        </div>
    );
}
