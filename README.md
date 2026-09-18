# Issue #77 review evidence — first-run onboarding

Playwright screenshots from a headed run of `node e2e/onboarding.mjs` against the
built extension at commit `4e2ff42`, loaded unpacked into a clean Chromium
profile. 24/24 checks passed.

Welcome page shots are full-page at 1100px wide. Popup shots are the real
`popup/popup.html` at 360×760, which is how Chrome renders it.

| file | state |
|---|---|
| `shots/onboarding-1-welcome-first-run.png` | what a fresh install lands on |
| `shots/onboarding-2-welcome-steps-tick.png` | steps 1 and 2 ticking live, same tab, no reload |
| `shots/onboarding-3-welcome-first-card.png` | the 🎉 moment after the first card |
| `shots/onboarding-4-popup-checklist-24h.png` | popup 25h after install, nothing mined |
| `shots/onboarding-5-popup-no-checklist-fresh.png` | popup 1h after install — deliberately quiet |
| `shots/onboarding-6-popup-first-card-moment.png` | popup right after the first card |
| `shots/onboarding-6b-popup-moment-spent.png` | next open — the moment is spent |
| `shots/onboarding-7-popup-checklist-dismissed.png` | after "Hide this" |

Branch exists only to host images for the PR; it contains no code.
