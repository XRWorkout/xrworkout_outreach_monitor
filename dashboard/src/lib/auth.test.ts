import { describe, expect, it } from "vitest";
import { isAllowedOperator, parseOperatorEmails } from "@/lib/auth";

describe("operator allowlist", () => {
  it("normalizes whitespace and casing", () => {
    const allowlist = parseOperatorEmails("alex@xrworkout.ai, Owner@XRWorkout.ai ");
    expect(isAllowedOperator("owner@xrworkout.ai", allowlist)).toBe(true);
    expect(isAllowedOperator("OWNER@XRWORKOUT.AI", allowlist)).toBe(true);
  });

  it("blocks users outside the allowlist", () => {
    const allowlist = parseOperatorEmails("alex@xrworkout.ai");
    expect(isAllowedOperator("unknown@example.com", allowlist)).toBe(false);
  });
});
