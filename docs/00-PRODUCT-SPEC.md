# 00 — Product Spec

## One-line

Watch anime → the extension notices vocabulary you should learn → it pauses and teaches → it remembers what you know and quizzes you *inside future episodes*.

## Personas & assumption

The user is a Japanese learner roughly between JLPT N5 and N2 who watches anime/J-drama **with Japanese subtitles enabled** (or auto-generated Japanese CC on YouTube). The extension reads subtitles as text; it does **not** do OCR or speech recognition in v1.

## Core loop (Pause mode — the default)

1. User plays a video on a supported site with Japanese subtitles showing.
2. Each time a new subtitle line renders, the extension tokenizes it.
3. It picks **at most one** "target word" from the line using the scoring rules in `docs/02-DATA-MODEL.md` §5.
4. If a target word is found AND the cooldown has elapsed (default **20 s** since the last card) AND the per-session cap isn't hit (default **12 cards per hour**), then:
   - the video is paused,
   - the **word card** overlay appears (see `docs/05-UI-SPEC.md` §2) showing: the word, its reading in hiragana, its English meanings, its level tag (e.g. "N4-ish"), and the full subtitle sentence with the word highlighted.
5. User clicks one of:
   - **知ってる — I know it** → word state becomes `known`. It will never trigger a card again. Counts toward "known words" stat.
   - **学ぶ — Learn it** → word state becomes `learning` at SRS stage 1. It will be re-surfaced in context when due (see §"In-context SRS" below).
   - **無視 — Ignore** → state `ignored`, never shown again (for names, particles-misparses, words the user doesn't care about).
   - **✕ / Esc / clicking outside the card** → dismiss without judging; word stays `new` and can trigger again another day (not in the same session).
6. On any of the above, the card disappears and the video resumes **automatically** (only if the extension was the one that paused it).

## Notify mode (non-blocking)

Settings toggle. Same detection, but instead of pausing, a small toast (word + reading + gloss, no buttons) appears bottom-left over the video for 5 s. Clicking the toast pauses and opens the full card. Default: off.

## In-context SRS (the differentiator)

When a `learning` word appears in a subtitle line **and** its SRS due date has passed, it takes absolute priority over any new-word candidate in that line. The card shows in **quiz form**: the word and the sentence, with reading and meaning hidden behind a "Show answer" button. After reveal, user answers **覚えてた — Got it** (advance SRS stage) or **忘れた — Forgot** (reset to stage 1). Stage intervals and the "known" graduation rule are exact in `docs/02-DATA-MODEL.md` §6.

## Progress tracking

The popup (toolbar icon) shows, without any navigation:
- Today: new words met, words judged, reviews done, minutes watched.
- Totals: known / learning / seen counts.
- Current daily streak (a day counts if ≥ 1 card was answered).
- The last 10 words judged, each with a state-toggle.

Options page adds: settings (mode, cooldown, hourly cap, level targeting, per-site enable), full word list with search/filter, JSON export, and a danger-zone reset.

## Explicit non-goals for v1 (do not build)

- OCR of hardcoded subtitles; audio/speech recognition.
- Crunchyroll support (canvas-rendered subtitles — see `docs/06-PITFALLS.md` §9).
- Anki sync (JSON export only), accounts/cloud sync, mobile, non-Japanese languages.
- Furigana overlay on the subtitles themselves.
- Grammar explanations. Words only.

## Defaults summary (single source of truth)

| Setting | Key | Default |
|---|---|---|
| Mode | `settings.pauseMode` | `"pause"` (`"notify"`, `"off"`) |
| Cooldown between cards | `settings.cooldownSec` | `20` |
| Max cards per rolling hour | `settings.maxCardsPerHour` | `12` |
| Target level | `settings.targetLevel` | `5` (N5 — scratch beginner; range 5..1) |
| Auto-resume after card with no interaction | `settings.autoResumeSec` | `0` (disabled) |
| Sites enabled | `settings.sites` | `{youtube: true, netflix: true, generic: true}` |
| Card script (v2) | `settings.displayScript` | `"romaji"` (`"kana"`, `"kanji"`) |
| Speak word on card open (v2) | `settings.autoSpeak` | `true` |
| OpenAI API key for Listening Mode (v2) | `settings.openaiKey` | `""` |
| Transcription model (v2) | `settings.transcribeModel` | `"gpt-4o-mini-transcribe"` |

> **v2 note:** the "user has Japanese subtitles enabled" assumption above is v1-only.
> v2 removes it — see `docs/08-LISTENING-MODE.md`.
