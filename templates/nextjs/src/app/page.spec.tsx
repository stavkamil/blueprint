import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("shows the project name as the main heading", () => {
    render(<HomePage />);

    const heading = screen.getByRole("heading", { level: 1 });

    expect(heading.textContent).toBe("{{projectName}}");
  });
});
