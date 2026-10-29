import { describe, expect, it } from "vitest";
import { isN5HandoffMessage, N5_HANDOFF_MESSAGE_TYPES } from "../src/lib/n5-handoff";

function msg(value: unknown) {
  return { type: "avc-n5-start-assessment", tabId: 42, lessonId: "your-lie-in-april-s1-e1", attemptId: "att_1", ...value };
}

describe("isN5HandoffMessage", () => {
  it("accepts a well-formed start-assessment handoff", () => {
    expect(isN5HandoffMessage(msg({}))).toBe(true);
  });

  it("accepts an abandon-attempt handoff without optional ids", () => {
    expect(isN5HandoffMessage({ type: "avc-n5-abandon-attempt", tabId: 7 })).toBe(true);
  });

  it("rejects unknown message types", () => {
    expect(isN5HandoffMessage(msg({ type: "avc-not-a-n5-handoff" }))).toBe(false);
    expect(isN5HandoffMessage({ type: "avc-answer-submitted" })).toBe(false);
  });

  it("rejects malformed payloads", () => {
    expect(isN5HandoffMessage({ type: "avc-n5-start-assessment", tabId: 0 })).toBe(false);
    expect(isN5HandoffMessage({ type: "avc-n5-start-assessment", attemptId: "" })).toBe(false);
    expect(isN5HandoffMessage({ type: "avc-n5-start-assessment", lessonId: "x".repeat(129) })).toBe(false);
    expect(isN5HandoffMessage(null)).toBe(false);
    expect(isN5HandoffMessage({ type: "avc-n5-start-assessment", sneaky: true })).toBe(false);
  });

  it("whitelists the two handoff types only", () => {
    expect(N5_HANDOFF_MESSAGE_TYPES).toEqual(["avc-n5-start-assessment", "avc-n5-abandon-attempt"]);
  });
});
