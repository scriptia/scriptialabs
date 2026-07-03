# Storybook

Storybook is the visual documentation layer for the component library — every populated `src/components/*` folder has a co-located `*.stories.tsx`.

```
npm run storybook          # dev server on :6006, hot reload
npm run build-storybook    # static build to storybook-static/
```

Both are also available through Docker: `docker compose up storybook`, or `docker compose run --rm app npm run build-storybook`.

## Framework: Vite, not Webpack

Storybook runs on **`@storybook/nextjs-vite`** (Storybook 10), not the classic `@storybook/nextjs` webpack framework. This wasn't the original setup — see [ADR-007](adr/ADR-007-storybook.md) for the full story, but in short: `@storybook/nextjs`'s webpack builder mixes Next.js's internally vendored webpack copy with a separately-installed `webpack` package, and a `DefinePlugin` from one gets called against a `Compilation` instance from the other. This reproduced identically across Next.js 15.1 and 15.5, so it wasn't a version-pinning problem — it's a structural incompatibility in how that framework package integrates with Next's webpack internals. The Vite builder doesn't touch Next's webpack at all, and both `storybook dev` and `build-storybook` are verified working on it.

One practical consequence: `storybook`, `@storybook/nextjs-vite`, and `@storybook/react` are pinned to exact versions (not `^` ranges) in `package.json`, because the previous incident started from a caret-range peer-dependency resolving to an incompatible patch version with no lockfile to catch it. Bump all three together, deliberately, not independently.

## Writing a story

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { MyComponent } from './index';

const meta: Meta = {
  title: 'Design System/MyGroup',
  component: MyComponent,
  tags: ['autodocs']
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <MyComponent /* real props */ />
};
```

Note the `meta: Meta` type annotation (not `satisfies Meta`) — `satisfies` keeps the object's narrow inferred type, which makes every story's `args` required even when the story only uses `render`. The explicit `Meta` annotation widens it back to something usable. If a story renders a component that doesn't accept `children` as a plain string (most don't — `Navbar`/`Footer` take structured props), pass real prop fixtures, not placeholder text; a story that doesn't match the component's actual API isn't documentation, it's noise that also breaks typecheck.

## Addons

Storybook 9+ folded `controls`, `actions`, `viewport`, and `interactions` into core — there's no `addons` array entry needed for any of those anymore (Storybook 8's `@storybook/addon-essentials`/`@storybook/addon-interactions` packages don't exist for this version and aren't installed). `.storybook/main.ts`'s `addons: []` is intentional, not a placeholder waiting to be filled in.
