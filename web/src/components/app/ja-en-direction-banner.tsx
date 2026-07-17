"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { directionLabel, type LearningDirection } from "@/lib/direction";
import { JA_EN_PROMPT_DISMISSED_KEY } from "@/lib/locale-direction";
import { useSiteLocale } from "@/components/locale-provider";
import {
  EXTENSION_SETTINGS_DEFAULTS,
  parseExtensionSettings,
  settingsToRecord,
  type ExtensionSettings,
} from "@/lib/extension-settings";
import { useCloudSnapshot, persistCloudEnvelope, useCloudSyncMeta } from "@/lib/cloud-snapshot-store";
import type { CloudSyncEnvelope } from "@/lib/sync";

function notifyExtensionSync(): void {
  try {
    window.postMessage({ source: "avc-web", type: "avc-sync-now" }, window.location.origin);
  } catch {
    /* ignore */
  }
}

export function JaEnDirectionBanner() {
  const { locale } = useSiteLocale();
  const snapshot = useCloudSnapshot();
  const meta = useCloudSyncMeta();
  const [dismissed, setDismissed] = useState(true);
  const [settings, setSettings] = useState<ExtensionSettings>(EXTENSION_SETTINGS_DEFAULTS);

  useEffect(() => {
    setDismissed(localStorage.getItem(JA_EN_PROMPT_DISMISSED_KEY) === "1");
    setSettings(parseExtensionSettings(snapshot.settings, locale));
  }, [snapshot.settings, locale]);

  const applyDirection = useCallback(
    async (direction: LearningDirection) => {
      const nextSettings = { ...settings, learningDirection: direction };
      setSettings(nextSettings);
      try {
        const nextSnapshot = {
          ...snapshot,
          settings: settingsToRecord(nextSettings),
        };
        const res = await fetch("/api/sync/snapshot", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ snapshot: nextSnapshot, expectedRevision: meta.revision }),
        });
        const data = (await res.json()) as { envelope?: CloudSyncEnvelope };
        if (res.ok && data.envelope) {
          persistCloudEnvelope(data.envelope);
          notifyExtensionSync();
        }
      } catch {
        /* soft fail */
      }
    },
    [meta.revision, settings, snapshot]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("direction");
    if (q === "ja-en" || q === "en-ja") {
      void applyDirection(q);
    }
  }, [applyDirection]);

  if (locale !== "ja" || dismissed || settings.learningDirection === "ja-en") return null;

  return (
    <div className="av-ja-en-banner" role="status">
      <p>
        <strong>日本語 → English で学べます。</strong> アニメの英語から単語を覚え、解説は日本語です。
      </p>
      <div className="av-ja-en-banner__actions">
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => {
            void applyDirection("ja-en");
            localStorage.setItem(JA_EN_PROMPT_DISMISSED_KEY, "1");
            setDismissed(true);
          }}
        >
          {directionLabel("ja-en")} に切り替え
        </button>
        <Link className="av-btn av-btn-ghost" href="#settings">
          設定を開く
        </Link>
        <button
          type="button"
          className="av-btn av-btn-ghost"
          onClick={() => {
            localStorage.setItem(JA_EN_PROMPT_DISMISSED_KEY, "1");
            setDismissed(true);
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
