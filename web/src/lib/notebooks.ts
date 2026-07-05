// Anime learning notebooks (issue #14). A notebook is a named collection of
// entries a learner saves while watching — a word, a full line/scene, or a free
// note — organized by anime title, level, and tags. Stored per-user in KV.
//
// This module is pure (model + validation + normalization) so it can be unit
// tested without KV or auth. The store and routes build on it.

export type NotebookEntryKind = "word" | "line" | "note";

export interface NotebookEntry {
  id: string;
  kind: NotebookEntryKind;
  word: string | null; // dictionary base form, for "word" entries
  reading: string | null;
  gloss: string | null;
  line: string | null; // the sentence/scene line
  note: string | null; // free-text learner note
  title: string | null; // anime title
  level: number | null; // JLPT-ish target level
  tags: string[];
  createdAt: string; // ISO
}

export interface Notebook {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  entries: NotebookEntry[];
}

export interface NotebookStoreData {
  schemaVersion: 1;
  notebooks: Notebook[];
}

export interface NotebookSummary {
  id: string;
  name: string;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
}

// Bounds — keep payloads and prompts sane, and stop a runaway client.
export const MAX_NOTEBOOKS = 100;
export const MAX_ENTRIES_PER_NOTEBOOK = 2000;
export const MAX_NAME_LEN = 80;
export const MAX_TEXT_LEN = 500;
export const MAX_TAGS = 12;
export const MAX_TAG_LEN = 30;

function clamp(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim().slice(0, max);
  return t.length ? t : null;
}

function clampName(value: unknown): string {
  const t = typeof value === "string" ? value.trim().slice(0, MAX_NAME_LEN) : "";
  return t.length ? t : "Untitled notebook";
}

function normTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    const t = clamp(raw, MAX_TAG_LEN);
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
      if (out.length >= MAX_TAGS) break;
    }
  }
  return out;
}

function asNumberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Build a validated entry from untrusted input. `id`/`createdAt` are injected. */
export function makeEntry(input: unknown, id: string, createdAt: string): NotebookEntry {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const kind: NotebookEntryKind =
    body.kind === "line" || body.kind === "note" ? body.kind : "word";

  const entry: NotebookEntry = {
    id,
    kind,
    word: clamp(body.word, MAX_TEXT_LEN),
    reading: clamp(body.reading, MAX_TEXT_LEN),
    gloss: clamp(body.gloss, MAX_TEXT_LEN),
    line: clamp(body.line, MAX_TEXT_LEN),
    note: clamp(body.note, MAX_TEXT_LEN),
    title: clamp(body.title, MAX_NAME_LEN),
    level: asNumberOrNull(body.level),
    tags: normTags(body.tags),
    createdAt,
  };
  return entry;
}

/** True when an entry carries at least one piece of content worth saving. */
export function entryHasContent(entry: NotebookEntry): boolean {
  return !!(entry.word || entry.line || entry.note);
}

export function emptyNotebookStore(): NotebookStoreData {
  return { schemaVersion: 1, notebooks: [] };
}

/** Parse/repair whatever is in KV into a valid store (tolerant of old/absent data). */
export function normalizeNotebookStore(raw: unknown): NotebookStoreData {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const notebooks = Array.isArray(data.notebooks) ? data.notebooks : [];
  return {
    schemaVersion: 1,
    notebooks: notebooks
      .map((nb) => normalizeNotebook(nb))
      .filter((nb): nb is Notebook => nb !== null)
      .slice(0, MAX_NOTEBOOKS),
  };
}

function normalizeNotebook(raw: unknown): Notebook | null {
  const nb = (raw && typeof raw === "object" ? raw : null) as Record<string, unknown> | null;
  if (!nb || typeof nb.id !== "string") return null;
  const entriesRaw = Array.isArray(nb.entries) ? nb.entries : [];
  const entries: NotebookEntry[] = entriesRaw
    .map((e) => (e && typeof e === "object" ? (e as Record<string, unknown>) : null))
    .filter((e): e is Record<string, unknown> => e !== null && typeof e.id === "string")
    .map((e) => makeEntry(e, e.id as string, typeof e.createdAt === "string" ? e.createdAt : ""))
    .slice(0, MAX_ENTRIES_PER_NOTEBOOK);
  return {
    id: nb.id,
    name: clampName(nb.name),
    createdAt: typeof nb.createdAt === "string" ? nb.createdAt : "",
    updatedAt: typeof nb.updatedAt === "string" ? nb.updatedAt : "",
    entries,
  };
}

export function toSummary(nb: Notebook): NotebookSummary {
  return {
    id: nb.id,
    name: nb.name,
    entryCount: nb.entries.length,
    createdAt: nb.createdAt,
    updatedAt: nb.updatedAt,
  };
}

export { clampName };
