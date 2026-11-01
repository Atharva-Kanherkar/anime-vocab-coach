import type { LearnOp } from "./model";
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max = 200): v is string => typeof v === "string" && v.length > 0 && v.length <= max && !/[\u0000-\u001f]/.test(v) && !["__proto__", "constructor", "prototype"].includes(v);
const num = (v: unknown, max = 1e9) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
const iso = (v: unknown) => typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v));
const day = (v: unknown) => typeof v === "string" && /^\d{4}-\d\d-\d\d$/.test(v) && Number.isFinite(Date.parse(v + "T00:00:00Z")) && new Date(v + "T00:00:00Z").toISOString().slice(0,10) === v;
const states = ["new", "learning", "known", "ignored"];
export const PUBLIC_SETTINGS: Record<string, (v: unknown) => boolean> = {
  pauseMode: v => ["copilot", "pause", "off"].includes(v as string),
  cooldownSec: v => num(v,120), maxCardsPerHour: v => num(v,60), targetLevel: v => num(v,5) && Number(v)>=1,
  autoResumeSec: v => num(v,120), displayScript: v => ["romaji","kana","kanji","romaji-kana"].includes(v as string),
  learningDirection: v => ["en-ja","ja-en"].includes(v as string),
  autoSpeak: v => typeof v === "boolean", subLens: v => typeof v === "boolean", subLensPeek: v => typeof v === "boolean",
  transcribeModel: v => text(v,100),
  sites: v => object(v) && Object.keys(v).every(k => ["youtube","netflix","generic"].includes(k)) && ["youtube","netflix","generic"].every(k => typeof v[k] === "boolean"),
};
export function publicSettings(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(raw).filter(([k,v]) => Object.prototype.hasOwnProperty.call(PUBLIC_SETTINGS,k) && PUBLIC_SETTINGS[k](v)));
}
function settings(v: unknown) { return object(v) && Object.entries(v).every(([k,x]) => Object.prototype.hasOwnProperty.call(PUBLIC_SETTINGS,k) && PUBLIC_SETTINGS[k](x)); }
function word(v: unknown): boolean {
  if (!object(v) || !text(v.base) || !states.includes(v.state as string)) return false;
  if (!["reading","gloss"].every(k => typeof v[k] === "string" && (v[k] as string).length <= 2000)) return false;
  if (!["seenCount","shownCount"].every(k => num(v[k]))) return false;
  if (!["level","freqRank"].every(k => v[k] === null || num(v[k]))) return false;
  if (!["firstSeenAt","lastSeenAt"].every(k => v[k] === null || iso(v[k]))) return false;
  if (v.source !== null && (!object(v.source) || !["title","line","en"].every(k => v.source && ((v.source as Record<string,unknown>)[k] === null || typeof (v.source as Record<string,unknown>)[k] === "string")))) return false;
  return v.review === null || (object(v.review) && Number.isInteger(v.review.stage) && num(v.review.stage,5) && num(v.review.lapses) && (v.review.dueAt === null || iso(v.review.dueAt)));
}
function daily(v: unknown): boolean { return object(v) && day(v.day) && ["met","judged","reviews","watchMin"].every(k => num(v[k])); }
export function validateLearnOps(raw: unknown): LearnOp[] {
  if (!Array.isArray(raw) || !raw.length || raw.length > 100) throw new Error("invalid_operations");
  const ids = new Set<string>();
  for (const op of raw) {
    if (!object(op) || !text(op.op_id,160) || ids.has(op.op_id) || !iso(op.client_ts) || !object(op.payload) || "user_id" in op) throw new Error("invalid_operation");
    ids.add(op.op_id);
    const p = op.payload;
    let valid = false;
    switch (op.kind) {
      case "import_local": valid = (p.word !== undefined || p.daily !== undefined || p.settings !== undefined) && (p.word === undefined || word(p.word)) && (p.daily === undefined || daily(p.daily)) && (p.settings === undefined || settings(p.settings)); break;
      case "word": valid = word(p.word) && ["seen","save","state"].includes(p.intent as string) && (p.seenDelta === undefined || num(p.seenDelta)) && (p.shownDelta === undefined || num(p.shownDelta)); break;
      case "review": valid = text(p.base) && ["pass","fail"].includes(p.result as string) && day(p.day); break;
      case "settings": valid = settings(p.settings); break;
      case "progress": valid = day(p.day) && object(p.delta) && Object.entries(p.delta).every(([k,v]) => ["met","judged","reviews","watchMin"].includes(k) && num(v,10000)); break;
      case "notebook": valid = object(p.notebook) && text(p.notebook.id) && text(p.notebook.name,80) && iso(p.notebook.createdAt) && iso(p.notebook.updatedAt) && Array.isArray(p.notebook.entries) && p.notebook.entries.length === 0; break;
      case "notebook_delete": valid = text(p.id); break;
      case "notebook_item": valid = text(p.id) && object(p.entry) && text(p.entry.id) && iso(p.entry.createdAt) && ["word","line","note"].includes(p.entry.kind as string) && JSON.stringify(p.entry).length <= 10000; break;
      case "notebook_item_delete": valid = text(p.id) && text(p.entryId); break;
    }
    if (!valid || JSON.stringify(op).length > 20000) throw new Error("invalid_operation");
  }
  return raw as LearnOp[];
}
