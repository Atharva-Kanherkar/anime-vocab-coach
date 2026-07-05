"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Summary {
  id: string;
  name: string;
  entryCount: number;
  updatedAt: string;
}

// Notebooks list + create, shown on /app. Detail/entries live on
// /app/notebooks/[id]. UX is intentionally plain — styling comes later.
export function NotebooksPanel() {
  const [notebooks, setNotebooks] = useState<Summary[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notebooks");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { notebooks: Summary[] };
      setNotebooks(data.notebooks);
      setError(null);
    } catch {
      setError("Couldn't load notebooks.");
      setNotebooks([]);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const create = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setName("");
      await load();
    } catch {
      setError("Couldn't create the notebook.");
    } finally {
      setBusy(false);
    }
  }, [name, busy, load]);

  return (
    <section className="cloud-panel" aria-label="Notebooks">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Notebooks</p>
          <h2>Save words, lines, and scenes to study later</h2>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <input
          aria-label="New notebook name"
          placeholder="New notebook (e.g. Attack on Titan S1)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button className="btn btn-accent" type="button" onClick={create} disabled={busy || !name.trim()}>
          Create
        </button>
      </div>

      {error && <p className="sync-message">{error}</p>}

      {notebooks === null ? (
        <p className="sync-message">Loading…</p>
      ) : notebooks.length === 0 ? (
        <p className="sync-message">
          No notebooks yet. Create one above, then save words and lines into it while you learn.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {notebooks.map((nb) => (
            <li key={nb.id}>
              <Link
                href={`/app/notebooks/${nb.id}`}
                prefetch={false}
                style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "8px", textDecoration: "none" }}
              >
                <span>{nb.name}</span>
                <span className="eyebrow">{nb.entryCount} {nb.entryCount === 1 ? "entry" : "entries"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
