import React from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { WavyBackground } from "@/components/layout/wavy-header";

export default function SampleTablePage() {
    const data = [
        { id: 1, name: "BBCA", value: "Rp 120,000", change: "+1.2%" },
        { id: 2, name: "BMRI", value: "Rp 85,000", change: "+0.5%" },
        { id: 3, name: "TLKM", value: "Rp 40,000", change: "-0.2%" },
    ];

    return (
        <div className="min-h-screen bg-background text-foreground pb-20 font-sans">
            <div className="-mt-10">
                <WavyBackground
                    title="Sample Table"
                    subtitle="This is a sample table using the copied Morfoschools UI components."
                />
            </div>
            <main className="max-w-7xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl p-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Stock Name</TableHead>
                                <TableHead>Value</TableHead>
                                <TableHead className="text-right">Change</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell className="font-medium">{row.id}</TableCell>
                                    <TableCell>{row.name}</TableCell>
                                    <TableCell>{row.value}</TableCell>
                                    <TableCell className="text-right">{row.change}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </main>
        </div>
    );
}
