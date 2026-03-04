import * as React from "react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check } from "lucide-react";

export interface FloatingSelectProps {
    label: string;
    valid?: boolean;
    error?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
    children: React.ReactNode;
    className?: string;
}

export function FloatingSelect({
    label,
    valid,
    error,
    value,
    onValueChange,
    placeholder,
    children,
    className,
}: FloatingSelectProps) {
    const [open, setOpen] = React.useState(false);

    // Determines if the label should float up
    const isFloating = (value !== undefined && value !== "") || open;

    return (
        <div className={"w-full " + (className || "")}>
            <div
                className={cn(
                    "relative rounded-xl border-2 bg-white dark:bg-white/5 transition-all duration-200",
                    open && "border-primary shadow-[0_0_0_1px_rgba(59,130,246,0.1)]",
                    !open && error
                        ? "border-red-300 bg-red-50/30 dark:bg-red-950/20 hover:border-red-400 text-red-900 dark:text-red-300"
                        : !open && "border-gray-200 dark:border-white/15 hover:border-gray-300 dark:hover:border-white/25 bg-white dark:bg-white/5"
                )}
            >
                <Select value={value} onValueChange={onValueChange} onOpenChange={setOpen}>
                    <SelectTrigger
                        className={cn(
                            "w-full bg-transparent border-0 ring-0 focus:ring-0 shadow-none outline-none text-sm font-medium text-gray-900 dark:text-gray-100 px-4 pt-7 pb-2.5 !h-[58px] rounded-xl flex items-center justify-start",
                            "[&>svg]:absolute [&>svg]:right-4 [&>svg]:top-1/2 [&>svg]:-translate-y-1/2",
                            valid && "pr-12"
                        )}
                    >
                        {/* We hide the span when not floating to prevent overlap, keeping structural height */}
                        <div className={cn("truncate", !isFloating && "opacity-0 select-none")}>
                            <SelectValue placeholder={placeholder} />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        {children}
                    </SelectContent>
                </Select>

                {/* Floating Label */}
                <span
                    className={cn(
                        "absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500",
                        "transition-all duration-200 pointer-events-none select-none",
                        isFloating && "top-2.5 translate-y-0 text-[11px] font-medium",
                        error ? "text-red-500" : ""
                    )}
                >
                    {label}
                </span>

                {/* Right icon slot */}
                {valid && !open && (
                    <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                        </div>
                    </div>
                )}
            </div>
            {/* Error message */}
            {error && (
                <p className="mt-1.5 text-xs text-red-500 pl-1">{error}</p>
            )}
        </div>
    );
}
