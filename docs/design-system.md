# Design System

## Tokens

`src/design/tokens/index.ts` defines primitive color scales (`olive`, `neutral`, `charcoal`, …) as HSL triples. `src/design/theme/index.ts` and `src/styles/global.css` map those primitives to semantic CSS variables (`--color-background`, `--color-surface-elevated`, `--color-text-primary`, `--shadow-high`, …), with separate light/dark variable sets. `tailwind.config.ts` exposes the semantic layer as Tailwind classes (`bg-surface-elevated`, `text-text-primary`, `shadow-high`).

**Components consume the semantic layer, never the primitive scale or raw hex.** If a component needs a new semantic color, it's added to the token/theme layer first, not inlined.

Per-product accent colors (`product-scriptia`, `product-padelco`, `product-voice-agents`) exist in the same system, so product-specific UI can be styled from the token layer instead of ad hoc classes.

## `components.json` / shadcn

A `components.json` is checked in, configuring the shadcn CLI (`ui:` alias → `src/components/ui`) for future use. **No components have actually been generated through it** — every component in `src/components` today is hand-authored. Treat the config as available tooling, not as a claim that shadcn is in use.

## Component library

```
src/components/
  primitives/    Button, Input, Badge, Avatar, Divider, …
  typography/    Heading, Text, and the type scale
  surfaces/      Container, Stack, Card-level layout primitives
  navigation/    Navbar, Footer, Breadcrumb, LanguageSwitcher, ProductMenu, Tooltip, ThemeToggle
  layout/        AppShell, page transitions, route loading/error/not-found states
  display/       Accordion, Tabs, Timeline, Modal, Drawer, Toast, SectionHeading
  feedback/      Spinner, alerts, status states
  data/          Card, ProductCard, FeatureCard, StatCard, ProductStatusBadge
  media/         Image/media wrappers
  motion/        Framer Motion element presets (Fade, Scale, HoverLift, …)
  product/       ProductHero — the one section shared identically by every product page
  legal/         LegalDocumentView, TableOfContents — the shared shell for every legal page
  forms/         Form field primitives
  providers/     Theme/language context providers
```

Every populated folder has a co-located `*.stories.tsx` file with `autodocs`, so props and variants are reviewable in Storybook without reading source.

### `ProductStatusBadge` — the one status pattern

Every place a product's maturity is shown (nav dropdown, mobile menu, homepage cards, product page hero and status section) renders through `ProductStatusBadge` (`src/components/data/product-status-badge.tsx`), which maps `ProductStatus` → visual tone. Adding a new status (Deprecated already exists for this reason) means one entry in that component's `toneByStatus` map and a translated label in `common.productStatus` — never a new badge implementation at a call site. The label text itself is always supplied by the caller (translated), so the component has no i18n dependency of its own.

### `Timeline` — for real sequences only

`src/components/display/timeline.tsx` numbers a list of steps with a connecting line — used for "How it works" on product pages. Numbering here is deliberate: it's a real sequence (step 2 depends on step 1 having happened), which is the one case this repo's conventions consider numbering justified — see the note in `ADR-002` and don't reach for it for an unordered feature list (use `Grid` + `FeatureCard` instead, as the homepage's Philosophy section and every product page's Capabilities section do).

### `LegalDocumentView` — one shell, six documents

Every legal page (`privacy`, `terms`, `cookies`, `contact`, `security`, `ai-policy`) renders through `LegalDocumentView` (`src/components/legal/legal-document.tsx`): title, a "last updated" date, an optional sticky `TableOfContents` (shown automatically once a document has more than 3 sections — `contact`, the shortest page, doesn't get one), and sections rendered from translated content. No legal page hardcodes its own heading rhythm or spacing; a 7th legal document only needs a registry entry and translated section content, not new layout code.

### What's not here yet, and why

`ui`, `marketing`, `system`, and `icons` subfolders don't exist as empty scaffolding in this repo — they were removed as placeholder clutter (see [ADR-002](adr/ADR-002-design-system.md)) and are created only when there's real content to put in them. `product/` and `legal/` were both among those removed folders — they now exist again, populated with `ProductHero` and `LegalDocumentView`/`TableOfContents` respectively, because the Product Pages and Legal & Compliance phases gave them real content.

### Components that were removed rather than finished

`Dropdown` and `Popover` existed as 9–13 line stubs (a styled `<div>` with an ARIA role, no state, no positioning, no keyboard handling) with zero real consumers — `ProductMenu` needed the same pattern and implemented it properly inline instead of using them. They were deleted rather than kept as "coming soon" abstractions. `Tabs` had the same problem (accepted an `activeId` prop it never read, never rendered panel content) and was rebuilt properly instead, since a tab pattern is common and cheap to finish correctly (no positioning library needed, unlike a floating dropdown/popover). `Accordion` had the same problem again (bare `<details>`/`<summary>` with zero styling) and was fixed the same way once product-page FAQs became a real consumer — kept as native `<details>`/`<summary>` rather than a JS-driven accordion, since the native element already gives correct keyboard and screen-reader behavior for free. See [ADR-002](adr/ADR-002-design-system.md) for the full reasoning.

## Motion

`src/lib/motion/presets.ts` defines the actual animation curves (`motionPresets.fade`, `.scale`, `.hoverLift`, …) and is the single source of truth. `src/components/motion/` wraps each preset as a `<Fade>`, `<Scale>`, `<HoverLift>` element component that also respects `prefers-reduced-motion` via `useReducedMotion()`. Route-level page transitions are a separate, purpose-built component (`src/components/layout/page-transition.tsx`, keyed by pathname) — not the generic motion primitives, since a route transition needs to know about the route.

## Accessibility

ARIA attributes and semantic roles are present throughout (`aria-label`, `aria-current`, `aria-busy`, `role="tablist"`/`"tab"`/`"tabpanel"`, etc.), but there's no automated accessibility testing yet (`tests/a11y` is reserved but empty — see [roadmap.md](roadmap.md)). Treat any new interactive component as needing the same manual accessibility review `Tabs` and `Tooltip` got: keyboard operability, focus visibility, and correct ARIA relationships, not just a `role` attribute for show.
