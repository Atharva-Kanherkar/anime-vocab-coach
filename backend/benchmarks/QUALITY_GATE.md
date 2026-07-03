# AnimeVocab transcription quality gate

Before switching the production default away from OpenAI, run the benchmark and confirm
the **vocab-word bar** — not just raw CER — passes on every candidate provider.

## Current production default

**`TRANSCRIBE_PROVIDERS=openai`** — all cache-miss transcription uses your OpenAI account
(credits or billing). Groq and DeepInfra are **optional** and require their own paid API keys;
they are not used unless you add keys **and** change the provider chain in `wrangler.toml`.

When your OpenAI credits run low, run this gate, then switch to
`TRANSCRIBE_PROVIDERS=groq,deepinfra,openai` (OpenAI remains the automatic fallback).

## Episodes (5 conditions)

| # | Condition | Suggested clip | Ground truth |
|---|-----------|----------------|--------------|
| 1 | Quiet dialogue | Any slice of a slice-of-life scene (~60s) | JP subtitle track |
| 2 | Action / BGM-heavy | Shonen fight scene (~60s) | JP subtitle track |
| 3 | Archaic speech | Period piece (~60s) | JP subtitle track |
| 4 | Fast comedy banter | Comedy exchange (~60s) | JP subtitle track |
| 5 | Mixed | Episode with known-good JP subs | JP subtitle track (full reference) |

Extract **60-second WAV clips** (16 kHz or 24 kHz mono) into `backend/benchmarks/clips/`.
Name them `01-quiet.wav`, `02-action.wav`, etc.

## Run benchmark

```bash
# OpenAI only (enough to validate your current setup):
export OPENAI_API_KEY=...
node scripts/benchmark-transcribe.mjs --clips backend/benchmarks/clips --language ja --providers openai

# Compare candidates before switching (requires paid Groq/DeepInfra keys):
export GROQ_API_KEY=...
export DEEPINFRA_API_KEY=...
node scripts/benchmark-transcribe.mjs --clips backend/benchmarks/clips --language ja
```

Output: `backend/benchmarks/results.json` with per-provider transcripts and timing.

## Pass criteria

1. **Vocab-word bar (primary):** For each clip, manually check the Japanese content words
   the extension would surface (nouns/verbs in JLPT N5–N1 range). Candidate must match
   OpenAI on ≥ 95% of checked words (allowing trivial particle differences).
2. **CER (secondary):** Where JP subtitle ground truth exists, candidate CER must be
   within +2% absolute of OpenAI.
3. **Fallback:** Set `TRANSCRIBE_PROVIDERS=groq,openai` in staging with an invalid
   `GROQ_API_KEY`; confirm requests still succeed via OpenAI.

## Results log

| Clip | OpenAI words OK | Groq words OK | DeepInfra words OK | Notes |
|------|-----------------|---------------|--------------------|-------|
| 01-quiet | — | — | — | Run benchmark to fill |
| 02-action | — | — | — | |
| 03-archaic | — | — | — | |
| 04-banter | — | — | — | |
| 05-mixed | — | — | — | |

**Decision:** Keep `TRANSCRIBE_PROVIDERS=openai` while OpenAI credits cover usage.
Switch to `groq,deepinfra,openai` only after the vocab-word bar passes and you accept
pay-as-you-go cost on Groq/DeepInfra.
