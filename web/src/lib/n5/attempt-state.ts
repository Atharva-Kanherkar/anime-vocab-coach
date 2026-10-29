import type { N5Answer, N5Attempt } from "../../../../shared/n5/contracts";
import type { Draft, Snapshot } from "./core";

export interface AttemptState {
  answers: N5Answer[];
  acknowledged: N5Answer[];
  revision: number;
  pending: Snapshot | null;
  blocked: "conflict" | "stale_content" | null;
  finishRevision: number | null;
}
export type AttemptAction =
  | { type: "edit"; answers: N5Answer[] }
  | { type: "sending"; snapshot: Snapshot }
  | { type: "acknowledge"; revision: number }
  | { type: "invalid" }
  | { type: "block"; code: "conflict" | "stale_content" }
  | { type: "finish" };

export function sameAnswers(a: N5Answer[], b: N5Answer[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
export function initialAttempt(
  initial: N5Attempt,
  draft: Draft | null,
  contentVersion: string,
): AttemptState {
  const recovered = Boolean(
    draft?.pending &&
    initial.revision === draft.pending.revision + 1 &&
    sameAnswers(initial.answers, draft.pending.answers),
  );
  return {
    answers: draft?.answers ?? initial.answers,
    acknowledged: initial.answers,
    revision: recovered
      ? initial.revision
      : (draft?.revision ?? initial.revision),
    pending: recovered ? null : (draft?.pending ?? null),
    blocked:
      contentVersion !== initial.contentVersion
        ? "stale_content"
        : draft && draft.revision !== initial.revision && !recovered
          ? "conflict"
          : null,
    finishRevision: null,
  };
}
export function locked(state: AttemptState): boolean {
  return Boolean(
    state.pending || state.blocked || state.finishRevision !== null,
  );
}
export function nextSave(state: AttemptState, key: string): Snapshot | null {
  if (state.blocked || state.finishRevision !== null) return null;
  if (state.pending) return state.pending;
  if (sameAnswers(state.answers, state.acknowledged)) return null;
  return {
    revision: state.revision,
    idempotencyKey: key,
    answers: state.answers,
  };
}
export function attemptTransition(
  state: AttemptState,
  action: AttemptAction,
): AttemptState {
  switch (action.type) {
    case "edit":
      return locked(state) ? state : { ...state, answers: action.answers };
    case "sending":
      return locked(state) ? state : { ...state, pending: action.snapshot };
    case "acknowledge":
      return state.pending
        ? {
            ...state,
            revision: action.revision,
            acknowledged: state.pending.answers,
            pending: null,
          }
        : state;
    case "invalid":
      return { ...state, pending: null, finishRevision: null };
    case "block":
      return { ...state, blocked: action.code };
    case "finish":
      return locked(state) || !sameAnswers(state.answers, state.acknowledged)
        ? state
        : { ...state, finishRevision: state.revision };
  }
}
