# Writing React components

Rules that lint can't check (nextjs projects). Everything else is enforced: run `pnpm lint`.

## Server and client components

Components are server components by default. Add `"use client"` only to the smallest leaf that needs interactivity,
so the rest of the page renders on the server and ships no JavaScript.

```tsx title="src/features/products/components/quantity-picker.tsx"
"use client";

import { useState } from "react";

/** Props for the quantity picker on the product page. */
export type QuantityPickerProps = { readonly max: number };

/** The only interactive part of the product page, so it's the only client component there. */
export const QuantityPicker = ({ max }: QuantityPickerProps) => {
  const [quantity, setQuantity] = useState(1);
  const isAtMax = quantity >= max;

  const handleIncrease = () => {
    setQuantity((current) => current + 1);
  };

  return (
    <button
      type="button"
      onClick={handleIncrease}
      disabled={isAtMax}
      className="rounded border px-3 py-1"
    >
      Quantity: {quantity}
    </button>
  );
};
```

Source: [Next.js, server and client components](https://nextjs.org/docs/app/getting-started/server-and-client-components)

## Where state lives

Climb the state ladder one rung at a time: component state first, then URL search params (for anything a user would
bookmark or share), and a global store only after both fail. Record the reason for a global store in an ADR.

## Effects

Derive values during render, as `isAtMax` does above. Fetch data in server components. Keep `useEffect` for syncing
with systems outside React: subscriptions, timers, browser APIs.

Source: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

## Composition

Pass content as `children` instead of adding props for every variation. Name a component's props type
`<Component>Props`, next to the component.

```tsx title="src/components/card.tsx"
import type { ReactNode } from "react";

/** Props for the shared card frame. */
export type CardProps = { readonly title: string; readonly children: ReactNode };

/** A titled frame; callers decide what goes inside it. */
export const Card = ({ title, children }: CardProps) => (
  <section className="rounded-lg border p-4">
    <h2 className="text-lg font-semibold">{title}</h2>
    {children}
  </section>
);
```

Source: [Rules of React](https://react.dev/reference/rules)

## Markup and styling

Use semantic HTML first: a `<button>` for actions, a link for navigation, a `<label>` for every input, headings in
order. Style with Tailwind classes in the markup.
