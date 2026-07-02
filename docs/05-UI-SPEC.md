# 05 — UI Spec (exact DOM, styles, copy)

Design language everywhere: dark card `#1c1c24`, text `#f2f2f7`, accent `#8b7cf6` (violet), success `#4ade80`, muted `#9ca3af`, danger `#f87171`. Font stack: `"Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif` for Japanese, system-ui for English. Border-radius 14px on cards, 8px on buttons. No external fonts, no images, no icon libraries — text and unicode only.

## 1. Overlay mounting (shared by card + toast)

`overlay.js` creates ONE host element lazily:

```js
// VERBATIM
function mountHost() {
  let host = document.getElementById("avc-overlay-host");
  const parent = document.fullscreenElement || document.body;
  if (!host) {
    host = document.createElement("div");
    host.id = "avc-overlay-host";
    host.style.cssText = "all:initial; position:fixed; inset:0; z-index:2147483647; pointer-events:none;";
    host.attachShadow({ mode: "open" });
  }
  if (host.parentElement !== parent) parent.appendChild(host); // re-parent on fullscreen change
  return host.shadowRoot;
}
```

All UI renders inside the shadow root; a `<style>` element with the full stylesheet is (re)inserted on first render. Interactive children set `pointer-events: auto` on themselves. Listen for `document.addEventListener("fullscreenchange", ...)` → re-run `mountHost()` if the card is open.

## 2. The word card

### 2.1 Structure

```html
<div class="avc-scrim">                <!-- covers viewport, rgba(0,0,0,.35), click = dismiss -->
  <div class="avc-card" role="dialog"> <!-- centered, min(420px, 90vw), pointer-events:auto -->
    <div class="avc-chip">N4-ish · #1,240</div>   <!-- level + frequency rank -->
    <div class="avc-word">退屈</div>              <!-- font-size 44px, bold -->
    <div class="avc-reading">たいくつ</div>        <!-- 20px, accent color -->
    <div class="avc-gloss">tedium · boredom</div>  <!-- glosses joined by " · ", 17px -->
    <div class="avc-sentence">こんな<mark>退屈</mark>な毎日はもう嫌だ</div>
      <!-- the subtitle line; <mark> wraps every occurrence of token.surface;
           mark style: background transparent, accent color, bold, no quotes around line -->
    <div class="avc-buttons">
      <button class="avc-know">知ってる<span>I know it</span></button>
      <button class="avc-learn">学ぶ<span>Learn it</span></button>
      <button class="avc-ignore">無視<span>Ignore</span></button>
    </div>
    <div class="avc-hint">Esc to close · 1 / 2 / 3 keys work too</div>
  </div>
</div>
```

Buttons: Japanese label on top (16px), English sublabel below (11px, muted). `know` = success-tinted, `learn` = accent-filled (primary), `ignore` = ghost/outline. Keyboard: `1`→know, `2`→learn, `3`→ignore, `Escape`→dismiss. Keydown listener attached on show, removed on hide, `stopPropagation` so the site doesn't react.

### 2.2 Behavior contract

`showCard(target, sentence, video) -> Promise<"know"|"learn"|"ignore"|"dismiss">` — resolves exactly once; hides itself; never rejects. The card must appear within 50 ms of the pause so it feels causal. Card entrance: 150 ms opacity+scale(0.96→1) transition; no other animation.

### 2.3 Review (quiz) variant

Same card, but: chip reads `復習 · Review`, `.avc-reading`, `.avc-gloss` are replaced by a single **Show answer** button until clicked; buttons row is `覚えてた Got it` (success-filled) / `忘れた Forgot` (danger-outline); keys `1`/`2`. Resolves `"review-pass"` | `"review-fail"` | `"dismiss"` (dismiss = no SRS change).

## 3. The toast (notify mode)

Bottom-left, 12px from edges: dark pill, word + reading + first gloss on one line (`退屈 たいくつ — boredom`), fades in/out, auto-hides after 5 s. Clicking it: pause video + open the full card for the same target. Max one toast at a time; a new toast replaces the old.

## 4. Popup (`popup/`) — 320px wide

Top to bottom:
1. Header: `アニメ Vocab Coach` (14px bold) + mode pill on the right showing current `pauseMode`; clicking the pill cycles pause → notify → off (writes settings immediately).
2. **Today row** — 4 stat tiles in a grid (number 20px bold, label 10px muted): `Met` (met), `Judged` (judged), `Reviews` (reviews), `Min watched` (watchMin).
3. **Totals row** — one line: `● 42 known   ● 17 learning   ● 128 seen` (colored dots: success/accent/muted). "seen" = vocab records with state "new".
4. **Streak**: `🔥 5-day streak` (computed: consecutive calendar days ending today-or-yesterday with `judged >= 1`).
5. **Recent words** — last 10 vocab records by `lastSeenAt` desc: each row = word, reading (muted), state as a small `<select>` with the 4 states; changing it writes storage immediately.
6. Footer links: `Settings` (opens options page via `chrome.runtime.openOptionsPage()`) · `Export` (same JSON export as options).

Data loads once on popup open (`DOMContentLoaded`); no live refresh needed.

## 5. Options page (`options/`) — max-width 720px, centered

1. **Settings form**: mode (radio ×3), cooldown seconds (number 5–120), max cards/hour (number 1–60), target level (select N5..N1 → values 5..1), auto-resume seconds (number, 0 = off), site toggles (3 checkboxes). Every control saves on `change` (no Save button) and shows a transient `Saved ✓`.
2. **Word list**: search box (matches word/reading/gloss substring) + state filter chips (All/Known/Learning/New/Ignored) + table: Word · Reading · Meaning · Level · Seen · State(select) · SRS due (relative, e.g. "in 3d", or "—"). Client-side only; render max 200 rows with a "showing X of Y" note.
3. **Export**: button → `Blob` download `anime-vocab-coach-export-YYYY-MM-DD.json` containing `{settings, vocab, stats, exportedAt}`.
4. **Danger zone**: "Reset all progress" → `confirm()` → clears `vocab` and `stats` (keeps settings).
