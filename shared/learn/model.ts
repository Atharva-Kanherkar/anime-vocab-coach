import type { CloudDailyStats, CloudWordRecord } from "../../web/src/lib/sync";
import type { Notebook } from "../../web/src/lib/notebooks";

export type LearnKind = "import_local" | "word" | "review" | "settings" | "progress" | "notebook" | "notebook_delete" | "notebook_item" | "notebook_item_delete";
export interface LearnOp { op_id: string; kind: LearnKind; payload: Record<string, unknown>; client_ts: string }
export interface LearnState {
  words: Record<string, CloudWordRecord>;
  daily: Record<string, CloudDailyStats>;
  settings: Record<string, unknown>;
  notebooks: Record<string, Notebook>;
}
export interface LearnDelta {
  words?: Record<string, CloudWordRecord>;
  daily?: Record<string, CloudDailyStats>;
  settings?: Record<string, unknown>;
  notebooks?: Record<string, Notebook | null>;
}
export interface LearnChange { cursor: number; op_id: string; delta: LearnDelta }
export const emptyLearnState = (): LearnState => ({ words: {}, daily: {}, settings: {}, notebooks: {} });
export const newLearnOp = (kind: LearnKind, payload: Record<string, unknown>, op_id = crypto.randomUUID(), client_ts = new Date().toISOString()): LearnOp => ({ op_id, kind, payload, client_ts });
const intervals = [0, 4 * 3600e3, 24 * 3600e3, 3 * 86400e3, 7 * 86400e3, 21 * 86400e3];

/** Same deterministic projection on the server and over unacknowledged cache writes. */
export function projectLearnOp(state: LearnState, op: LearnOp): LearnDelta {
  const p = op.payload;
  const at = Date.parse(op.client_ts);
  const delta: LearnDelta = {};
  if (op.kind === "word" || op.kind === "import_local") {
    const incoming = p.word as CloudWordRecord | undefined;
    if (incoming) {
      const current = state.words[incoming.base];
      let word = structuredClone(incoming);
      if (op.kind === "import_local" && current) word = current;
      else if (current && p.intent === "seen") {
        word = { ...current, seenCount: current.seenCount + Number(p.seenDelta || 0), shownCount: current.shownCount + Number(p.shownDelta || 0), lastSeenAt: incoming.lastSeenAt };
      } else if (current && p.intent === "save" && incoming.state === "learning" && current.state === "learning") {
        word = { ...incoming, review: current.review };
      }
      state.words[incoming.base] = word;
      delta.words = { [incoming.base]: word };
    }
    if (op.kind === "import_local") {
      const daily = p.daily as CloudDailyStats | undefined;
      if (daily && !state.daily[daily.day]) {
        state.daily[daily.day] = structuredClone(daily);
        delta.daily = { [daily.day]: state.daily[daily.day] };
      }
      if (p.settings) {
        const settings = Object.fromEntries(Object.entries(p.settings as Record<string, unknown>).filter(([k]) => !(k in state.settings)));
        Object.assign(state.settings, settings);
        delta.settings = settings;
      }
    }
  } else if (op.kind === "review") {
    const base = p.base as string;
    const current = state.words[base];
    if (!current) throw new Error("word_not_found");
    const word = structuredClone(current);
    if (word.state === "learning" && word.review) {
      const stage = p.result === "pass" ? word.review.stage + 1 : 1;
      if (stage >= intervals.length) { word.state = "known"; word.review = null; }
      else word.review = { stage, dueAt: new Date(at + intervals[stage]).toISOString(), lapses: word.review.lapses + (p.result === "fail" ? 1 : 0) };
    }
    word.lastSeenAt = op.client_ts;
    state.words[base] = word;
    delta.words = { [base]: word };
    delta.daily = bumpProgress(state, p.day as string, { reviews: 1, judged: 1 });
  } else if (op.kind === "settings") {
    Object.assign(state.settings, p.settings);
    delta.settings = structuredClone(p.settings as Record<string, unknown>);
  } else if (op.kind === "progress") {
    delta.daily = bumpProgress(state, p.day as string, p.delta as Record<string, number>);
  } else if (op.kind === "notebook") {
    const notebook = p.notebook as Notebook;
    // Metadata writes cannot replace entries added on another device.
    const next = { ...structuredClone(notebook), entries: state.notebooks[notebook.id]?.entries || [] };
    state.notebooks[next.id] = next;
    delta.notebooks = { [next.id]: next };
  } else if (op.kind === "notebook_delete") {
    delete state.notebooks[p.id as string];
    delta.notebooks = { [p.id as string]: null };
  } else {
    const id = p.id as string;
    const notebook = state.notebooks[id];
    if (!notebook) throw new Error("notebook_not_found");
    if (op.kind === "notebook_item") {
      const entry = p.entry as Notebook["entries"][number];
      notebook.entries = [structuredClone(entry), ...notebook.entries.filter(e => e.id !== entry.id)];
    } else notebook.entries = notebook.entries.filter(e => e.id !== p.entryId);
    notebook.updatedAt = op.client_ts;
    delta.notebooks = { [id]: structuredClone(notebook) };
  }
  return delta;
}
function bumpProgress(state: LearnState, day: string, values: Record<string, number>): Record<string, CloudDailyStats> {
  const row = state.daily[day] || { day, met: 0, judged: 0, reviews: 0, watchMin: 0 };
  for (const key of ["met", "judged", "reviews", "watchMin"] as const) row[key] += values[key] || 0;
  state.daily[day] = row;
  return { [day]: { ...row } };
}
export function applyLearnDelta(state: LearnState, delta: LearnDelta): void {
  Object.assign(state.words, delta.words);
  Object.assign(state.daily, delta.daily);
  Object.assign(state.settings, delta.settings);
  for (const [id, nb] of Object.entries(delta.notebooks || {})) {
    if (nb) state.notebooks[id] = nb;
    else delete state.notebooks[id];
  }
}
