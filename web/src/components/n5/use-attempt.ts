"use client";

import { useEffect, useRef, useState } from "react";
import type {
  N5Answer,
  N5Attempt,
  N5Lesson,
} from "../../../../shared/n5/contracts";
import { draftKey, restoreDraft, type Draft } from "@/lib/n5/core";
import {
  attemptTransition,
  initialAttempt,
  nextSave,
  sameAnswers,
  type AttemptAction,
  type AttemptState,
} from "@/lib/n5/attempt-state";
import { CourseFailure, courseRequest, newKey } from "./common";

export function useAttempt(
  initial: N5Attempt,
  lesson: N5Lesson,
  ownerId: string,
) {
  const storageKey = draftKey(ownerId, initial.id);
  const [state, setState] = useState(() => {
    let draft: Draft | null = null;
    try {
      draft = restoreDraft(
        sessionStorage.getItem(storageKey),
        ownerId,
        initial,
        lesson.questions,
      );
    } catch {
      /* optional storage */
    }
    return initialAttempt(initial, draft, lesson.contentVersion);
  });
  const current = useRef(state);
  const [error, setError] = useState<unknown>(
    state.blocked ? new CourseFailure(state.blocked, 409) : null,
  );
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const [finished, setFinished] = useState<N5Attempt | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  function persist(next: AttemptState) {
    const draft: Draft = {
      version: 1,
      ownerId,
      attemptId: initial.id,
      contentVersion: initial.contentVersion,
      script: initial.script,
      revision: next.revision,
      answers: next.answers,
      pending: next.pending,
    };
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      /* explicit save still works */
    }
  }
  function transition(action: AttemptAction) {
    const next = attemptTransition(current.current, action);
    current.current = next;
    setState(next);
    persist(next);
  }
  function edit(answers: N5Answer[]) {
    transition({ type: "edit", answers });
  }
  async function save() {
    for (;;) {
      const snapshot = nextSave(current.current, newKey());
      if (!snapshot) return current.current.revision;
      transition({ type: "sending", snapshot });
      const response = await courseRequest<{ revision: number }>(
        `/attempts/${initial.id}/answers`,
        snapshot,
        undefined,
        abort.current?.signal,
      );
      transition({ type: "acknowledge", revision: response.revision });
      // A stored draft may have later edits alongside an older lost receipt.
    }
  }
  async function submit(finish: boolean) {
    if (
      lock.current ||
      current.current.blocked ||
      !current.current.answers.length
    )
      return;
    lock.current = true;
    abort.current = new AbortController();
    setBusy(true);
    setError(null);
    try {
      const revision = await save();
      if (finish) {
        transition({ type: "finish" });
        const result = await courseRequest<N5Attempt>(
          `/attempts/${initial.id}/finish`,
          { revision: current.current.finishRevision ?? revision },
          undefined,
          abort.current.signal,
        );
        if (result.status !== "complete")
          throw new CourseFailure("course_unavailable", 503);
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          /* optional storage */
        }
        setFinished(result);
      }
    } catch (failure) {
      if (abort.current.signal.aborted) return;
      if (failure instanceof CourseFailure) {
        if (failure.status === 400) transition({ type: "invalid" });
        if (failure.code === "conflict" || failure.code === "stale_content") {
          transition({ type: "block", code: failure.code });
        }
        if (failure.questionId) {
          requestAnimationFrame(() =>
            document.getElementById(`question-${failure.questionId}`)?.focus(),
          );
        }
      }
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function discard(): Promise<boolean> {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    try {
      await courseRequest(`/attempts/${initial.id}`, undefined, "DELETE");
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* optional storage */
      }
      return true;
    } catch (failure) {
      setError(failure);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    state,
    error,
    busy,
    finished,
    edit,
    submit,
    discard,
    saved: !state.pending && sameAnswers(state.answers, state.acknowledged),
    reloadServer() {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* optional storage */
      }
      location.reload();
    },
  };
}
