import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Button, SoftBadge } from "@/components/ui";

describe("UI containment primitives", () => {
  it("allows status badges to wrap inside narrow creator cards", () => {
    const markup = renderToStaticMarkup(<SoftBadge>Review Required With Longer Dynamic Label</SoftBadge>);

    expect(markup).toContain("max-w-full");
    expect(markup).toContain("whitespace-normal");
    expect(markup).toContain("break-words");
  });

  it("keeps labeled action buttons from forcing horizontal overflow", () => {
    const markup = renderToStaticMarkup(<Button>Contact Ready</Button>);

    expect(markup).toContain("max-w-full");
    expect(markup).toContain("whitespace-normal");
    expect(markup).toContain("leading-5");
  });
});
