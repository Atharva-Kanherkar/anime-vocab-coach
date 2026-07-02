# Publishing / Installing Anime Vocab Coach

There are two ways to get this running. **For your own use, Option A is the right one** —
it's instant, free, and permanent. The Chrome Web Store (Option B) is only worth it if
you want to share a public link with others.

---

## Option A — Load it yourself (recommended, ~2 minutes)

This installs the exact same extension, just without going through Google's store. It
stays installed across restarts. The only difference: Chrome shows a one-time "developer
mode extensions" notice.

1. Download/clone this repo (you already have it at `~/anime-vocab-coach`).
2. Open **`chrome://extensions`** in Chrome (or Brave/Edge/any Chromium browser).
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked**.
5. Select the **`extension/`** folder (the one containing `manifest.json`).
6. Done — the あ icon appears in your toolbar. Pin it.
7. For Netflix/Crunchyroll: click the icon → open **Settings** → paste your OpenAI API
   key. Then on a video, click the icon → **Start Listening Mode**.

To update later: `git pull`, then hit the ↻ refresh button on the extension card.

---

## Option B — Publish to the Chrome Web Store (public link, days of review)

You need to do this yourself — it requires your Google account and a payment. The
upload file is already built for you: **`dist/anime-vocab-coach.zip`**.

### One-time setup
1. Go to the **Chrome Web Store Developer Dashboard**:
   https://chrome.google.com/webstore/devconsole
2. Sign in with the Google account you want to own the listing.
3. Pay the **one-time $5 USD registration fee** (Google's charge, not mine).
4. Complete account verification (name, contact email) if prompted.

### Upload
5. Click **Add new item**.
6. Upload **`dist/anime-vocab-coach.zip`**.
7. Fill in the store listing:
   - **Description:** copy from `README.md` (the intro paragraph).
   - **Category:** Education.
   - **Language:** English.
   - **Icon:** auto-detected from the zip (128px あ icon).
   - **Screenshots (required, 1280×800 or 640×400):** take 1–3 while using it —
     a word card on a YouTube video is the money shot. Chrome won't publish without
     at least one.
   - **Privacy policy URL (required):** point to the raw `PRIVACY.md` in your repo,
     e.g. `https://github.com/Atharva-Kanherkar/anime-vocab-coach/blob/master/PRIVACY.md`
8. **Permissions justification** (reviewers WILL ask — answers ready):
   - `tabCapture` / `offscreen`: "Capture tab audio to transcribe Japanese speech for
     vocabulary learning, only when the user starts Listening Mode."
   - `api.openai.com` host: "Send captured audio to the user's own OpenAI account for
     transcription."
   - youtube/netflix/crunchyroll hosts: "Detect on-screen subtitles and the video player."
9. **Data-use disclosures:** declare that audio is sent to a third party (OpenAI) only
   in Listening Mode; no data is sold; no analytics. This matches `PRIVACY.md`.
10. Submit for review.

### Reality check on review
- Review takes **anywhere from a few hours to a couple of weeks**.
- Extensions that capture tab audio and talk to external APIs get **extra scrutiny**.
  Expect at least one round of permission-justification questions. Answer with the
  lines above and it should pass — the data flow is clean (user's own key, no author
  backend, transcription only while active).
- If rejected, the dashboard tells you exactly why; fix and resubmit.

### To ship updates later
Bump `version` in `manifest.json`, rebuild the zip (`npm run pack` — see below),
upload it as a new package on the same item, resubmit.

---

## Rebuilding the zip

From the repo root:

```bash
cd extension && zip -rq ../dist/anime-vocab-coach.zip . -x "icons/icon.svg" && cd ..
```

(or `npm run pack` if you add the script in `package.json`).
