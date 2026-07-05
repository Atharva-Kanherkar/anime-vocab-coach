"use client";

import { useCallback, useEffect, useState } from "react";

interface Entry {
  id: string;
  kind: "word" | "line" | "note";
  word: string | null;
  reading: string | null;
  gloss: string | null;
  line: string | null;
  note: string | null;
  title: string | null;
  level: number | null;
  tags: string[];
  createdAt: string;
}
interface Notebook {
  id: string;
  name: string;
  entries: Entry[];
}
interface SummaryResult {
  weakSpots: string[];
  reviewPrompts: string[];
}

export function NotebookDetail({ id }: { id: string }) {
  const [nb, setNb] = useState<Notebook | null>(null);
  const [error, setError] = useState<string | null>(null); // fatal load error only
  const [actionError, setActionError] = useState<string | null>(null); // add/remove/summary
  const [draft, setDraft] = useState({ word: "", line: "", note: "", title: "" });
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/notebooks/${id}`);
      if (res.status === 404) return setError("Notebook not found.");
      if (!res.ok) return setError(`Couldn't load notebook (HTTP ${res.status}).`);
      const data = (await res.json()) as { notebook: Notebook };
      setNb(data.notebook);
      setError(null);
    } catch {
      setError("Couldn't reach the server. Reload to retry.");
    }
  }, [id]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setActionError(null);
      try {
        const res = await fetch(`/api/notebooks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = (await res.json()) as { notebook: Notebook };
          setNb(data.notebook);
        } else {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setActionError(
            data.error === "notebook_full" ? "This notebook is full." : "That change didn't save. Try again."
          );
        }
      } catch {
        setActionError("Couldn't reach the server. Try again.");
      }
    },
    [id]
  );

  const addEntry = useCallback(async () => {
    const entry = {
      kind: draft.word ? "word" : draft.line ? "line" : "note",
      word: draft.word || undefined,
      line: draft.line || undefined,
      note: draft.note || undefined,
      title: draft.title || undefined,
    };
    if (!draft.word && !draft.line && !draft.note) return;
    await patch({ op: "addEntry", entry });
    setDraft({ word: "", line: "", note: "", title: "" });
  }, [draft, patch]);

  const summarize = useCallback(async () => {
    setSummarizing(true);
    setSummary(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/notebooks/${id}/summary`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { summary?: SummaryResult; error?: string };
      if (res.ok && data.summary) setSummary(data.summary);
      else if (data.error === "ai_not_configured") setActionError("AI summary isn't configured on this server.");
      else if (data.error === "quota_exceeded") setActionError("You've used up this month's AI summaries.");
      else setActionError("Couldn't generate a summary. Try again.");
    } catch {
      setActionError("Couldn't reach the server. Try again.");
    } finally {
      setSummarizing(false);
    }
  }, [id]);

  const exportJson = useCallback(() => {
    if (!nb) return;
    const blob = new Blob([JSON.stringify(nb, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nb.name.replace(/[^\w-]+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nb]);

  const remove = useCallback(async () => {
    if (!confirm("Delete this notebook? This can't be undone.")) return;
    const res = await fetch(`/api/notebooks/${id}`, { method: "DELETE" });
    if (res.ok) window.location.href = "/app";
  }, [id]);

  if (error) return <p className="sync-message">{error}</p>;
  if (!nb) return <p className="sync-message">Loading…</p>;

  return (
    <section className="cloud-panel" aria-label="Notebook detail">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Notebook · {nb.entries.length} {nb.entries.length === 1 ? "entry" : "entries"}</p>
          <h2>{nb.name}</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-line btn-sm" type="button" onClick={exportJson}>Export JSON</button>
          <button className="btn btn-line btn-sm" type="button" onClick={summarize} disabled={summarizing || !nb.entries.length}>
            {summarizing ? "Summarizing…" : "AI review summary"}
          </button>
        </div>
      </div>

      {actionError && <p className="sync-message" role="alert">{actionError}</p>}

      {summary && (
        <div style={{ margin: "12px 0", padding: "12px", border: "1px solid var(--line)", borderRadius: 8 }}>
          {summary.weakSpots.length > 0 && (
            <>
              <p className="eyebrow">Weak spots</p>
              <ul>{summary.weakSpots.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </>
          )}
          {summary.reviewPrompts.length > 0 && (
            <>
              <p className="eyebrow">Review prompts</p>
              <ul>{summary.reviewPrompts.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </>
          )}
        </div>
      )}

      <div style={{ display: "grid", gap: 8, margin: "12px 0" }}>
        <input aria-label="Word" placeholder="Word (e.g. 約束)" value={draft.word} onChange={(e) => setDraft({ ...draft, word: e.target.value })} />
        <input aria-label="Line" placeholder="Line from the scene (optional)" value={draft.line} onChange={(e) => setDraft({ ...draft, line: e.target.value })} />
        <input aria-label="Note" placeholder="Note (e.g. formal usage, keeps coming up in fights)" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        <div style={{ display: "flex", gap: 8 }}>
          <input aria-label="Anime title" placeholder="Anime (optional)" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={{ flex: 1 }} />
          <button className="btn btn-accent" type="button" onClick={addEntry} disabled={!draft.word && !draft.line && !draft.note}>Add</button>
        </div>
      </div>

      {nb.entries.length === 0 ? (
        <p className="sync-message">No entries yet. Add a word, line, or note above.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {nb.entries.map((e) => (
            <li key={e.id} style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div>
                  {e.word && <strong style={{ fontSize: 18 }}>{e.word}{e.reading ? `（${e.reading}）` : ""}</strong>}
                  {e.gloss && <span> — {e.gloss}</span>}
                  {e.line && <div className="jp" style={{ marginTop: 4 }}>{e.line}</div>}
                  {e.note && <div style={{ marginTop: 4, opacity: 0.8 }}>{e.note}</div>}
                  {e.title && <div className="eyebrow" style={{ marginTop: 4 }}>{e.title}{e.level ? ` · N${e.level}` : ""}</div>}
                </div>
                <button className="btn btn-line btn-sm" type="button" aria-label="Remove entry" onClick={() => patch({ op: "removeEntry", entryId: e.id })}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 16 }}>
        <button className="btn btn-line btn-sm" type="button" onClick={remove} style={{ opacity: 0.7 }}>Delete notebook</button>
      </div>
    </section>
  );
}
