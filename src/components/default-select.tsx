import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DefaultSelectProps {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
    placeholder?: string;
    className?: string;
}

export function DefaultSelect({ value, defaultValue, onValueChange, children, placeholder, className }: DefaultSelectProps) {
    return (
        <Select value={value} defaultValue={defaultValue} onValueChange={onValueChange}>
            <SelectTrigger className={className}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {children}
            </SelectContent>
        </Select>
    )
}

export function DefaultSelectItem({ value, disabled, children }: { value: string, disabled?: boolean, children: React.ReactNode }) {
    return (
        <SelectItem value={value} disabled={disabled}>
            {children}
        </SelectItem>
    )
}
