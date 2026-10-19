import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest runs without globals, so Testing Library can't register its cleanup on its own.
afterEach(() => {
  cleanup();
});
