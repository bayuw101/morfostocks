"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface Option {
    value: string;
    label: string;
}

interface FloatingComboboxProps {
    options: Option[];
    value: string;
    onValueChange: (value: string) => void;
    label: string;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    error?: string;
    valid?: boolean;
    className?: string;
}

export function FloatingCombobox({
    options,
    value,
    onValueChange,
    label,
    placeholder = "Select option...",
    searchPlaceholder = "Search...",
    emptyText = "No option found.",
    error,
    valid,
    className,
}: FloatingComboboxProps) {
    const [open, setOpen] = React.useState(false);

    // Determines if the label should float up
    const isFloating = (value !== undefined && value !== "") || open;
    const selectedLabel = options.find((opt) => opt.value === value)?.label;

    return (
        <div className={cn("w-full", className)}>
            <div
                className={cn(
                    "relative rounded-xl border-2 bg-white dark:bg-white/5 transition-all duration-200",
                    open && "border-primary shadow-[0_0_0_1px_rgba(59,130,246,0.1)]",
                    !open && error
                        ? "border-red-300 bg-red-50/30 dark:bg-red-950/20 hover:border-red-400 text-red-900 dark:text-red-300"
                        : !open && "border-gray-200 dark:border-white/15 hover:border-gray-300 dark:hover:border-white/25 bg-white dark:bg-white/5"
                )}
            >
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="default"
                            role="combobox"
                            aria-expanded={open}
                            className={cn(
                                "w-full justify-start bg-transparent hover:bg-transparent text-gray-900 dark:text-gray-100 border-0 ring-0 focus:ring-0 shadow-none outline-none font-medium !pl-4 !pr-4 pt-7 pb-2.5 h-[58px] relative text-left rounded-xl transition-all",
                                valid && "!pr-12"
                            )}
                        >
                            <span className={cn("truncate", !isFloating && "opacity-0 select-none")}>
                                {selectedLabel || placeholder}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 absolute right-4 top-1/2 -translate-y-1/2" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 rounded-xl" align="start">
                        <Command>
                            <CommandInput placeholder={searchPlaceholder} className="h-9" />
                            <CommandList>
                                <CommandEmpty>{emptyText}</CommandEmpty>
                                <CommandGroup>
                                    {options.map((option) => (
                                        <CommandItem
                                            key={option.value}
                                            value={option.value}
                                            onSelect={(currentValue) => {
                                                onValueChange(currentValue === value ? "" : currentValue);
                                                setOpen(false);
                                            }}
                                            className="rounded-lg cursor-pointer"
                                        >
                                            {option.label}
                                            <Check
                                                className={cn(
                                                    "ml-auto h-4 w-4",
                                                    value === option.value ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>

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
