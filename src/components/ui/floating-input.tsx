"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface FloatingInputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    valid?: boolean;
    icon?: React.ReactNode;
    error?: string;
}

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
    ({ className, label, valid, icon, error, id, type, onChange, ...props }, ref) => {
        const [localError, setLocalError] = React.useState(error);

        React.useEffect(() => {
            setLocalError(error);
        }, [error]);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (localError) setLocalError(undefined);
            if (onChange) onChange(e);
        };

        return (
            <div className="w-full">
                <div
                    className={cn(
                        "relative rounded-xl border-2 bg-white dark:bg-white/5 transition-all duration-200",
                        "has-[:focus]:border-primary has-[:focus]:shadow-[0_0_0_1px_rgba(59,130,246,0.1)]",
                        localError
                            ? "border-red-300 bg-red-50/30 dark:bg-red-950/20 hover:border-red-400 text-red-900 dark:text-red-300"
                            : "border-gray-200 dark:border-white/15 hover:border-gray-300 dark:hover:border-white/25 bg-white dark:bg-white/5",
                        className
                    )}
                >
                    {/* Input — placed before label for peer selector to work */}
                    <input
                        id={id}
                        ref={ref}
                        type={type}
                        placeholder=" "
                        className={cn(
                            "peer w-full bg-transparent outline-none text-sm font-medium text-gray-900 dark:text-gray-100 px-4 pt-7 pb-2.5 placeholder:text-transparent",
                            (valid || icon) && "pr-12"
                        )}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.currentTarget.blur();
                            }
                            props.onKeyDown?.(e);
                        }}
                        onChange={handleChange}
                        {...props}
                    />

                    {/* Floating Label — uses peer selectors for CSS-only float */}
                    <label
                        htmlFor={id}
                        className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500",
                            "transition-all duration-200 pointer-events-none select-none",
                            // Float up on focus
                            "peer-focus:top-2.5 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:font-medium",
                            // Float up when input has value (handles autofill, defaultValue, typed text)
                            "peer-[:not(:placeholder-shown)]:top-2.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-medium",
                            localError ? "text-red-500" : ""
                        )}
                    >
                        {label}
                    </label>

                    {/* Right icon slot */}
                    {(valid || icon) && (
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                            {valid ? (
                                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                                </div>
                            ) : icon ? (
                                icon
                            ) : null}
                        </div>
                    )}
                </div>

                {/* Error message */}
                {localError && (
                    <p className="mt-1.5 text-xs text-red-500 pl-1">{localError}</p>
                )}
            </div>
        );
    }
);
FloatingInput.displayName = "FloatingInput";

export { FloatingInput };
