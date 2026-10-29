import { expect, it } from "vitest";
import fc from "fast-check";
import type { N5Attempt } from "../../../../shared/n5/contracts";
import {
  attemptTransition as step,
  initialAttempt,
  nextSave,
} from "./attempt-state";
const options = { seed: 1762026, numRuns: 1000 };
const base: N5Attempt = {
  id: "attempt",
  courseId: "n5",
  lessonId: "lesson",
  contentVersion: "v1",
  script: "romaji",
  revision: 0,
  status: "active",
  answers: [],
  result: null,
};
it("retries every lost save with the immutable receipt and forbids edits or finish before acknowledgement", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 500 }),
      fc.integer({ min: 0, max: 999999 }),
      (value, revision) => {
        const answers = [{ questionId: "name", value }];
        const dirty = step(initialAttempt({ ...base, revision }, null, "v1"), {
          type: "edit",
          answers,
        });
        const snapshot = nextSave(dirty, "stable")!;
        const pending = step(dirty, { type: "sending", snapshot });
        expect(nextSave(pending, "other")).toBe(snapshot);
        expect(step(pending, { type: "edit", answers: [] })).toBe(pending);
        expect(step(pending, { type: "finish" })).toBe(pending);
        const acknowledged = step(pending, {
          type: "acknowledge",
          revision: revision + 1,
        });
        expect(nextSave(acknowledged, "unused")).toBeNull();
        const finished = step(acknowledged, { type: "finish" });
        expect(finished.finishRevision).toBe(revision + 1);
        expect(nextSave(finished, "unused")).toBeNull();
        expect(step(finished, { type: "edit", answers: [] })).toBe(finished);
      },
    ),
    options,
  );
});
it("a known committed receipt recovers only at its next revision and preserves later unsaved text", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 500 }),
      fc.integer({ min: 0, max: 999999 }),
      (value, revision) => {
        const answers = [{ questionId: "name", value }];
        const draft = {
          version: 1 as const,
          ownerId: "alice",
          attemptId: "attempt",
          contentVersion: "v1",
          script: "romaji",
          revision,
          answers,
          pending: { revision, idempotencyKey: "key", answers },
        };
        const recovered = initialAttempt(
          { ...base, revision: revision + 1, answers },
          draft,
          "v1",
        );
        expect(recovered.pending).toBeNull();
        expect(recovered.blocked).toBeNull();
        expect(recovered.revision).toBe(revision + 1);
        expect(recovered.answers).toEqual(answers);
        expect(
          initialAttempt(
            { ...base, revision: revision + 2, answers },
            draft,
            "v1",
          ).blocked,
        ).toBe("conflict");
      },
    ),
    options,
  );
});
