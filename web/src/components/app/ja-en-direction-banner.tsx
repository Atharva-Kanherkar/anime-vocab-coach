"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { directionLabel, type LearningDirection } from "@/lib/direction";
import {
  DIRECTION_QUERY_KEY,
  JA_EN_PROMPT_DISMISSED_KEY,
  parseDirectionQuery,
} from "@/lib/locale-direction";
import { useSiteLocale } from "@/components/locale-provider";
import {
  EXTENSION_SETTINGS_DEFAULTS,
  parseExtensionSettings,
  type ExtensionSettings,
} from "@/lib/extension-settings";
import { useCloudSnapshot, useCloudSyncMeta } from "@/lib/cloud-snapshot-store";
import { saveLearningSettings } from "@/lib/learn-client";

export function JaEnDirectionBanner() {
  const { locale } = useSiteLocale();
  const snapshot = useCloudSnapshot();
  const storedSettings = JSON.stringify(snapshot.settings);
  const meta = useCloudSyncMeta();
  const [dismissed, setDismissed] = useState(true);
  const [settings, setSettings] = useState<ExtensionSettings>(EXTENSION_SETTINGS_DEFAULTS);

  useEffect(() => {
    // localStorage/cloud snapshot are client-only sources; adopting them after
    // mount (SSR renders the dismissed state) is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(localStorage.getItem(JA_EN_PROMPT_DISMISSED_KEY) === "1");
    setSettings(parseExtensionSettings(JSON.parse(storedSettings), locale));
  }, [storedSettings, locale]);

  const applyDirection = useCallback(
    async (direction: LearningDirection) => {
      const nextSettings = { ...settings, learningDirection: direction };
      setSettings(nextSettings);
      try {
        await saveLearningSettings({learningDirection:direction});
      } catch {
        /* soft fail */
      }
    },
    [settings]
  );

  // ?direction= deep link: apply exactly once, only after the initial cloud
  // fetch has settled (never PUT an empty pre-fetch snapshot over real data),
  // and strip the param so re-renders can't re-trigger the write. Without the
  // ref guard this loops forever: each PUT publishes a new snapshot/revision,
  // which recreates applyDirection and re-runs the effect.
  const appliedQueryDirection = useRef(false);
  useEffect(() => {
    if (meta.fetchedAt === null || appliedQueryDirection.current) return;
    appliedQueryDirection.current = true;

    const params = new URLSearchParams(window.location.search);
    const q = parseDirectionQuery(params.get(DIRECTION_QUERY_KEY));
    if (!q) return;

    params.delete(DIRECTION_QUERY_KEY);
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash
    );

    const current = parseExtensionSettings(snapshot.settings, locale).learningDirection;
    // Applying a URL-provided direction is a one-shot post-mount action tied
    // to client-only state (query string + cloud snapshot); intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (current !== q) void applyDirection(q);
  }, [meta.fetchedAt, applyDirection, snapshot.settings, locale]);

  if (locale !== "ja" || dismissed || meta.fetchedAt === null || settings.learningDirection === "ja-en")
    return null;

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
