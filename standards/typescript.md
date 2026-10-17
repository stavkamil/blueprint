# Writing TypeScript

Rules that lint can't check. Everything else is enforced: run `pnpm lint`.

## Fixed sets of values

Define them as a PascalCase const object and derive the type from its values, with the same name for both. Values
from APIs and databases then match the type without any mapping.

```ts title="src/features/accounts/role.ts"
/** Roles a user can hold; the values are what the API and database store. */
export const Role = { Admin: "admin", Member: "member" } as const;

/** One of the values of the Role object. */
export type Role = (typeof Role)[keyof typeof Role];
```

Source: [TypeScript handbook, objects vs enums](https://www.typescriptlang.org/docs/handbook/enums.html#objects-vs-enums)

## Data from outside the program

Validate it with Zod at the boundary where it enters: environment variables in `src/config/env.ts`, request bodies,
form input and third-party responses. Derive the type with `z.infer`, and trust the data everywhere past the boundary.

```ts title="src/config/env.ts"
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().positive(),
});

/** The environment after validation; the shape every other module relies on. */
export type Env = z.infer<typeof envSchema>;

/** Parsed once at startup, so a bad deploy fails immediately with a clear message. */
export const env: Env = envSchema.parse(process.env);
```

Source: [Zod](https://zod.dev)

## Failures

Throw an `Error` subclass named for what went wrong. Catch an error only to handle it, or to rethrow it with added
context in `cause`, so the original stack survives.

```ts title="src/features/cart/cart-empty-error.ts"
/** Thrown when checkout starts with no items; the UI shows "Your cart is empty". */
export class CartEmptyError extends Error {
  constructor(cartId: string) {
    super(`Cart ${cartId} has no items`);
    this.name = "CartEmptyError";
  }
}
```

```ts title="src/features/cart/load-cart.ts"
import { readFile } from "node:fs/promises";

/** Loads a saved cart; the added message says which cart failed, and `cause` keeps the original error. */
export const loadCart = async (cartId: string): Promise<string> => {
  try {
    return await readFile(`carts/${cartId}.json`, "utf8");
  } catch (error) {
    throw new Error(`Could not load cart ${cartId}`, { cause: error });
  }
};
```

Source: [MDN, Error cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause)

## What a file exports

Give each file one main export: the function, component or class the file is named for. Its own types and constants
can be exported next to it. Helpers that only this file uses stay unexported.

## JSDoc

Say what the export is for and why it exists, plus anything surprising about it. Add `@param` only for a parameter
whose meaning isn't clear from its name and type. The types themselves come from TypeScript.

## Comments

A comment explains why the code is the way it is; the code itself shows what it does. Every TODO links an issue:
`// TODO(#42): drop the retry once the API is stable`.

## Strings with meaning

Statuses, storage keys, event names and routes live in named constants, placed by the same rule as types (see
`structure.md`), so a typo becomes a compile error.
