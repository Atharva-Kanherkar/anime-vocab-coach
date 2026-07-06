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
    <section className="av-card p-6 sm:p-8" aria-label="Notebooks">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Notebooks</p>
        <h2 className="mt-1.5 font-serif text-2xl font-medium">Save words and scenes to study later</h2>
        <p className="mt-1.5 max-w-[54ch] text-sm text-ink2">
          Group vocabulary by show, arc, or whatever helps you review.
        </p>
      </div>

      <div className="flex gap-2.5">
        <input
          className="av-input"
          aria-label="New notebook name"
          placeholder="e.g. Attack on Titan S1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <button className="av-btn av-btn-primary" type="button" onClick={create} disabled={busy || !name.trim()}>
          Create
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-ink2">{error}</p>}

      {notebooks === null ? (
        <p className="mt-4 text-sm text-ink2">Loading…</p>
      ) : notebooks.length === 0 ? (
        <p className="mt-4 text-sm text-ink2">No notebooks yet. Create one above to start collecting entries.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {notebooks.map((nb) => (
            <li key={nb.id}>
              <Link
                href={`/app/notebooks/${nb.id}`}
                prefetch={false}
                className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3 transition hover:border-accent hover:bg-surface-2"
              >
                <span className="font-medium">{nb.name}</span>
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-ink3">
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
