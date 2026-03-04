"use client";

import * as React from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
    children: React.ReactNode;
    defaultTheme?: Theme;
    enableSystem?: boolean;
};

type ThemeProviderState = {
    theme: Theme;
    setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
    theme: "system",
    setTheme: () => null,
};

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState);

// Simple IndexedDB wrapper for theme
const DB_NAME = "morfostocks-settings";
const STORE_NAME = "preferences";
const THEME_KEY = "ui-theme";
const LS_THEME_KEY = "morfostocks-theme"; // localStorage sync-cache for instant read

async function getDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getStoredTheme(): Promise<Theme | null> {
    try {
        const db = await getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(THEME_KEY);
            request.onsuccess = () => resolve(request.result as Theme | null);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error("Failed to read theme from IndexedDB", e);
        return null;
    }
}

async function setStoredTheme(theme: Theme): Promise<void> {
    // Write to localStorage first (sync, used by blocking script to prevent FOUC)
    try {
        localStorage.setItem(LS_THEME_KEY, theme);
    } catch (_) { /* SSR / private browsing */ }

    // Then persist to IndexedDB (async, source of truth)
    try {
        const db = await getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(theme, THEME_KEY);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error("Failed to save theme to IndexedDB", e);
    }
}

export function ThemeProvider({
    children,
    defaultTheme = "system",
    enableSystem = true,
}: ThemeProviderProps) {
    // Read localStorage synchronously to match the blocking script's initial class
    const [theme, setThemeState] = React.useState<Theme>(() => {
        if (typeof window === "undefined") return defaultTheme;
        try {
            const cached = localStorage.getItem(LS_THEME_KEY) as Theme | null;
            if (cached) return cached;
        } catch (_) { /* SSR */ }
        return defaultTheme;
    });
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
        // Also read IndexedDB as source of truth and sync if needed
        getStoredTheme().then((stored) => {
            if (stored && stored !== theme) {
                setThemeState(stored);
                try { localStorage.setItem(LS_THEME_KEY, stored); } catch (_) { /* */ }
            }
        });
    }, []);

    React.useEffect(() => {
        if (!isMounted) return;

        const root = window.document.documentElement;
        root.classList.remove("light", "dark");

        if (theme === "system" && enableSystem) {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
                .matches
                ? "dark"
                : "light";

            root.classList.add(systemTheme);
            return;
        }

        root.classList.add(theme);
    }, [theme, isMounted, enableSystem]);

    const setTheme = React.useCallback(
        (newTheme: Theme) => {
            setThemeState(newTheme);
            setStoredTheme(newTheme);
        },
        []
    );

    const value = React.useMemo(
        () => ({
            theme,
            setTheme,
        }),
        [theme, setTheme]
    );

    return (
        <ThemeProviderContext.Provider value={value}>
            {children}
        </ThemeProviderContext.Provider>
    );
}

export const useTheme = () => {
    const context = React.useContext(ThemeProviderContext);
    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider");
    return context;
};
