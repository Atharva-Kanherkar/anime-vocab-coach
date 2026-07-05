# Chrome Web Store resilience & hosted fallback (issue #18)

The extension is the best experience, but Chrome review, permission policy, or store friction can slow distribution. This documents the permission risks, the store-listing justifications to use, the reduced-permission fallback, and the hosted path that keeps the product usable if the extension is delayed or blocked.

## Current permissions & review risk

Manifest: `permissions: [storage, tabCapture, offscreen, scripting, alarms]`, `host_permissions: [youtube, netflix, crunchyroll, api.openai.com, api.animevocab.com, animevocab.com]`.

| Permission | Why we need it | Review risk | Mitigation |
|---|---|---|---|
| `tabCapture` | Listening Mode captures tab audio to transcribe spoken Japanese | **High** — audio capture draws scrutiny | Only activated on explicit user action (clicking Start); never auto-captures; audio is streamed for transcription, not stored |
| `scripting` | Inject the learning pipeline into a video tab (incl. tabs open before install) | Medium | Injected only into the already-granted video hosts |
| `offscreen` | Off-main-thread audio processing for Listening Mode | Low | Standard MV3 pattern |
| `storage` | Local-first progress (words, SRS, stats) | Low | All on-device by default |
| `alarms` | Periodic background cloud sync when signed in | Low | No-op unless the user linked an account |
| host: 3 video sites | Where learning happens | Medium | Enumerated, not `<all_urls>` |
| host: `api.openai.com` | BYO-key Listening Mode streams directly to OpenAI | Medium | Only used when the user supplies their own key |
| host: `api.animevocab.com` | Pro backend (license, transcript cache) | Low | First-party |
| host: `animevocab.com` | Receive the sync token from the signed-in web app (background cloud sync) | Medium — **added recently** | Narrow first-party host; only reads a token the user's own signed-in page posts |

## Store-listing justifications (minimal, copy-paste)

- **Single purpose**: "Helps you learn Japanese vocabulary from anime you watch on YouTube, Netflix, and Crunchyroll."
- **tabCapture**: "Used only when you start Listening Mode, to transcribe the spoken Japanese in the current tab into vocabulary cards. Audio is processed for transcription and not stored."
- **host permissions**: "Limited to the supported video sites plus our own API and web app; the extension does not run on other sites."
- **remote code**: none. All code ships in the package.
- **data usage**: progress stays on-device by default; cloud sync and AI features are opt-in and tied to a signed-in account. See PRIVACY.md.

## Reduced-permission variant (if full review blocks)

If `tabCapture` review stalls, ship a **"Reader" build** that drops Listening Mode entirely:
- Remove `tabCapture`, `offscreen`, and the OpenAI host permission.
- Keep the subtitle-track pipeline (tokenize + cards from on-screen/again-track subtitles), local progress, SRS, and cloud sync.
- This is the majority of the value and clears review with a far smaller surface.
- Gate Listening Mode behind a build flag so one codebase produces both the full and Reader packages.

## Hosted fallback (keeps the business alive without the extension)

Shipped in this change: **`/without-extension`** — a page that explains what works today with no extension installed (import your JSON export, browse/search your synced words, notebooks, streaks, challenges, leaderboard, AI coach on saved lines) and carries **status copy for users waiting on Chrome approval**.

Further fallback surfaces (roadmap, not yet built):
- Manual transcript/subtitle upload for episode study on the web.
- A bookmarklet or lighter web-player import flow.
- SEO pages + demo videos that sell Cloud before an install (some already exist: `/learn-japanese-with-anime`, `/vs-migaku`, `/vs-language-reactor`).

## Submission checklist

- [ ] Privacy policy URL set to the hosted `/privacy` page.
- [ ] Permission justifications above pasted into the dashboard.
- [ ] Screenshots show Listening Mode being started by the user.
- [ ] Reduced-permission "Reader" build ready as a fallback package.
- [ ] `/without-extension` linked from the store listing as the "works without install" story.
