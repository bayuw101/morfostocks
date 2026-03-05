"use client";

import React, { useState, useEffect, useMemo } from "react";
import { format, addDays, subDays, isSameDay, startOfMonth, endOfMonth, getDay, addMonths, subMonths } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
    date: Date | null;
    setDate: (date: Date) => void;
    label?: string;
    className?: string;
    showNavigation?: boolean;
    disabled?: boolean;
    minDate?: Date;
    maxDate?: Date;
    placeholder?: string;
    compact?: boolean;
    error?: string;
}

interface DateRangePickerProps {
    from: Date | null;
    to: Date | null;
    onChange: (from: Date | null, to: Date | null) => void;
    label?: string;
    className?: string;
    disabled?: boolean;
    placeholder?: string;
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CustomCalendar({
    date,
    onSelect,
    minDate,
    maxDate,
    rangeFrom,
    rangeTo,
    isRangeMode,
}: {
    date: Date | null;
    onSelect: (date: Date) => void;
    minDate?: Date;
    maxDate?: Date;
    rangeFrom?: Date | null;
    rangeTo?: Date | null;
    isRangeMode?: boolean;
}) {
    const [currentMonth, setCurrentMonth] = useState(date || new Date());

    useEffect(() => {
        if (date) setCurrentMonth(date);
    }, [date]);

    const calendarDays = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        const startDayIndex = getDay(start);
        const totalDays = end.getDate();

        const days: (Date | null)[] = [];

        for (let i = 0; i < startDayIndex; i++) {
            days.push(null);
        }

        for (let i = 1; i <= totalDays; i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    }, [currentMonth]);

    const handlePrevMonth = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentMonth(prev => subMonths(prev, 1));
    };

    const handleNextMonth = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentMonth(prev => addMonths(prev, 1));
    };

    const handleDateClick = (d: Date) => {
        if (minDate && d < minDate) return;
        if (maxDate && d > maxDate) return;
        onSelect(d);
    };

    const isInRange = (d: Date) => {
        if (!isRangeMode || !rangeFrom || !rangeTo) return false;
        return d > rangeFrom && d < rangeTo;
    };

    return (
        <div className="p-4 bg-white dark:bg-[#1e293b] rounded-2xl w-[320px]">
            <div className="flex items-center justify-between mb-4 px-1 select-none">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-gray-100 dark:hover:bg-white/10" onClick={handlePrevMonth}>
                    <ChevronLeft className="h-4 w-4 text-gray-600" />
                </Button>
                <div className="font-bold text-gray-800 dark:text-gray-200 text-sm flex gap-1 items-center">
                    <select
                        className="bg-transparent hover:bg-gray-50 dark:hover:bg-white/10 rounded px-1 py-0.5 outline-none cursor-pointer appearance-none text-center dark:text-gray-200"
                        value={currentMonth.getMonth()}
                        onChange={(e) => {
                            const newDate = new Date(currentMonth);
                            newDate.setMonth(parseInt(e.target.value));
                            setCurrentMonth(newDate);
                        }}
                    >
                        {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                    </select>
                    <select
                        className="bg-transparent hover:bg-gray-50 dark:hover:bg-white/10 rounded px-1 py-0.5 outline-none cursor-pointer appearance-none text-center dark:text-gray-200"
                        value={currentMonth.getFullYear()}
                        onChange={(e) => {
                            const newDate = new Date(currentMonth);
                            newDate.setFullYear(parseInt(e.target.value));
                            setCurrentMonth(newDate);
                        }}
                    >
                        {Array.from({ length: 120 }, (_, i) => new Date().getFullYear() - 100 + i).map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-gray-100 dark:hover:bg-white/10" onClick={handleNextMonth}>
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                </Button>
            </div>

            <div className="grid grid-cols-7 mb-2">
                {DAYS.map(day => (
                    <div key={day} className="text-center text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider py-1">
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1">
                {calendarDays.map((d, i) => {
                    if (!d) return <div key={`empty-${i}`} />;

                    const isSelected = date ? isSameDay(d, date) : false;
                    const isRangeStart = rangeFrom ? isSameDay(d, rangeFrom) : false;
                    const isRangeEnd = rangeTo ? isSameDay(d, rangeTo) : false;
                    const isToday = isSameDay(d, new Date());
                    const isDisabled = (minDate && d < minDate) || (maxDate && d > maxDate);
                    const inRange = isInRange(d);

                    return (
                        <div key={i} className="flex items-center justify-center p-0.5">
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!isDisabled) handleDateClick(d);
                                }}
                                disabled={isDisabled}
                                className={cn(
                                    "w-8 h-8 rounded-full text-xs flex items-center justify-center transition-all select-none relative",
                                    isSelected || isRangeStart || isRangeEnd
                                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold hover:bg-blue-700"
                                        : inRange
                                            ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium"
                                            : isDisabled
                                                ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                                                : isToday
                                                    ? "bg-gray-100 dark:bg-white/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-500/30"
                                                    : "text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-white/10 hover:text-blue-600 font-medium"
                                )}
                            >
                                {d.getDate()}
                                {isToday && !isSelected && !isRangeStart && !isRangeEnd && (
                                    <div className="absolute bottom-1 w-1 h-1 rounded-full bg-blue-400"></div>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ─── Floating-style trigger ─────────────────────────────────────── */
function FloatingTrigger({
    label,
    value,
    placeholder,
    disabled,
    isOpen,
    onClick,
    error,
}: {
    label?: string;
    value: string | null;
    placeholder: string;
    disabled?: boolean;
    isOpen: boolean;
    onClick?: () => void;
    error?: string;
}) {
    const hasValue = !!value;

    return (
        <div className="w-full">
            <button
                type="button"
                disabled={disabled}
                onClick={onClick}
                className={cn(
                    "relative w-full text-left rounded-xl border-2 transition-all duration-200 cursor-pointer",
                    isOpen
                        ? "border-primary shadow-[0_0_0_1px_rgba(59,130,246,0.1)] bg-white dark:bg-white/5"
                        : error
                            ? "border-red-300 bg-red-50/30 dark:bg-red-950/20 hover:border-red-400 text-red-900 dark:text-red-300"
                            : "border-gray-200 dark:border-white/15 hover:border-gray-300 dark:hover:border-white/25 bg-white dark:bg-white/5",
                    disabled && "opacity-50 cursor-not-allowed",
                    label ? "min-h-[52px]" : "h-11"
                )}
            >
                {label && (
                    <span
                        className={cn(
                            "absolute left-4 top-2.5 text-[11px] font-medium pointer-events-none select-none",
                            error ? "text-red-500" : "text-gray-400 dark:text-gray-500"
                        )}
                    >
                        {label}
                    </span>
                )}
                <div className={cn(
                    "flex items-center px-4 cursor-pointer",
                    label ? "pt-7 pb-2.5" : "py-3"
                )}>
                    <CalendarIcon className={cn("mr-2 h-4 w-4 shrink-0", error ? "text-red-400" : "text-gray-400")} />
                    <span className={cn(
                        "text-sm font-medium truncate",
                        hasValue ? (error ? "text-red-900 dark:text-red-300" : "text-gray-900 dark:text-gray-100") : "text-gray-400 dark:text-gray-500"
                    )}>
                        {value || placeholder}
                    </span>
                </div>
            </button>
            {error && <p className="mt-1.5 text-xs text-red-500 pl-1 text-left">{error}</p>}
        </div>
    );
}

export function DatePicker({
    date,
    setDate,
    label,
    className,
    showNavigation = true,
    disabled = false,
    minDate,
    maxDate,
    placeholder = "Pick a date",
    compact = false,
    error
}: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handlePrevDay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (date) {
            const newDate = subDays(date, 1);
            if (!minDate || newDate >= minDate) {
                setDate(newDate);
            }
        }
    };

    const handleNextDay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (date) {
            const newDate = addDays(date, 1);
            if (!maxDate || newDate <= maxDate) {
                setDate(newDate);
            }
        }
    };

    const isPrevDisabled = disabled || !date || (minDate && subDays(date, 1) < minDate);
    const isNextDisabled = disabled || !date || (maxDate && addDays(date, 1) > maxDate);

    const displayValue = date
        ? format(date, compact ? "dd MMM yy" : "MMM dd, yyyy")
        : null;

    return (
        <div className={cn("flex items-center", compact ? "gap-0" : "gap-1", className)}>
            {showNavigation && (
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-all shrink-0",
                        compact ? "h-6 w-6" : "h-9 w-9"
                    )}
                    onClick={handlePrevDay}
                    disabled={isPrevDisabled}
                >
                    <ChevronLeft className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
                </Button>
            )}

            {mounted && (
                <Popover open={isOpen} onOpenChange={setIsOpen}>
                    <PopoverTrigger asChild>
                        <div className={cn(showNavigation ? "flex-1" : "w-full")}>
                            <FloatingTrigger
                                label={label}
                                value={displayValue}
                                placeholder={placeholder}
                                disabled={disabled}
                                isOpen={isOpen}
                                onClick={() => setIsOpen(true)}
                                error={error}
                            />
                        </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-none shadow-xl rounded-2xl" align="center">
                        <CustomCalendar
                            date={date}
                            onSelect={(d) => {
                                setDate(d);
                                setIsOpen(false);
                            }}
                            minDate={minDate}
                            maxDate={maxDate}
                        />
                    </PopoverContent>
                </Popover>
            )}

            {showNavigation && (
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-all shrink-0",
                        compact ? "h-6 w-6" : "h-9 w-9"
                    )}
                    onClick={handleNextDay}
                    disabled={isNextDisabled}
                >
                    <ChevronRight className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
                </Button>
            )}
        </div>
    );
}

export function DateRangePicker({
    from,
    to,
    onChange,
    label,
    className,
    disabled = false,
    placeholder = "Select date range",
}: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selecting, setSelecting] = useState<"from" | "to">("from");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleSelect = (d: Date) => {
        if (selecting === "from") {
            onChange(d, null);
            setSelecting("to");
        } else {
            if (from && d < from) {
                onChange(d, null);
                setSelecting("to");
            } else {
                onChange(from, d);
                setSelecting("from");
                setIsOpen(false);
            }
        }
    };

    const displayValue = from && to
        ? `${format(from, "MMM dd")} – ${format(to, "MMM dd, yyyy")}`
        : from
            ? `${format(from, "MMM dd, yyyy")} – ...`
            : null;

    return (
        <div className={cn("flex items-center", className)}>
            {mounted && (
                <Popover open={isOpen} onOpenChange={(open) => {
                    setIsOpen(open);
                    if (open) setSelecting("from");
                }}>
                    <PopoverTrigger asChild>
                        <div className="w-full">
                            <FloatingTrigger
                                label={label}
                                value={displayValue}
                                placeholder={placeholder}
                                disabled={disabled}
                                isOpen={isOpen}
                            />
                        </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-none shadow-xl rounded-2xl" align="center">
                        <div className="px-4 pt-3 pb-1">
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                {selecting === "from" ? "Select start date" : "Select end date"}
                            </p>
                        </div>
                        <CustomCalendar
                            date={selecting === "from" ? from : to}
                            onSelect={handleSelect}
                            rangeFrom={from}
                            rangeTo={to}
                            isRangeMode={true}
                        />
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
}
