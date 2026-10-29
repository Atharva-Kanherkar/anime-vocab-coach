import { describe, expect, it } from "vitest";
import type { N5Attempt } from "../../../../shared/n5/contracts";
import type { Draft } from "./core";
import {
  attemptTransition as step,
  initialAttempt,
  locked,
  nextSave,
  sameAnswers,
} from "./attempt-state";
const answers = [{ questionId: "name", value: "Haru desu" }];
const later = [{ questionId: "name", value: "Aki desu" }];
const initial: N5Attempt = {
  id: "attempt",
  courseId: "n5",
  lessonId: "lesson",
  contentVersion: "v1",
  script: "romaji",
  revision: 3,
  status: "active",
  answers: [],
  result: null,
};
const draft: Draft = {
  version: 1,
  ownerId: "alice",
  attemptId: "attempt",
  contentVersion: "v1",
  script: "romaji",
  revision: 3,
  answers,
  pending: null,
};
const start = () => initialAttempt(initial, null, "v1");
describe("attempt save/finish transitions", () => {
  it("initializes server answers, revision and empty pending without a draft", () => {
    expect(start()).toEqual({
      answers: [],
      acknowledged: [],
      revision: 3,
      pending: null,
      blocked: null,
      finishRevision: null,
    });
    expect(initialAttempt({ ...initial, answers }, null, "v1").answers).toEqual(
      answers,
    );
    expect(locked(start())).toBe(false);
    expect(nextSave(start(), "key")).toBeNull();
  });
  it("saves dirty answers once, acknowledges exact pending values, and skips unchanged saves", () => {
    const edited = step(start(), { type: "edit", answers });
    const snapshot = nextSave(edited, "stable");
    expect(snapshot).toEqual({
      revision: 3,
      idempotencyKey: "stable",
      answers,
    });
    const sending = step(edited, { type: "sending", snapshot: snapshot! });
    expect(locked(sending)).toBe(true);
    expect(nextSave(sending, "different")).toBe(snapshot);
    expect(step(sending, { type: "edit", answers: later })).toBe(sending);
    expect(
      step(sending, {
        type: "sending",
        snapshot: { ...snapshot!, idempotencyKey: "other" },
      }),
    ).toBe(sending);
    const saved = step(sending, { type: "acknowledge", revision: 4 });
    expect(saved).toEqual({
      ...edited,
      revision: 4,
      acknowledged: answers,
      pending: null,
    });
    expect(nextSave(saved, "unused")).toBeNull();
    expect(locked(saved)).toBe(false);
    expect(step(saved, { type: "acknowledge", revision: 100 })).toBe(saved);
    expect(
      nextSave(step(saved, { type: "edit", answers: later }), "new"),
    ).toEqual({ revision: 4, idempotencyKey: "new", answers: later });
  });
  it("keeps a lost finish retry at the acknowledged revision without another answer write", () => {
    const saved = initialAttempt(
      { ...initial, answers, revision: 4 },
      null,
      "v1",
    );
    const finishing = step(saved, { type: "finish" });
    expect(finishing.finishRevision).toBe(4);
    expect(locked(finishing)).toBe(true);
    expect(nextSave(finishing, "never-post")).toBeNull();
    expect(step(finishing, { type: "finish" })).toBe(finishing);
    expect(step(finishing, { type: "edit", answers: later })).toBe(finishing);
    expect(
      step(finishing, {
        type: "sending",
        snapshot: { revision: 4, idempotencyKey: "bad", answers },
      }),
    ).toBe(finishing);
    const invalid = step(finishing, { type: "invalid" });
    expect(invalid.finishRevision).toBeNull();
    expect(locked(invalid)).toBe(false);
  });
  it("cannot finish dirty answers or an unconfirmed save", () => {
    const dirty = step(start(), { type: "edit", answers });
    expect(step(dirty, { type: "finish" })).toBe(dirty);
    const sending = step(dirty, {
      type: "sending",
      snapshot: nextSave(dirty, "stable")!,
    });
    expect(step(sending, { type: "finish" })).toBe(sending);
    const invalid = step(sending, { type: "invalid" });
    expect(invalid.pending).toBeNull();
    expect(invalid.answers).toEqual(answers);
    expect(nextSave(invalid, "fresh")?.idempotencyKey).toBe("fresh");
  });
  it.each(["conflict", "stale_content"] as const)(
    "blocks %s without deleting local work or its pending receipt",
    (code) => {
      const dirty = initialAttempt(initial, draft, "v1");
      const sending = step(dirty, {
        type: "sending",
        snapshot: nextSave(dirty, "key")!,
      });
      const blocked = step(sending, { type: "block", code });
      expect(blocked).toEqual({ ...sending, blocked: code });
      expect(locked(blocked)).toBe(true);
      expect(nextSave(blocked, "new")).toBeNull();
      expect(step(blocked, { type: "edit", answers: [] })).toBe(blocked);
      expect(step(blocked, { type: "finish" })).toBe(blocked);
    },
  );
  it("restores pending receipts, detects version/revision conflicts and recognizes a committed lost response", () => {
    const pending = { revision: 3, idempotencyKey: "stable", answers };
    expect(initialAttempt(initial, { ...draft, pending }, "v1")).toEqual({
      answers,
      acknowledged: [],
      revision: 3,
      pending,
      blocked: null,
      finishRevision: null,
    });
    expect(
      initialAttempt({ ...initial, revision: 4 }, draft, "v1").blocked,
    ).toBe("conflict");
    expect(
      initialAttempt(
        { ...initial, revision: 4, answers: later },
        { ...draft, pending },
        "v1",
      ).blocked,
    ).toBe("conflict");
    expect(
      initialAttempt(
        { ...initial, revision: 5, answers },
        { ...draft, pending },
        "v1",
      ).blocked,
    ).toBe("conflict");
    const recovered = initialAttempt(
      { ...initial, revision: 4, answers },
      { ...draft, pending },
      "v1",
    );
    expect(recovered).toEqual({
      answers,
      acknowledged: answers,
      revision: 4,
      pending: null,
      blocked: null,
      finishRevision: null,
    });
    expect(nextSave(recovered, "unused")).toBeNull();
    const laterDraft = initialAttempt(
      { ...initial, revision: 4, answers },
      { ...draft, answers: later, pending },
      "v1",
    );
    expect(nextSave(laterDraft, "new")).toEqual({
      revision: 4,
      idempotencyKey: "new",
      answers: later,
    });
    expect(initialAttempt(initial, draft, "v2").blocked).toBe("stale_content");
    expect(initialAttempt(initial, null, "v2").blocked).toBe("stale_content");
  });
  it("compares entire snapshots, including answer id and value", () => {
    expect(sameAnswers(answers, [...answers])).toBe(true);
    expect(sameAnswers(answers, later)).toBe(false);
    expect(
      sameAnswers(answers, [{ questionId: "other", value: answers[0].value }]),
    ).toBe(false);
    expect(sameAnswers(answers, [])).toBe(false);
  });
});

it("unlocks a definitively rejected finish without changing answers, acknowledgement or pending save", () => {
  const ready = initialAttempt({ ...initial, answers }, null, "v1");
  const finishing = step(ready, { type: "finish" });
  expect(step(finishing, { type: "finish-rejected" })).toEqual(ready);
  const pending = step(step(start(), { type: "edit", answers }), {
    type: "sending",
    snapshot: { revision: 3, idempotencyKey: "stable", answers },
  });
  expect(step(pending, { type: "finish-rejected" }).pending).toBe(
    pending.pending,
  );
});
