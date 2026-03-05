"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    pressed?: boolean
    onPressedChange?: (pressed: boolean) => void
    variant?: "default" | "outline" | "ghost"
    size?: "default" | "sm" | "lg"
    intent?: "primary" | "danger" | "success" | "warning" // For color control
    indicator?: boolean // Whether to show the physical switch indicator
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
    ({ className, pressed, onPressedChange, variant = "outline", size = "default", intent = "primary", indicator = true, children, onClick, ...props }, ref) => {

        // Color mapping for the active state
        const intentStyles = {
            primary: "bg-blue-600 border-blue-600/20",
            danger: "bg-rose-600 border-rose-600/20",
            success: "bg-emerald-600 border-emerald-600/20",
            warning: "bg-amber-500 border-amber-500/20",
        }

        // Track color mapping (when pressed)
        const trackColor = {
            primary: "group-data-[state=on]:bg-blue-600",
            danger: "group-data-[state=on]:bg-rose-600",
            success: "group-data-[state=on]:bg-emerald-600",
            warning: "group-data-[state=on]:bg-amber-500",
        }

        return (
            <button
                ref={ref}
                type="button"
                aria-pressed={pressed}
                data-state={pressed ? "on" : "off"}
                className={cn(
                    "group inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                    // Base Variants
                    variant === "outline" && "bg-white text-gray-700 shadow-sm hover:shadow-md hover:bg-gray-50/80 transition-all border border-transparent",
                    variant === "ghost" && "hover:bg-accent hover:text-accent-foreground",
                    variant === "default" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",

                    // Active State for Container
                    pressed && variant !== "ghost" && "bg-blue-50/50 shadow-md",

                    // Sizes
                    size === "default" && "h-9 px-3 text-sm",
                    size === "sm" && "h-8 px-2.5 text-xs",
                    size === "lg" && "h-11 px-4 text-base",
                    className
                )}
                onClick={(e) => {
                    if (onPressedChange) {
                        onPressedChange(!pressed)
                    }
                    onClick?.(e)
                }}
                {...props}
            >
                {/* Switch Indicator */}
                {indicator && (
                    <span
                        className={cn(
                            "relative inline-flex items-center shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            // Size of switch
                            size === "sm" ? "h-4 w-7" : "h-5 w-9",
                            // Track Background
                            "bg-gray-200",
                            pressed ? intentStyles[intent].split(" ")[0] : "bg-gray-200"
                        )}
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                "pointer-events-none inline-block transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                                // Thumb Size
                                size === "sm" ? "h-3 w-3" : "h-4 w-4",
                                // Thumb Position
                                pressed ? (size === "sm" ? "translate-x-3" : "translate-x-4") : "translate-x-0"
                            )}
                        />
                    </span>
                )}

                {/* Label Content */}
                <span className={cn(
                    "select-none",
                    pressed && intent === 'primary' && "text-blue-700",
                    pressed && intent === 'danger' && "text-rose-700",
                    pressed && intent === 'success' && "text-emerald-700",
                )}>
                    {children}
                </span>
            </button>
        )
    }
)

Toggle.displayName = "Toggle"

export { Toggle }
