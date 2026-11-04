"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCloudSnapshot, useCloudSyncMeta } from "@/lib/cloud-snapshot-store";
import {
  EXTENSION_SETTINGS_DEFAULTS,
  parseExtensionSettings,
  type DisplayScript,
  type ExtensionSettings,
  type PauseMode,
} from "@/lib/extension-settings";
import { directionLabel, type LearningDirection } from "@/lib/direction";
import { useSiteLocale } from "@/components/locale-provider";
import { useExtensionLink } from "@/lib/use-extension-link";
import { saveLearningSettings } from "@/lib/learn-client";

export function SettingsPanel() {
  const { locale } = useSiteLocale();
  const { installed: extensionInstalled } = useExtensionLink();
  const [deviceKey, setDeviceKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const dirty = useRef<Partial<ExtensionSettings>>({});
  const meta = useCloudSyncMeta();
  const snapshot = useCloudSnapshot();
  const storedSettings = JSON.stringify(snapshot.settings);
  const [settings, setSettings] = useState<ExtensionSettings>(
    EXTENSION_SETTINGS_DEFAULTS,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Re-seed the local draft whenever the cloud snapshot changes; the form is
    // intentionally an editable copy, so this sync setState is deliberate.
    setSettings({
      ...parseExtensionSettings(JSON.parse(storedSettings), locale),
      ...dirty.current,
    });
  }, [storedSettings, locale]);

  const patch = useCallback((partial: Partial<ExtensionSettings>) => {
    Object.assign(dirty.current, partial);
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveLearningSettings({ ...dirty.current });
      dirty.current = {};
      setMessage("Saved. Your extension applies this within one sync.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Couldn't save settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveDeviceKey = async () => {
    setSavingKey(true);
    try {
      await new Promise<void>((resolve, reject) => {
        const requestId = crypto.randomUUID();
        const finish = (ok: boolean) => {
          window.removeEventListener("message", onReply);
          window.clearTimeout(timer);
          if (ok) resolve();
          else
            reject(
              new Error(
                "Could not save the device key. Open this page with the extension installed.",
              ),
            );
        };
        const onReply = (event: MessageEvent) => {
          if (
            event.source === window &&
            event.origin === window.location.origin &&
            event.data?.source === "avc-ext" &&
            event.data.type === "avc-device-key-saved" &&
            event.data.requestId === requestId
          )
            finish(event.data.ok === true);
        };
        const timer = window.setTimeout(() => finish(false), 8000);
        window.addEventListener("message", onReply);
        window.postMessage(
          {
            source: "avc-web",
            type: "avc-device-key",
            requestId,
            value: deviceKey,
          },
          window.location.origin,
        );
      });
      setDeviceKey("");
      setMessage(
        "Device key updated. It stays in this extension and is excluded from cloud sync and export.",
      );
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not save the device key.",
      );
    } finally {
      setSavingKey(false);
    }
  };

  const deleteData = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/learn/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmation }),
      });
      if (!res.ok)
        throw new Error("Could not delete learning data. Please try again.");
      localStorage.removeItem("animevocab.cloudSyncSnapshot.v1");
      window.postMessage(
        { source: "avc-web", type: "avc-delete-learning-data" },
        window.location.origin,
      );
      window.location.assign("/start");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not delete learning data.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="av-card p-6 sm:p-8" aria-label="Extension settings">
      <p className="av-eyebrow">Extension</p>
      <h2 className="mt-2 font-jpround text-[clamp(22px,3vw,28px)] font-black leading-tight">
        Study settings
      </h2>
      <p className="mt-2 max-w-[52ch] text-sm text-ink2">
        Controls how cards appear while you watch. Synced to your extension when
        linked.
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
            <label
              key={value}
              className="flex cursor-pointer items-start gap-2 text-sm text-ink2"
            >
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
              onChange={(e) =>
                patch({ cooldownSec: Number(e.target.value) || 20 })
              }
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
              onChange={(e) =>
                patch({ maxCardsPerHour: Number(e.target.value) || 12 })
              }
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
              onChange={(e) =>
                patch({ autoResumeSec: Number(e.target.value) || 0 })
              }
            />
          </label>
        </div>

        <label className="grid gap-1.5 text-sm text-ink2">
          Learning direction
          <select
            className="av-input"
            value={settings.learningDirection}
            onChange={(e) =>
              patch({ learningDirection: e.target.value as LearningDirection })
            }
          >
            <option value="en-ja">{directionLabel("en-ja")}</option>
            <option value="ja-en">{directionLabel("ja-en")}</option>
          </select>
        </label>

        <label className="grid gap-1.5 text-sm text-ink2">
          Word cards show
          <select
            className="av-input"
            value={settings.displayScript}
            onChange={(e) =>
              patch({ displayScript: e.target.value as DisplayScript })
            }
            disabled={settings.learningDirection === "ja-en"}
          >
            <option value="romaji">Romaji first</option>
            <option value="romaji-kana">Romaji + kana together</option>
            <option value="kana">Kana first</option>
            <option value="kanji">Kanji first</option>
          </select>
          {settings.learningDirection === "ja-en" && (
            <span className="text-xs text-ink3">
              English cards always show the English word first.
            </span>
          )}
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

        {(
          [
            ["subLens", "Dual subtitles and interactive Subtitle Lens"],
            ["subLensPeek", "Pause while a word lookup is open"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex cursor-pointer items-center gap-2 text-sm text-ink2"
          >
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(e) => patch({ [key]: e.target.checked })}
              className="accent-accent"
            />
            {label}
          </label>
        ))}
        <label className="grid gap-1.5 text-sm text-ink2">
          Transcription model
          <input
            className="av-input"
            maxLength={100}
            value={settings.transcribeModel}
            onChange={(e) => patch({ transcribeModel: e.target.value })}
          />
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
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 text-sm text-ink2"
            >
              <input
                type="checkbox"
                checked={settings.sites[key]}
                onChange={(e) =>
                  patch({
                    sites: { ...settings.sites, [key]: e.target.checked },
                  })
                }
                className="accent-accent"
              />
              {label}
            </label>
          ))}
        </fieldset>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          className="av-btn av-btn-primary"
          type="button"
          onClick={() => void save()}
          disabled={saving || meta.fetchedAt === null}
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {message && <p className="text-sm text-ink2">{message}</p>}
      </div>
      <details className="mt-8 border-t border-line pt-5">
        <summary className="cursor-pointer text-sm font-semibold">
          Personal transcription key for this browser
        </summary>
        <p className="mt-3 text-sm text-ink2">
          Optional. Your own OpenAI key stays in this extension. Leave the field
          empty and save to remove it.
        </p>
        <label className="mt-3 grid gap-2 text-sm text-ink2">
          Device OpenAI API key
          <input
            className="av-input"
            type="password"
            autoComplete="off"
            maxLength={512}
            value={deviceKey}
            onChange={(e) => setDeviceKey(e.target.value)}
          />
        </label>
        <button
          className="av-btn av-btn-ghost mt-3"
          type="button"
          disabled={!extensionInstalled || savingKey}
          onClick={() => void saveDeviceKey()}
        >
          {savingKey ? "Saving…" : "Save device key"}
        </button>
        {!extensionInstalled && (
          <p className="mt-2 text-sm text-ink2">
            Open this page in the browser with AnimeVocab installed to update
            the device key.
          </p>
        )}
      </details>

      <details className="mt-8 border-t border-line pt-5">
        <summary className="cursor-pointer text-sm font-semibold">
          Export or delete learning data
        </summary>
        <p className="mt-3 text-sm text-ink2">
          Export your words, notebooks, settings and review history before
          deleting. Deletion removes them from this account and prevents old
          devices from restoring them.
        </p>
        <a
          className="av-btn av-btn-ghost mt-3"
          href="/api/learn/export"
          download="animevocab-account.json"
        >
          Export account JSON
        </a>
        <label className="mt-5 grid gap-2 text-sm text-ink2">
          Type DELETE to remove your learning data
          <input
            className="av-input"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          className="av-btn av-btn-ghost mt-3"
          type="button"
          disabled={confirmation !== "DELETE" || deleting}
          onClick={() => void deleteData()}
        >
          {deleting ? "Deleting…" : "Delete my learning data"}
        </button>
      </details>
    </section>
  );
}
