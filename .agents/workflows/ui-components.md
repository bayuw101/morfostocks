---
description: UI Component conventions and reuse rules for this project
---

# UI Component Guidelines

## Golden Rules

1. **NEVER create new component files** if one already exists in `src/components/ui/`.
2. **ALWAYS import from `@/components/ui/`** — this is the single source of truth.
3. **NEVER import from `@/components/` directly** — those are legacy duplicates from shadcn init.

## Component Directory Structure

```
src/components/
├── providers/                   ← App-level wrappers (used once in layout.tsx)
│   ├── theme-provider.tsx       ← Dark/light/system theme context
│   └── toaster.tsx              ← Toast notification provider (sonner)
├── ui/                          ← PRIMARY: all reusable UI primitives
│   ├── button.tsx               ← Button (with variants via CVA)
│   ├── badge.tsx
│   ├── card.tsx
│   ├── tabs.tsx
│   ├── table.tsx
│   ├── dialog.tsx
│   ├── select.tsx
│   ├── floating-input.tsx       ← Custom floating label input
│   ├── floating-select.tsx      ← Custom floating label select
│   ├── floating-combobox.tsx    ← Custom floating label combobox (searchable)
│   ├── date-picker.tsx          ← DatePicker and DateRangePicker
│   ├── dropdown-menu.tsx
│   ├── popover.tsx
│   ├── command.tsx
│   ├── checkbox.tsx
│   ├── switch.tsx
│   ├── calendar.tsx
│   ├── input.tsx
│   ├── label.tsx
│   └── alert.tsx
├── layout/                      ← Layout-level components
│   ├── header.tsx
│   ├── sidebar.tsx
│   ├── wavy-header.tsx
│   └── mobile-bottom-nav.tsx
├── theme-provider.tsx           ← Theme context (dark/light/system)
└── toaster.tsx                  ← Toast notifications (sonner)
```

## Available Button Variants

```tsx
import { Button } from "@/components/ui/button";

// Variants: default | destructive | outline | secondary | ghost | link
// Sizes: default | xs | sm | lg | icon | icon-xs | icon-sm | icon-lg

<Button variant="default">Get started <ArrowRight /></Button>
<Button variant="outline"><PlusCircle /> Create</Button>
<Button variant="destructive"><Trash2 /> Delete</Button>
<Button variant="secondary"><Download /> Download</Button>
<Button variant="ghost"><Eye /> Preview</Button>
<Button variant="link">View docs</Button>
```

## Available Form Components

```tsx
import { FloatingInput } from "@/components/ui/floating-input";
import { FloatingSelect } from "@/components/ui/floating-select";
import { FloatingCombobox } from "@/components/ui/floating-combobox";
import { DatePicker, DateRangePicker } from "@/components/ui/date-picker";

// FloatingInput — text/email/password/number with floating label
<FloatingInput id="email" label="Email Address" type="email" value={v} onChange={fn} error="..." valid />

// FloatingSelect — select dropdown with floating label
<FloatingSelect label="Broker" value={v} onValueChange={fn} valid>
  <SelectItem value="yp">YP - Mirae Asset</SelectItem>
</FloatingSelect>

// FloatingCombobox — searchable select with floating label
<FloatingCombobox label="Broker" value={v} onValueChange={fn} options={[{value, label}]} valid />
```

## Styling Conventions

- **Colors**: Indigo-600 primary, Red-600 destructive, Gray scale for neutral
- **Dark mode**: Use `dark:` Tailwind variants. Dark bg is `#1a2236`, card bg is `#1e293b`
- **Border radius**: `rounded-xl` (buttons, cards), `rounded-2xl` (large elements)
- **Shadows**: Keep minimal — `shadow-sm` max for most elements
- **No gradients**: Use flat solid colors, no `bg-gradient-to-*` on buttons
- **Icons**: Use `lucide-react`. Always pair buttons with icons when possible
- **Mobile**: Use `sm:` / `md:` breakpoints. Remove card borders on mobile (`border-0 sm:border`)

## Before Creating Any Component

// turbo
1. Search `src/components/ui/` for existing component
2. If it exists → import and use it, customize via className prop
3. If it doesn't exist → create it in `src/components/ui/`
4. NEVER duplicate into `src/components/` root
