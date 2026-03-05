"use client";

import React, { useEffect, useState } from "react";
import { Key } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/ui/floating-input";
import localforage from "localforage";
import { toast } from "sonner"; // Assuming sonner is used as per UI guide toast provider

export function TokenSettingsModal() {
    const [open, setOpen] = useState(false);
    const [token, setToken] = useState("");
    const [wsKey, setWsKey] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Initialize store specifically for API credentials
    const store = localforage.createInstance({
        name: "morfostocks",
        storeName: "credentials",
    });

    useEffect(() => {
        if (open) {
            // Load saved credentials when modal opens
            const loadCredentials = async () => {
                try {
                    const savedToken = await store.getItem<string>("stockbit_token");
                    const savedWsKey = await store.getItem<string>("stockbit_ws_key");
                    if (savedToken) setToken(savedToken);
                    if (savedWsKey) setWsKey(savedWsKey);
                } catch (error) {
                    console.error("Failed to load credentials from IndexedDB:", error);
                }
            };
            loadCredentials();
        }
    }, [open]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (token) {
                await store.setItem("stockbit_token", token);
            } else {
                await store.removeItem("stockbit_token");
            }

            if (wsKey) {
                await store.setItem("stockbit_ws_key", wsKey);
            } else {
                await store.removeItem("stockbit_ws_key");
            }

            toast.success("Credentials saved securely to your browser.");
            setOpen(false);
        } catch (error) {
            console.error("Failed to save credentials to IndexedDB:", error);
            toast.error("Failed to save credentials.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    className="w-8 h-8 hidden md:flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition text-gray-500 dark:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500/20"
                    title="API Keys"
                    suppressHydrationWarning
                >
                    <Key className="w-4 h-4" />
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>API Credentials</DialogTitle>
                    <DialogDescription>
                        These credentials are saved securely in your browser's IndexedDB and are never sent to our servers. They are injected locally when fetching data via server actions.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 mt-2">
                    <div className="w-full">
                        <FloatingInput
                            id="token"
                            label="Stockbit Token"
                            type="text"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                        />
                    </div>
                    <div className="w-full">
                        <FloatingInput
                            id="wsKey"
                            label="Stockbit WebSocket Key"
                            type="password"
                            value={wsKey}
                            onChange={(e) => setWsKey(e.target.value)}
                            placeholder="xxx-yyy-zzz"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save Credentials"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
