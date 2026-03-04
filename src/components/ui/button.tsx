import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-150 outline-none cursor-pointer select-none active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500/40 dark:focus-visible:ring-offset-[#1a2236] disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-600",
        destructive:
          "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 dark:bg-red-500 dark:hover:bg-red-600",
        outline:
          "border border-gray-200 bg-white text-gray-800 shadow-sm hover:bg-gray-50 active:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10",
        secondary:
          "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-250 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/15",
        ghost:
          "text-gray-600 hover:bg-gray-100 active:bg-gray-150 dark:text-gray-300 dark:hover:bg-white/10",
        link: "text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400 p-0 h-auto shadow-none",
      },
      size: {
        default: "h-10 px-5 py-2 has-[>svg]:px-4",
        xs: "h-7 gap-1 rounded-lg px-2.5 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-lg px-3.5 has-[>svg]:px-3 text-xs",
        lg: "h-12 rounded-2xl px-7 text-base has-[>svg]:px-5",
        icon: "size-10 rounded-xl",
        "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
