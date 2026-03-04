"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Info, CheckCircle2, AlertTriangle, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"

const alertVariants = cva(
    "relative w-full rounded-xl border-l-4 p-4 flex gap-3 items-start",
    {
        variants: {
            variant: {
                default: "bg-blue-50/70 border-l-blue-500 text-blue-900",
                info: "bg-blue-50/70 border-l-blue-500 text-blue-900",
                success: "bg-emerald-50/70 border-l-emerald-500 text-emerald-900",
                warning: "bg-amber-50/70 border-l-amber-500 text-amber-900",
                destructive: "bg-red-50/70 border-l-red-500 text-red-900",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

const alertIconMap = {
    default: Info,
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    destructive: XCircle,
}

const alertIconColors = {
    default: "text-blue-500",
    info: "text-blue-500",
    success: "text-emerald-500",
    warning: "text-amber-500",
    destructive: "text-red-500",
}

const Alert = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant = "default", children, ...props }, ref) => {
    const IconComponent = alertIconMap[variant || "default"]
    const iconColor = alertIconColors[variant || "default"]

    return (
        <div
            ref={ref}
            role="alert"
            className={cn(alertVariants({ variant }), className)}
            {...props}
        >
            <IconComponent className={cn("h-5 w-5 shrink-0 mt-0.5", iconColor)} />
            <div className="flex-1 min-w-0">
                {children}
            </div>
        </div>
    )
})
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h5
        ref={ref}
        className={cn("font-semibold text-sm leading-none tracking-tight", className)}
        {...props}
    />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("text-sm mt-1 opacity-80 [&_p]:leading-relaxed", className)}
        {...props}
    />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
