"use client";

// Pro inside /app (#162). Before this the only way in was the Billing tab,
// eleventh in the nav, and every other upgrade prompt fired at a limit nobody
// reaches. So: one quiet header entry that is always there for free learners,
// and one moment that shows up when they have just earned something.
//
// Both are dismissible or ignorable, neither blocks anything, and nothing on
// the free plan changes (#146).

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCloudSnapshot, useCloudSyncMeta } from "@/lib/cloud-snapshot-store";
import { snapshotLevel } from "@/lib/learning-events";
import { SEEN_LEVEL_KEY, newlyUnlocked, parseSeenLevel } from "@/lib/pro-moment";
import { rememberProSurface, trackPro, trackProShownOnce, type ProSurface } from "@/lib/pro-funnel";
import { RARITY_LABEL, type CardDef } from "@/lib/cards";
import { TIERS } from "@/lib/site";

/** The one sentence Pro is sold on (#146), with what it adds today. */
export const PRO_PITCH = `Pro helps you understand and remember the anime you watch: ${
  TIERS.pro.listeningMinutes / 60
} hours of Listening Mode and ${TIERS.pro.aiCallsPerMonth.toLocaleString("en-US")} coach messages a month, for ${
  TIERS.pro.priceLabel
}.`;
export const OWNERSHIP_LINE = "Your words and cards stay yours either way.";

/** Record the click, remember who started the journey, open Billing. */
function openPro(surface: ProSurface, onOpenBilling: () => void): void {
  trackPro("pro_prompt_clicked", surface);
  rememberProSurface(surface);
  onOpenBilling();
}

export function ProHeaderEntry({ onOpenBilling }: { onOpenBilling: () => void }) {
  useEffect(() => {
    trackProShownOnce("app_header");
  }, []);

  return (
    <button
      type="button"
      data-testid="pro-header-entry"
      onClick={() => openPro("app_header", onOpenBilling)}
      className="whitespace-nowrap border-2 border-accent px-3 py-1.5 text-[13px] font-extrabold text-accent transition hover:bg-accent hover:text-bg"
    >
      Go Pro
    </button>
  );
}

function readSeen(): number | null {
  try {
    return parseSeenLevel(window.localStorage.getItem(SEEN_LEVEL_KEY));
  } catch {
    return null;
  }
}

function writeSeen(level: number): void {
  try {
    window.localStorage.setItem(SEEN_LEVEL_KEY, String(level));
  } catch {
    // Storage off: the moment may repeat. Never worth breaking /app over.
  }
}

/**
 * A card unlocked since this browser last looked: say so, then offer Pro.
 *
 * Only judged once the server snapshot has actually arrived. Before that the
 * store holds whatever this browser cached (or nothing), and an empty snapshot
 * reads as level 1, which would make the real one look like a fresh unlock.
 */
export function UnlockMoment({ onOpenBilling }: { onOpenBilling: () => void }) {
  const snapshot = useCloudSnapshot();
  const meta = useCloudSyncMeta();
  const [card, setCard] = useState<CardDef | null>(null);

  useEffect(() => {
    if (!meta.fetchedAt || meta.loading || meta.error) return;
    // Nothing synced yet. Linking an extension with months of progress later
    // is an import, and must not be greeted as an unlock.
    if (snapshot.words.length === 0 && snapshot.daily.length === 0) return;
    const { store, card: unlocked } = newlyUnlocked(readSeen(), snapshotLevel(snapshot, new Date()));
    writeSeen(store);
    if (unlocked) {
      // Syncing a snapshot into React state is the point of this effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCard(unlocked);
      trackPro("pro_prompt_shown", "app_unlock");
    }
  }, [snapshot, meta.fetchedAt, meta.loading, meta.error]);

  if (!card) return null;

  return (
    <aside
      data-testid="unlock-moment"
      aria-label="New card unlocked"
      className="mt-6 flex flex-wrap items-start gap-x-6 gap-y-4 border-2 border-ink bg-panel px-5 py-4"
    >
      <div className="min-w-[220px] flex-1">
        <p className="av-eyebrow">New card unlocked · {RARITY_LABEL[card.rarity]}</p>
        <p className="mt-1 font-jpround text-xl font-black leading-tight">
          {card.name} joined your collection
        </p>
        <p className="mt-1 text-sm text-ink2">
          {card.epithet}. You earned it by watching and keeping words.
        </p>
        <p className="mt-3 max-w-[60ch] text-sm text-ink2">
          {PRO_PITCH} {OWNERSHIP_LINE}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/app/cards/${card.id}`} className="av-btn av-btn-ghost av-btn-sm">
          See {card.name}
        </Link>
        <button
          type="button"
          className="av-btn av-btn-primary av-btn-sm"
          onClick={() => {
            setCard(null);
            openPro("app_unlock", onOpenBilling);
          }}
        >
          See Pro
        </button>
        <button type="button" className="av-btn av-btn-quiet av-btn-sm" onClick={() => setCard(null)}>
          Not now
        </button>
      </div>
    </aside>
  );
}
