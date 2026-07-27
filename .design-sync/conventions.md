# ATM Design System — usage conventions

A shadcn/ui-style React library (Radix primitives + Tailwind CSS). All components are exported from `window.AtmUI` (import them from the package entry). Realistic domain: sports-season & tournament scheduling.

## Setup & wrapping
- **No global provider is required** for the components in this kit — they are self-contained. Just render them; tokens come from the stylesheet.
- **Theme**: light by default. Dark mode is class-based — add `class="dark"` to an ancestor element (e.g. `<html>` or a wrapper `<div>`). All token variables have a `.dark` override, so every component re-themes automatically.
- Compound components must be composed with their parts (e.g. `Card` → `CardHeader`/`CardTitle`/`CardContent`/`CardFooter`; `Select` → `SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem`; `Table` → `TableHeader`/`TableRow`/`TableCell`).

## Styling idiom — Tailwind utilities + CSS-variable tokens
Style layout with Tailwind utility classes; use the **semantic token utilities** below (backed by `var(--token)`) so light/dark both work. Never hardcode hex colors — use these:

| Purpose | Background utility | Text utility | Raw token |
|---|---|---|---|
| Primary action | `bg-primary` | `text-primary-foreground` | `--primary` |
| Secondary | `bg-secondary` | `text-secondary-foreground` | `--secondary` |
| Destructive | `bg-destructive` | `text-white` | `--destructive` |
| Muted / subtle | `bg-muted` | `text-muted-foreground` | `--muted` |
| Accent (hover) | `bg-accent` | `text-accent-foreground` | `--accent` |
| Surface | `bg-background` / `bg-card` | `text-foreground` / `text-card-foreground` | `--background`, `--card` |
| Popover/overlay | `bg-popover` | `text-popover-foreground` | `--popover` |
| Borders / fields | `border-border`, `border-input` | — | `--border`, `--input`, `--ring` |

Radius: `--radius` (utilities `rounded-md`, `rounded-lg`). These are the only color names that exist — a `bg-brand`/`text-slate-500` etc. will render unstyled.

## Variant props (don't restyle — use the prop)
- `Button`: `variant` = `default | destructive | outline | secondary | ghost | link`; `size` = `default | sm | lg | icon`; `asChild`.
- `Badge`: `variant` = `default | secondary | destructive | outline`.
- Selection/state comes from the component's own props (`defaultValue`, `defaultChecked`, `disabled`, `defaultOpen`), not CSS.

## Where the truth lives
- **Styles**: `styles.css` and its `@import` closure (incl. `_ds_bundle.css`) — the `:root` block enumerates every token; the `.dark` block its overrides. Read it before inventing any class.
- **Per component**: `<Name>.d.ts` (props contract) and `<Name>.prompt.md` (usage) in each component folder.

## Idiomatic snippet
```jsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from 'AtmUI';

<Card className="w-[340px]">
  <CardHeader>
    <CardTitle>HC Sparta Praha</CardTitle>
    <CardDescription className="text-muted-foreground">Group A · Ice Hockey</CardDescription>
  </CardHeader>
  <CardContent className="flex items-center justify-between text-sm">
    <span>Played 12 · Won 9 · Lost 3</span>
    <Badge variant="secondary">1st</Badge>
  </CardContent>
</Card>
<Button className="mt-3">Save season</Button>
```
