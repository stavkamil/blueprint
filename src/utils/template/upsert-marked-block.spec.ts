import { describe, expect, it } from "vitest";

import { upsertMarkedBlock } from "./upsert-marked-block.ts";

describe("upsertMarkedBlock", () => {
  it("fills an empty block in place", () => {
    const document = "# App\n\n<!-- BEGIN:rules -->\n<!-- END:rules -->\n\n## Notes\n";

    const updated = upsertMarkedBlock(document, "rules", "Be kind.");

    expect(updated).toBe(
      "# App\n\n<!-- BEGIN:rules -->\n\nBe kind.\n\n<!-- END:rules -->\n\n## Notes\n",
    );
  });

  it("replaces an existing block and keeps the text around it", () => {
    const document = "intro\n<!-- BEGIN:rules -->\n\nold\n\n<!-- END:rules -->\noutro\n";

    const updated = upsertMarkedBlock(document, "rules", "new");

    expect(updated).toBe("intro\n<!-- BEGIN:rules -->\n\nnew\n\n<!-- END:rules -->\noutro\n");
  });

  it("appends the block when the document has none", () => {
    const document = "# App\n";

    const updated = upsertMarkedBlock(document, "rules", "Be kind.");

    expect(updated).toBe("# App\n\n<!-- BEGIN:rules -->\n\nBe kind.\n\n<!-- END:rules -->\n");
  });

  it("leaves other blocks alone", () => {
    const other = "<!-- BEGIN:nextjs -->\n\nNext's text\n\n<!-- END:nextjs -->";
    const document = `${other}\n`;

    const updated = upsertMarkedBlock(document, "rules", "Be kind.");

    expect(updated.startsWith(other)).toBe(true);
  });

  it("changes nothing when applied twice", () => {
    const once = upsertMarkedBlock("# App\n", "rules", "Be kind.");

    const twice = upsertMarkedBlock(once, "rules", "Be kind.");

    expect(twice).toBe(once);
  });
});
