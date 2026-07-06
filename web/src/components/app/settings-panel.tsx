"use client";

import { useCallback, useEffect, useState } from "react";
import { useCloudSnapshot, persistCloudEnvelope, useCloudSyncMeta } from "@/lib/cloud-snapshot-store";
import {
  EXTENSION_SETTINGS_DEFAULTS,
  parseExtensionSettings,
  settingsToRecord,
  type DisplayScript,
  type ExtensionSettings,
  type PauseMode,
} from "@/lib/extension-settings";
import type { CloudSyncEnvelope } from "@/lib/sync";

function notifyExtensionSync(): void {
  try {
    window.postMessage({ source: "avc-web", type: "avc-sync-now" }, window.location.origin);
  } catch {
    /* ignore */
  }
}

export function SettingsPanel() {
  const snapshot = useCloudSnapshot();
  const meta = useCloudSyncMeta();
  const [settings, setSettings] = useState<ExtensionSettings>(EXTENSION_SETTINGS_DEFAULTS);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSettings(parseExtensionSettings(snapshot.settings));
  }, [snapshot.settings]);

  const patch = useCallback((partial: Partial<ExtensionSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const nextSnapshot = {
        ...snapshot,
        settings: settingsToRecord(settings),
      };
      const res = await fetch("/api/sync/snapshot", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot: nextSnapshot, expectedRevision: meta.revision }),
      });
      const data = (await res.json()) as { envelope?: CloudSyncEnvelope; error?: string };
      if (res.status === 409) {
        setMessage("Your backup changed on another device. Reload the page and try again.");
        return;
      }
      if (!res.ok || !data.envelope) throw new Error(data.error || `Save failed (${res.status}).`);
      persistCloudEnvelope(data.envelope);
      setMessage("Saved — your extension will pick this up on the next sync.");
      notifyExtensionSync();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="av-card p-6 sm:p-8" aria-label="Extension settings">
      <p className="av-eyebrow">Extension</p>
      <h2 className="mt-2 font-jpround text-[clamp(22px,3vw,28px)] font-black leading-tight">Study settings</h2>
      <p className="mt-2 max-w-[52ch] text-sm text-ink2">
        Controls how cards appear while you watch. Synced to your extension when linked.
      </p>

      <div className="mt-8 grid gap-6">
        <fieldset className="grid gap-2 border-0 p-0">
          <legend className="av-eyebrow mb-1">Mode</legend>
          {(
            [
              ["copilot", "Ambient — transparent sidebar, keep watching"],
              ["pause", "Focus — pauses video to study"],
              ["off", "Off"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-start gap-2 text-sm text-ink2">
              <input
                type="radio"
                name="pauseMode"
                value={value}
                checked={settings.pauseMode === value}
                onChange={() => patch({ pauseMode: value as PauseMode })}
                className="mt-0.5 accent-accent"
              />
              {label}
            </label>
          ))}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm text-ink2">
            Cooldown (seconds)
            <input
              className="av-input"
              type="number"
              min={5}
              max={120}
              value={settings.cooldownSec}
              onChange={(e) => patch({ cooldownSec: Number(e.target.value) || 20 })}
            />
          </label>
          <label className="grid gap-1.5 text-sm text-ink2">
            Max cards per hour
            <input
              className="av-input"
              type="number"
              min={1}
              max={60}
              value={settings.maxCardsPerHour}
              onChange={(e) => patch({ maxCardsPerHour: Number(e.target.value) || 12 })}
            />
          </label>
          <label className="grid gap-1.5 text-sm text-ink2">
            Target difficulty
            <select
              className="av-input"
              value={settings.targetLevel}
              onChange={(e) => patch({ targetLevel: Number(e.target.value) })}
            >
              <option value={5}>Very common words</option>
              <option value={4}>Common</option>
              <option value={3}>Mid-frequency</option>
              <option value={2}>Uncommon</option>
              <option value={1}>Rare words</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm text-ink2">
            Auto-advance card (seconds)
            <input
              className="av-input"
              type="number"
              min={0}
              max={120}
              value={settings.autoResumeSec}
              onChange={(e) => patch({ autoResumeSec: Number(e.target.value) || 0 })}
            />
          </label>
        </div>

        <label className="grid gap-1.5 text-sm text-ink2">
          Word cards show
          <select
            className="av-input"
            value={settings.displayScript}
            onChange={(e) => patch({ displayScript: e.target.value as DisplayScript })}
          >
            <option value="romaji">Romaji first</option>
            <option value="kana">Kana first</option>
            <option value="kanji">Kanji first</option>
          </select>
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink2">
          <input
            type="checkbox"
            checked={settings.autoSpeak}
            onChange={(e) => patch({ autoSpeak: e.target.checked })}
            className="accent-accent"
          />
          Speak the word aloud when a card opens
        </label>

        <fieldset className="grid gap-2 border-0 p-0">
          <legend className="av-eyebrow mb-1">Sites enabled</legend>
          {(
            [
              ["youtube", "YouTube"],
              ["netflix", "Netflix"],
              ["generic", "Generic HTML5 tracks"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-ink2">
              <input
                type="checkbox"
                checked={settings.sites[key]}
                onChange={(e) =>
                  patch({ sites: { ...settings.sites, [key]: e.target.checked } })
                }
                className="accent-accent"
              />
              {label}
            </label>
          ))}
        </fieldset>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button className="av-btn av-btn-primary" type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
        {message && <p className="text-sm text-ink2">{message}</p>}
      </div>
    </section>
  );
}
