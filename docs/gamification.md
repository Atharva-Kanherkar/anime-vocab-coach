# Streaks, challenges & leaderboards — what counts

AnimeVocab's social loop rewards **real learning practice**, not vanity metrics. Everything below is computed **server-side from your synced progress**, so leaderboard scores can't be forged by a client.

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

## Anti-cheat (v1)

- Scores are server-computed from the synced snapshot — no score-submission endpoint exists.
- Weekly totals are clamped to plausible ceilings (≤ 5,000 reviews, ≤ 10,080 minutes) before ranking.
- Future: per-account rate limits and shard/pagination for large boards.
