"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Summary {
  id: string;
  name: string;
  entryCount: number;
  updatedAt: string;
}

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
          <h2>Save words and scenes to study later</h2>
          <p className="panel-lede">Group vocabulary by show, arc, or whatever helps you review.</p>
        </div>
      </div>

      <div className="notebook-create">
        <input
          className="app-input"
          aria-label="New notebook name"
          placeholder="e.g. Attack on Titan S1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <button className="btn btn-accent" type="button" onClick={create} disabled={busy || !name.trim()}>
          Create
        </button>
      </div>

      {error && <p className="sync-message">{error}</p>}

      {notebooks === null ? (
        <p className="sync-message">Loading…</p>
      ) : notebooks.length === 0 ? (
        <p className="sync-message">No notebooks yet. Create one above to start collecting entries.</p>
      ) : (
        <ul className="notebook-list">
          {notebooks.map((nb) => (
            <li key={nb.id}>
              <Link className="notebook-list__link" href={`/app/notebooks/${nb.id}`} prefetch={false}>
                <span>{nb.name}</span>
                <span className="eyebrow">
                  {nb.entryCount} {nb.entryCount === 1 ? "entry" : "entries"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
