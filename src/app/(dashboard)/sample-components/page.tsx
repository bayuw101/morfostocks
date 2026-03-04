"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { WavyBackground } from "@/components/layout/wavy-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FloatingInput } from "@/components/ui/floating-input";
import { FloatingSelect } from "@/components/ui/floating-select";
import { FloatingCombobox } from "@/components/ui/floating-combobox";
import { SelectItem } from "@/components/ui/select";
import { DatePicker, DateRangePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Terminal, Mail, Lock, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";

export default function SampleComponentsPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("secret");
    const [amount, setAmount] = useState("");
    const [broker, setBroker] = useState("");
    const [comboboxBroker, setComboboxBroker] = useState("");
    const [date, setDate] = useState<Date>(new Date());
    const [dateRangeFrom, setDateRangeFrom] = useState<Date | null>(new Date());
    const [dateRangeTo, setDateRangeTo] = useState<Date | null>(null);

    const brokersList = [
        { value: "yp", label: "YP - Mirae Asset" },
        { value: "pd", label: "PD - Indo Premier" },
        { value: "cc", label: "CC - Mandiri Sekuritas" },
        { value: "ni", label: "NI - BNI Sekuritas" }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-[#141c2e] dark:to-[#1a2236] font-sans pb-20">
            <WavyBackground
                title="Component Library"
                subtitle="A comprehensive showcase of Morfostocks UI components."
            />
            <main className="max-w-7xl mx-auto md:px-6 lg:px-8 md:-mt-20 relative z-10 pb-0 md:pb-12">
                <Tabs defaultValue="forms" className="space-y-0 md:space-y-6">
                    <TabsList className="w-full flex justify-start overflow-x-auto bg-white/80 dark:bg-white/5 backdrop-blur-md border-b sm:border border-gray-200/50 dark:border-white/10 px-4 sm:px-1 py-2 sm:py-1 shadow-sm rounded-none sm:rounded-xl scrollbar-hide">
                        <TabsTrigger value="forms" className="rounded-lg">Form Inputs</TabsTrigger>
                        <TabsTrigger value="buttons" className="rounded-lg">Buttons & Badges</TabsTrigger>
                        <TabsTrigger value="tables" className="rounded-lg">Tables & Data</TabsTrigger>
                        <TabsTrigger value="feedback" className="rounded-lg">Feedback & Alerts</TabsTrigger>
                    </TabsList>

                    <TabsContent value="tables" className="space-y-6">
                        <Card className="border-0 sm:border border-gray-100 dark:border-white/10 shadow-none sm:shadow-xl shadow-blue-900/5 bg-transparent sm:bg-white sm:dark:bg-[#1e293b] rounded-none sm:rounded-xl">
                            <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
                                <CardTitle>Data Tables</CardTitle>
                                <CardDescription>Clean and modern tables for data presentation.</CardDescription>
                            </CardHeader>
                            <CardContent className="px-4 sm:px-6">
                                <div className="border-y sm:border border-gray-100 dark:border-white/10 overflow-x-auto bg-transparent sm:shadow-sm sm:rounded-xl">
                                    <Table>
                                        <TableHeader className="bg-transparent border-b border-gray-100 dark:border-white/10">
                                            <TableRow className="hover:bg-transparent border-none">
                                                <TableHead className="font-semibold text-gray-600 dark:text-gray-300">Emiten</TableHead>
                                                <TableHead className="font-semibold text-gray-600 dark:text-gray-300">Company</TableHead>
                                                <TableHead className="font-semibold text-gray-600 dark:text-gray-300 text-right">Last Price</TableHead>
                                                <TableHead className="font-semibold text-gray-600 dark:text-gray-300 text-right">Change</TableHead>
                                                <TableHead className="font-semibold text-gray-600 dark:text-gray-300 text-right">Volume</TableHead>
                                                <TableHead className="font-semibold text-gray-600 dark:text-gray-300 text-center">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {[
                                                { symbol: "BBCA", name: "Bank Central Asia Tbk.", price: "9,850", change: "+125", changePct: "+1.28%", isUp: true, vol: "45.2M" },
                                                { symbol: "BBRI", name: "Bank Rakyat Indonesia Tbk.", price: "4,680", change: "-50", changePct: "-1.05%", isUp: false, vol: "128.5M" },
                                                { symbol: "BMRI", name: "Bank Mandiri Tbk.", price: "6,725", change: "+75", changePct: "+1.13%", isUp: true, vol: "36.8M" },
                                                { symbol: "BREN", name: "Barito Renewables Energy Tbk.", price: "7,800", change: "+150", changePct: "+1.96%", isUp: true, vol: "12.4M" },
                                                { symbol: "AMMN", name: "Amman Mineral Internasional Tbk.", price: "8,950", change: "-100", changePct: "-1.10%", isUp: false, vol: "18.2M" }
                                            ].map((stock) => (
                                                <TableRow key={stock.symbol} className="border-none odd:bg-transparent even:bg-slate-50/50 dark:even:bg-white/[0.02] hover:bg-blue-50/50 dark:hover:bg-white/5 transition-colors group">
                                                    <TableCell className="font-bold text-gray-900 dark:text-gray-100">{stock.symbol}</TableCell>
                                                    <TableCell className="text-gray-500 text-xs sm:text-sm max-w-[120px] sm:max-w-none truncate">{stock.name}</TableCell>
                                                    <TableCell className="text-right font-medium text-gray-700 dark:text-gray-200">{stock.price}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className={cn(
                                                            "inline-flex items-center justify-end gap-1 px-2 py-1 rounded-md text-xs font-semibold min-w[80px]",
                                                            stock.isUp ? "text-emerald-700 bg-emerald-50 group-hover:bg-emerald-100" : "text-red-700 bg-red-50 group-hover:bg-red-100"
                                                        )}>
                                                            {stock.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                            {stock.changePct}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-gray-500 dark:text-gray-400 tabular-nums">{stock.vol}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium">Trade</Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="forms" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 sm:gap-6">
                            <Card className="border-0 sm:border border-gray-100 dark:border-white/10 shadow-none sm:shadow-xl shadow-blue-900/5 bg-transparent sm:bg-white sm:dark:bg-[#1e293b] rounded-none sm:rounded-xl">
                                <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
                                    <CardTitle>Floating Inputs</CardTitle>
                                    <CardDescription>Modern floating label inputs with validation states.</CardDescription>
                                </CardHeader>
                                <CardContent className="px-4 sm:px-6 space-y-6">
                                    <FloatingInput
                                        id="email-default"
                                        label="Email Address"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        icon={<Mail className="w-5 h-5 text-gray-400" />}
                                    />

                                    <FloatingInput
                                        id="password-valid"
                                        label="Password (Valid)"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        valid={true}
                                    />

                                    <FloatingInput
                                        id="amount-error"
                                        label="Investment Amount"
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        error="Amount must be greater than Rp 100,000"
                                    />
                                </CardContent>
                            </Card>

                            <Card className="border-0 sm:border border-gray-100 dark:border-white/10 shadow-none sm:shadow-xl shadow-blue-900/5 bg-transparent sm:bg-white sm:dark:bg-[#1e293b] rounded-none sm:rounded-xl mt-6 sm:mt-0 pt-6 sm:pt-0 border-t sm:border-y-0 relative before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-gray-100 dark:before:bg-white/10 sm:before:hidden">
                                <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
                                    <CardTitle>Controls & Selections</CardTitle>
                                    <CardDescription>Advanced selects, comboboxes, and date pickers.</CardDescription>
                                </CardHeader>
                                <CardContent className="px-4 sm:px-6 space-y-6">
                                    <FloatingSelect
                                        label="Select Broker"
                                        placeholder="Pick a broker"
                                        value={broker}
                                        onValueChange={setBroker}
                                        valid={broker !== ""}
                                    >
                                        <SelectItem value="yp">YP - Mirae Asset</SelectItem>
                                        <SelectItem value="pd">PD - Indo Premier</SelectItem>
                                        <SelectItem value="cc">CC - Mandiri Sekuritas</SelectItem>
                                    </FloatingSelect>

                                    <FloatingCombobox
                                        label="Broker (with Search)"
                                        value={comboboxBroker}
                                        onValueChange={setComboboxBroker}
                                        options={brokersList}
                                        valid={comboboxBroker !== ""}
                                    />

                                    <div className="grid grid-cols-2 gap-4">
                                        <DatePicker
                                            date={date}
                                            setDate={setDate}
                                            label="Trade Date"
                                        />
                                        <DateRangePicker
                                            from={dateRangeFrom}
                                            to={dateRangeTo}
                                            onChange={(f, t) => { setDateRangeFrom(f); setDateRangeTo(t); }}
                                            label="Analysis Period"
                                        />
                                    </div>

                                    <hr className="my-4" />

                                    <div className="flex items-center justify-between p-4 border border-gray-100 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-white/5">
                                        <div className="space-y-0.5">
                                            <Label>Auto-save</Label>
                                            <p className="text-xs text-muted-foreground">Automatically save changes.</p>
                                        </div>
                                        <Switch defaultChecked />
                                    </div>

                                    <div className="flex items-center space-x-3 p-4 border border-gray-100 dark:border-white/10 rounded-xl">
                                        <Checkbox id="terms" />
                                        <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            Accept terms and conditions
                                        </Label>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="buttons" className="space-y-6">
                        <Card className="border-0 sm:border border-gray-100 dark:border-white/10 shadow-none sm:shadow-xl shadow-blue-900/5 bg-transparent sm:bg-white sm:dark:bg-[#1e293b] rounded-none sm:rounded-xl">
                            <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
                                <CardTitle>Button Variants</CardTitle>
                                <CardDescription>All available button styles and sizes.</CardDescription>
                            </CardHeader>
                            <CardContent className="px-4 sm:px-6">
                                <div className="flex flex-wrap gap-4 mb-8 border-b pb-8">
                                    <Button variant="default">Default Button</Button>
                                    <Button variant="secondary">Secondary</Button>
                                    <Button variant="destructive">Destructive action</Button>
                                    <Button variant="outline">Outline style</Button>
                                    <Button variant="ghost">Ghost hover</Button>
                                    <Button variant="link">Link button</Button>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium">Badges</h4>
                                    <div className="flex flex-wrap gap-3">
                                        <Badge variant="default">Active</Badge>
                                        <Badge variant="secondary">Draft</Badge>
                                        <Badge variant="destructive">Failed</Badge>
                                        <Badge variant="outline">Archived</Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="feedback" className="space-y-6">
                        <Card className="border-0 sm:border border-gray-100 dark:border-white/10 shadow-none sm:shadow-xl shadow-blue-900/5 bg-transparent sm:bg-white sm:dark:bg-[#1e293b] rounded-none sm:rounded-xl">
                            <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
                                <CardTitle>Alerts & Modals</CardTitle>
                                <CardDescription>Components for conveying important information or flows.</CardDescription>
                            </CardHeader>
                            <CardContent className="px-4 sm:px-6 space-y-6">
                                <div className="space-y-4">
                                    <Alert>
                                        <Terminal className="h-4 w-4" />
                                        <AlertTitle>System Notice</AlertTitle>
                                        <AlertDescription>
                                            Your session will expire in 15 minutes. Please save your work.
                                        </AlertDescription>
                                    </Alert>

                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>Error</AlertTitle>
                                        <AlertDescription>
                                            Failed to connect to the trading server. Please check your connection.
                                        </AlertDescription>
                                    </Alert>
                                </div>

                                <hr className="my-2" />

                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium">Interactive Modals</h4>
                                    <p className="text-xs text-gray-500 mb-4">Click below to test standard dialog boxes.</p>
                                    <div className="flex gap-4">
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="outline">Open Profile Setting</Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-[425px]">
                                                <DialogHeader>
                                                    <DialogTitle>Edit Profile</DialogTitle>
                                                    <DialogDescription>
                                                        Make changes to your profile here. Click save when you're done.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="grid gap-4 py-4">
                                                    <FloatingInput label="Full Name" type="text" id="name" defaultValue="John Doe" />
                                                </div>
                                                <DialogFooter>
                                                    <Button type="submit">Save changes</Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>

                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="destructive">Delete Account</Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-[425px]">
                                                <DialogHeader>
                                                    <DialogTitle>Are you absolutely sure?</DialogTitle>
                                                    <DialogDescription>
                                                        This action cannot be undone. This will permanently delete your account and remove your data from our servers.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <DialogFooter>
                                                    <Button variant="outline" type="button">Cancel</Button>
                                                    <Button variant="destructive" type="button">Confirm Delete</Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </div>

                                <hr className="my-2" />

                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium">Toasts / Notifications</h4>
                                    <p className="text-xs text-gray-500 mb-4">Click below to trigger non-intrusive notification toasts.</p>
                                    <div className="flex flex-wrap gap-4">
                                        <Button
                                            variant="outline"
                                            className="border-emerald-200 hover:bg-emerald-50 text-emerald-700"
                                            onClick={() => toast.success("Draft saved", {
                                                description: "Your recent changes have been saved."
                                            })}
                                        >
                                            Success Toast
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="border-red-200 hover:bg-red-50 text-red-700"
                                            onClick={() => toast.error("Connection Failed", {
                                                description: "Failed to sync with the server. Trying again."
                                            })}
                                        >
                                            Error Toast
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="border-amber-200 hover:bg-amber-50 text-amber-700"
                                            onClick={() => toast.warning("Low Storage", {
                                                description: "You have used 90% of your allocated limits."
                                            })}
                                        >
                                            Warning Toast
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="border-blue-200 hover:bg-blue-50 text-blue-700"
                                            onClick={() => toast.info("Update Available", {
                                                description: "A new version of the dashboard is available to install."
                                            })}
                                        >
                                            Info Toast
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
