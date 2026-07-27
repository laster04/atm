# design-sync notes — ATM Design System (frontend)

Shape: `package`, **synth-entry** (no dist — `frontend` is a Vite app, not a published lib). The converter synthesizes an entry from `src/components/base/*.tsx`. globalName `AtmUI`, project `02ea112b-de32-492d-9bf6-903c1372794e`.

## Build facts
- Run from repo root: `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules frontend/node_modules --out ./ds-bundle` (no `--entry` — synth mode).
- CSS: `cfg.cssEntry = .ds-compiled.css` (93 KB at `frontend/.ds-compiled.css`) — precompiled Tailwind, the sole style source (no separate tokens package). **It is GITIGNORED** (`.gitignore:39`), so a fresh clone will NOT have it and the build's `cssEntry` will be missing — regenerate it before a re-sync on a clean checkout. If the app's Tailwind classes change, regenerate it or previews/components lose styles.
- No fonts shipped — DS uses the system font stack (no `[FONT_MISSING]`, correct).
- `.ds-sync` dep install: `npm i esbuild ts-morph @types/react playwright-core@1.60.0 playwright@1.60.0` **in one command** — installing playwright separately prunes esbuild/ts-morph from the local lockfile. Playwright **1.60.0** matches the cached chromium build 1223 (`~/.cache/ms-playwright/chromium-1223`).
- `tsconfig: frontend/tsconfig.json not found — skipped` prints every build (lookup is package-relative in synth mode). Harmless — `@components/*` / `@/*` aliases still resolve for the bundle. Not worth chasing.

## Preview conventions (this repo)
- Previews import named exports from `'frontend'` (shimmed to `window.AtmUI`).
- Use **inline styles** for layout glue — `.ds-compiled.css` only contains classes the app actually uses, so an arbitrary Tailwind utility in a preview may be unstyled. `var(--muted-foreground)` etc. tokens DO resolve.
- Overlays (Dialog): render `defaultOpen` + `cfg.overrides.<Name> = {cardMode:'single', viewport:'WxH'}` so the open state captures inside the card. Radix Select/DropdownMenu open content is portaled and does NOT render statically — previews show the closed trigger (honest).
- Wide (Table): `cfg.overrides.Table = {cardMode:'column'}`.

## `.d.ts` contract
- Synth mode + unresolved `VariantProps`/`cva` → auto-extracted props collapse to `[key:string]: unknown`. Hand-written `cfg.dtsPropsFor` added for **Button** and **Badge** only. The other 41 still ship weak props — add `dtsPropsFor` entries when authoring/hardening more components.

## Known render warns (triaged legitimate)
- `[TOKENS_MISSING] --tw-shadow-color, --radix-navigation-menu-viewport-{height,width}, --spacing` — all set at runtime (Tailwind utilities / Radix JS), expected absent from static CSS. Non-blocking.
- `[RENDER_BLANK]`/`[RENDER_THIN]` on unauthored components — these are floor-card / minimal-render primitives, not failures.

## Scope of this sync (first, narrowed)
- User chose the **core 10** for authored previews: Button, Input, Card, Select, Dialog, Checkbox, Label, Badge, Tabs, Table — all graded good.
- Pushed additionally as floor/clean cards: Alert, AspectRatio, Menubar, Slider, Textarea + floor cards AlertDialog, ContextMenu, Drawer, DropdownMenu, Form, HoverCard, Popover, Sheet, Sidebar, ToggleGroup, Tooltip.
- **Deferred (render blank, NOT uploaded — author on a re-sync):** Accordion, Avatar, Breadcrumb, Carousel, Collapsible, Command, InputOTP, NavigationMenu, Pagination, Progress, RadioGroup, ResizablePanelGroup, ScrollArea, Separator, Skeleton, Switch, Toggle. These need composed children/context to not render blank.
- All 43 components import functional from `window.AtmUI` regardless of preview state.

## Grouping
- Every component lands in group `general` (no docs/category source). To regroup, add category stubs via `cfg.docsMap`. Not done this run.

## Re-sync risks (watch-list)
- `.ds-compiled.css` can silently go stale vs the app's real Tailwind output — regenerate before trusting a re-sync's styling.
- Playwright/chromium cache version is environment-specific — re-check `~/.cache/ms-playwright/` and match the `playwright-core` version (see Build facts) on a new machine.
- The 17 deferred components are still floor-blank; a re-sync that authors them must add composed previews.
- `dtsPropsFor` is hand-maintained; if Button/Badge variants change upstream, update the entries.
