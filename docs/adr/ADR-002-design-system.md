# ADR-002: Design System

## Context

The design system needed to support several product-specific accent identities under one shared visual language, be usable before any real page existed (so it needed Storybook as its own testing ground), and avoid the common failure mode of "component library" repos: components that exist because someone thought they'd be needed, not because something actually needs them yet.

That failure mode showed up concretely during the production-readiness pass: `Dropdown` and `Popover` existed as 9–13 line stubs (a styled `<div>` with an ARIA role, nothing else — no state, no positioning, no keyboard handling) with zero real consumers. `ProductMenu`, which needed exactly that pattern, didn't use them — it implemented outside-click detection, Escape handling, and positioning inline instead, because the generic primitives didn't actually do anything. `Tabs` had the same shape of problem: it accepted an `activeId` prop it never read and never rendered tab panel content at all, just labels.

## Decision

- Design tokens are the only interface between brand and implementation: `src/design/tokens` (primitive HSL scales) → `src/design/theme` + `src/styles/global.css` (semantic CSS variables, light/dark) → `tailwind.config.ts` (semantic Tailwind classes). Components never reach past the semantic layer.
- Every exported component ships with a Storybook story using real prop fixtures (not placeholder strings passed where a structured prop is expected) — this is the acceptance bar for "the design system is complete" for a given component, not just the file existing.
- **A component gets finished properly or removed — no third option.** When a component is a stub with no consumer and no real behavior, keep it out of the library rather than exporting something that looks finished from the outside. `Dropdown` and `Popover` were deleted (no real consumer, and doing them properly needs a floating-positioning library, which is real infrastructure work with zero current demand). `Tabs` was rebuilt properly (WAI-ARIA tabs pattern: roving tabindex, arrow/home/end keyboard navigation, panel visibility tied to the active tab) because it's cheap and near-universally needed, unlike a floating popover.
- Empty placeholder folders (`src/components/{ui,product,marketing,legal,system,icons}`) were removed rather than kept as scaffolding. They weren't tracked in git to begin with (git doesn't track empty directories), so they provided zero value to anyone cloning the repo — they'll be created when there's real content to put in them.

## Alternatives considered

- **Keep the stubs as "coming soon" primitives with a comment.** Rejected: a stub that looks like a finished export is worse than no export — it invites a consumer to build on top of behavior that isn't there, and it was already happening (`ProductMenu` almost certainly would have used `Dropdown` if it had looked functional at a glance).
- **Pull in a floating-UI library (e.g. Floating UI) now to make `Dropdown`/`Popover` real.** Rejected for this pass: zero current consumers means this would be speculative infrastructure — exactly what the project's stated philosophy ("we don't optimize for writing less code, we optimize for writing better code," not for writing *more* code nobody asked for) argues against. Revisit when a real page needs a floating menu that `ProductMenu`'s pattern doesn't already cover.
- **shadcn/ui as the actual component source.** A `components.json` is checked in configuring the shadcn CLI, but no components were ever generated through it — the existing library is hand-authored. Left the config in place as available tooling rather than removing it, since it costs nothing to keep and may be useful for scaffolding future primitives, but corrected the README, which previously implied shadcn was already the foundation.

## Consequences

- The component library is smaller today than before this pass (`Dropdown`/`Popover` gone), but everything that remains actually works, which matters more for a repo meant to be inherited.
- `Tooltip` was also rewritten (from a bare `title` attribute wrapper to a real hover/focus-triggered, Escape-dismissible, `aria-describedby`-linked tooltip) as part of the same review, since it had the identical "looks done, isn't" shape.
- Future component additions should be held to the same bar in review: does it have a real consumer, and does it do everything its prop surface implies?

## Future considerations

- When a real floating dropdown/popover is needed (e.g. a richer product menu, a settings popover), evaluate Floating UI or Radix Primitives rather than hand-rolling positioning again — that's exactly the kind of complexity worth a real dependency instead of bespoke code.
- Revisit whether shadcn's CLI is actually adopted, or remove `components.json` if it continues to sit unused after the homepage phase.
