import * as React from "react";

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, onChange, ...props }, ref) => {
        const isNumber = type === 'number';
        const actualType = isNumber ? 'text' : type || 'text';

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (isNumber) {
                // Allow digits and a single optional decimal point
                let val = e.target.value.replace(/[^0-9.]/g, '');
                // Prevent multiple decimals
                const parts = val.split('.');
                if (parts.length > 2) {
                    val = parts[0] + '.' + parts.slice(1).join('');
                }
                e.target.value = val;
            }
            if (onChange) {
                onChange(e);
            }
        };

        return (
            <input
                type={actualType}
                inputMode={isNumber ? "decimal" : props.inputMode}
                onChange={handleChange}
                className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ""}`}
                ref={ref}
                {...props}
            />
        );
    }
);
Input.displayName = "Input";

export { Input };
