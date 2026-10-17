# Writing tests

Rules that lint can't check. Everything else is enforced: run `pnpm lint`.

## Where a test lives

Put the test next to the code it tests, in the same folder: `cart.ts` → `cart.spec.ts`. Moving or deleting a module
then moves or deletes its tests with it.

## What a test checks

Test behavior: what a caller or user can observe. Name each test after that behavior, and lay it out as Arrange / Act /
Assert, with a blank line between the three parts.

```ts title="src/features/cart/get-cart-total.ts"
/** A line in the cart; prices are whole cents. */
export type CartItem = { readonly priceInCents: number; readonly quantity: number };

/** Totals the cart in cents, so rounding happens once, at display time. */
export const getCartTotal = (items: readonly CartItem[]): number =>
  items.reduce((total, item) => total + item.priceInCents * item.quantity, 0);
```

```ts title="src/features/cart/get-cart-total.spec.ts"
import { describe, expect, it } from "vitest";

import { type CartItem, getCartTotal } from "./get-cart-total.ts";

const makeItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  priceInCents: 500,
  quantity: 1,
  ...overrides,
});

describe("getCartTotal", () => {
  it("multiplies each price by its quantity", () => {
    const items = [makeItem({ priceInCents: 250, quantity: 2 }), makeItem()];

    const total = getCartTotal(items);

    expect(total).toBe(1000);
  });
});
```

## Test data

Build it with small factories like `makeItem` above: sensible defaults, plus overrides for what the test is about.
Keep factories in the spec file, or in the feature's `testing/` folder once several spec files share them.

## Fakes and mocks

Replace only what sits at the edges of the program: the network, the clock and randomness. Everything inside runs for
real, so a test fails when the code really breaks. Use Vitest's fake timers for time
(`vi.useFakeTimers()`, `vi.setSystemTime(...)`).

Source: [Vitest, mocking](https://vitest.dev/guide/mocking)

## Components

Find elements the way a user does: by role, then by label, then by visible text. Drive interactions with `user-event`,
which types and clicks the way a person would.

Source: [Testing Library guiding principles](https://testing-library.com/docs/guiding-principles)

## Snapshots

Use a snapshot only for small output that rarely changes, such as an error message or one generated line, so every
change to it gets read in review.

## Adding test tools

- **MSW** fakes network calls at the request level. Add it when a feature calls an external API.
- **Playwright** runs real browser tests. Add it for the few critical user flows once the project has them.

Neither is installed by default.

## Coverage

`pnpm test` requires 80% line coverage. Reach it by testing behavior; the number follows from that.
