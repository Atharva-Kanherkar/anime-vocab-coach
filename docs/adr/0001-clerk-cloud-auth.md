# ADR 0001: Clerk for AnimeVocab Cloud auth

Date: 2026-07-04

## Status

Accepted for the first hosted Cloud implementation.

## Context

AnimeVocab is local-first by default. The extension can teach vocabulary, store progress, and export data without an account. Hosted Cloud features need identity for sync, notebooks, leaderboards, AI usage limits, and paid entitlement mapping.

The auth choice should not turn the free extension into an account-gated product.

## Decision

Use Clerk for the hosted Next.js app.

The implementation follows Clerk's current Next.js App Router documentation:

- install `@clerk/nextjs`;
- set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`;
- wrap the root layout in `ClerkProvider`;
- add `clerkMiddleware()` from `@clerk/nextjs/server`;
- use `web/src/proxy.ts`, not `middleware.ts`, because the web app is on Next 16;
- protect `/app` routes only, leaving marketing and install pages public.

For the Chrome extension, use Clerk's Chrome Extension Sync Host direction later: users sign in on the web app, then the extension can sync auth state with the web app rather than forcing a fragile OAuth flow inside a popup. This PR does not put Clerk secrets inside the extension.

## Alternatives considered

### WorkOS AuthKit

WorkOS is strong for B2B and enterprise identity. AnimeVocab's first buyer is an individual learner, so WorkOS adds enterprise shape before there is enterprise demand.

### Custom auth

Custom magic-link or password auth would keep vendor cost low but would create security, account recovery, session, abuse, and deletion/export work immediately. That is the wrong place to spend effort before Cloud usage is proven.

### Dodo license key only

Dodo license keys are still useful for Pro entitlement, but they are not enough for notebooks, sync, leaderboard identity, AI quotas, or device management. License-only identity also makes account recovery and profile UX worse.

## Security notes

- Clerk secret keys stay server-side.
- The publishable key is public by design and is read through `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- `/app` is protected by Clerk middleware, not by client-only checks.
- The extension remains local-first and accountless until users opt into Cloud.
- Cloud sync import/export is explicit; this PR does not silently upload extension data.

## Follow-ups

- Add Clerk Sync Host integration for the extension once the hosted app has real persistence.
- Connect Clerk user IDs to Dodo entitlement records.
- Add server-side persistence for sync snapshots, notebooks, AI usage, and leaderboard events.
- Add account deletion/export docs before storing durable Cloud data.
