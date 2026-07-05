# Streaks, challenges & leaderboards — what counts

AnimeVocab's social loop rewards **real learning practice**, not vanity metrics. There is **no score-submission endpoint** — every metric below is computed **server-side from your synced learning history**, then clamped to plausible ceilings. Scores can't be injected directly; they're derived from your own synced stats.

## What counts

| Signal | Counts toward |
|--------|---------------|
| **Words reviewed** (SRS review answered) | Weekly leaderboard, "Weekly reviewer" challenge, streak |
| **Minutes watched** (Japanese audio) | Weekly leaderboard, "Two hours of immersion" challenge, streak |
| **Cards judged** (know/learn/ignore) | Streak (counts as an active day) |

## What does NOT count

- **New words merely *met*** (seen but not acted on) — passive exposure isn't practice, so it doesn't extend a streak or rank you.
- **Watched titles / what anime you watch** — never shared or shown to anyone.
- **Client-submitted scores** — there is no endpoint to post a score. Metrics are derived from your validated snapshot on sync.

## Streaks

- **Active day** = you reviewed, judged, or watched that day.
- **Current streak** = consecutive active days ending today *or* yesterday (a day isn't "missed" until it fully passes).
- **Longest streak** = your best historical run.

## Challenges (weekly)

- **Weekly reviewer** — review 50 words this week.
- **Two hours of immersion** — watch 120 minutes this week.

Anime-specific arc challenges ("learn 20 words from one arc") build on the same shape once per-title stats sync.

## Leaderboard

- **Weekly** (Monday–Sunday, UTC), ranked by words reviewed (ties: minutes, then streak).
- Updates when you sync. Shows the top entries plus your own rank.

## Privacy (all opt-in / opt-out)

- **Anonymous by default** — with no display name set, you appear as `Learner-####` (derived from your account id; no personal info).
- **Display name** — optional, up to 24 characters.
- **Opt out / local-only** — leave the leaderboard entirely; your entry is removed on the next sync and nothing about you is shown.

## Timezone note

Day and week boundaries are evaluated in **UTC**. Your daily rows use your local
date, and the streak logic accepts a day that reads up to one UTC day ahead (so
JST and other ahead-of-UTC learners aren't undercounted).

## Anti-cheat (v1)

- **No score-submission endpoint** — metrics are computed server-side from your synced history, so scores can't be injected directly. They are still derived from self-reported stats, so:
- Weekly totals are **clamped** (≤ 5,000 reviews, ≤ 10,080 minutes) and streaks are capped (≤ 366 days); far-future daily rows are ignored so a fabricated history can't anchor a streak.
- Future: per-account rate limits, anomaly detection, and shard/pagination for large boards.
