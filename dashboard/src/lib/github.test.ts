import { describe, expect, it } from "vitest";
import { assertAutomationVariableName, assertWorkflowKey, workflowFiles } from "@/lib/github";

describe("GitHub automation guards", () => {
  it("allows only supported automation variables", () => {
    expect(() => assertAutomationVariableName("AUTOMATION_ENABLED")).not.toThrow();
    expect(() => assertAutomationVariableName("SEND_AUTOMATION_ENABLED")).not.toThrow();
    expect(() => assertAutomationVariableName("DRY_RUN_SEND")).not.toThrow();
    expect(() => assertAutomationVariableName("APIFY_ENABLED")).not.toThrow();
    expect(() => assertAutomationVariableName("BREVO_API_KEY")).toThrow("Unsupported automation variable");
  });

  it("maps supported workflow keys to existing workflow files", () => {
    expect(workflowFiles.send).toBe("daily-send.yml");
    expect(workflowFiles.sourceCollection).toBe("manual-source-collection.yml");
    expect(workflowFiles.manualDraft).toBe("manual-opportunity-draft.yml");
    expect(workflowFiles.cleanStart).toBe("clean-automatic-start.yml");
    expect(() => assertWorkflowKey("collection")).not.toThrow();
    expect(() => assertWorkflowKey("cleanStart")).not.toThrow();
    expect(() => assertWorkflowKey("deploy")).toThrow("Unsupported workflow");
  });
});
