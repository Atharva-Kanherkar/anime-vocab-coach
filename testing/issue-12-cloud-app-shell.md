# issue-12-cloud-app-shell - Test Contract

## Functional Behavior

### Cloud landing (`/cloud`)
- Public page explains AnimeVocab Cloud as an optional hosted companion; local-first extension remains the default path.
- Hero keeps extension install as the primary CTA for free users.
- Includes a Pro/Cloud upgrade CTA that links to pricing (not a dead placeholder).
- Navigation connects home, pricing, install, and Cloud.

### App dashboard (`/app`)
- Signed-in shell (Clerk-protected when enabled) with sticky app navigation linking home, Cloud, pricing, and install.
- Dashboard sections:
  - Plan/billing status placeholder (Free now; Pro wiring later).
  - Progress summary from synced/imported snapshot data.
  - Reviews due list (or conversion-oriented empty state).
  - Recent anime words list (or conversion-oriented empty state).
  - Notebooks empty state with import/sync CTA.
  - AI coach empty state with Pro upsell.
  - Leaderboard empty state with opt-in framing.
- Empty states are actionable (install extension, import JSON, sync, or view Pro) — not dead placeholders.
- Layout is responsive (single column on mobile).

### Shared
- Reuses existing sync panel and local-first copy; does not replace extension-first positioning.
- Works with Clerk disabled (public degraded shell) and Clerk enabled (protected `/app`).

## Unit Tests
- `pickRecentWords` returns words sorted by most recent `lastSeenAt`, capped by limit.
- `pickDueReviews` returns words with due reviews sorted soonest-first, capped by limit.
- Existing sync tests continue to pass.

## Integration / Build Tests
- `cd web && npm run test:unit` passes.
- `cd web && npm run lint` passes.
- `cd web && npm run build` compiles `/cloud` and `/app`.

## Manual Verification
- Visit `/cloud`: local-first messaging, install CTA, Pro/pricing CTA, Cloud nav present.
- Visit `/app` with Clerk off: dashboard shell renders with empty states and sync panel disabled message.
- Visit `/app` signed in (Clerk on): protected route, dashboard shell, import JSON populates recent words and reviews due.
- Resize to mobile width: grids stack to one column; app nav remains usable.
