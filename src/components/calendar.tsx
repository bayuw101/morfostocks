"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: CalendarProps) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn("p-4 bg-white rounded-2xl", className)}
            classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center mb-2",
                caption_label: "text-base font-bold text-slate-800",
                nav: "space-x-1 flex items-center",
                nav_button: cn(
                    buttonVariants({ variant: "outline" }),
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 hover:bg-slate-100 border-slate-200 transition-all rounded-lg"
                ),
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex mb-2",
                head_cell: "text-slate-400 rounded-md w-9 font-semibold text-[0.7rem] uppercase tracking-wider",
                row: "flex w-full mt-1",
                cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-9 w-9 p-0 font-medium text-slate-700 aria-selected:opacity-100 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all data-[selected=true]:shadow-md border border-transparent"
                ),
                day_selected:
                    "bg-blue-600 text-white hover:bg-blue-700 hover:text-white focus:bg-blue-600 focus:text-white shadow-blue-500/30",
                day_today: "bg-slate-50 text-slate-900 border-slate-200 font-bold",
                day_outside:
                    "day-outside text-slate-300 opacity-50 aria-selected:bg-accent/50 aria-selected:text-slate-500 aria-selected:opacity-30",
                day_disabled: "text-slate-300 opacity-50",
                day_range_middle:
                    "aria-selected:bg-accent aria-selected:text-accent-foreground",
                day_hidden: "invisible",
                ...classNames,
            }}
            components={{
                Chevron: ({ ...props }) => {
                    if (props.orientation === "left") {
                        return <ChevronLeft className="h-4 w-4" />
                    }
                    return <ChevronRight className="h-4 w-4" />
                },
            }}
            {...props}
        />
    )
}
Calendar.displayName = "Calendar"

export { Calendar }
