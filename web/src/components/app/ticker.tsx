"use client";

import { useMemo } from "react";
import { useCloudSnapshot } from "@/components/cloud-sync-panel";
import { pickRecentWords } from "@/lib/sync";

// Broadcast-style chyron of the user's recent words. Falls back to a sample
// reel for brand flavor before any words are synced.
const SAMPLE = [
  { base: "約束", reading: "やくそく", gloss: "a promise" },
  { base: "仲間", reading: "なかま", gloss: "comrade" },
  { base: "諦める", reading: "あきらめる", gloss: "to give up" },
  { base: "未来", reading: "みらい", gloss: "future" },
  { base: "戦う", reading: "たたかう", gloss: "to fight" },
];

export function WordTicker() {
  const snapshot = useCloudSnapshot();
  const recent = useMemo(() => pickRecentWords(snapshot, 10), [snapshot]);

  const items = (recent.length >= 3 ? recent : SAMPLE).map((w) => {
    const bits = [w.base, w.reading, w.gloss ? w.gloss.toUpperCase() : ""].filter(Boolean);
    return bits.join("　");
  });
  // Repeat so the marquee stays dense even with few words.
  const reel = [...items, ...items, ...items].join("　／　");

  return (
    <div className="av-ticker" aria-hidden>
      <span>{reel}</span>
    </div>
  );
}
