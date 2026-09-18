# Sweeping immortal sync tokens out of KV

Runbook for `scripts/purge-immortal-sync-tokens.mjs` (issue #114).

## What the problem is

`synctoken:<token>:v1` maps the extension's bearer credential to the profile it
was minted for. Before `web/src/lib/sync-store.ts` grew its 30-day sliding TTL,
every mint wrote that key with **no expiration**, and a mint could happen on an
ordinary page load. The result was ~14,749 keys that never expire, each one a
still-valid bearer credential for a real account. Waiting does not revoke them;
only a delete does.

The TTL fix stopped the bleeding. It did nothing about the backlog, because KV
has no way to retroactively attach an expiration to keys already written.

## What the sweep does

It lists everything under `synctoken:` and splits the immortal tokens in two:

| Class | How it is recognised | Action |
| --- | --- | --- |
| **Live** | the token is the value of some `synctoken:user:<id>:v1` pointer | rewritten with a 30-day TTL |
| **Superseded** | no pointer references it | deleted |

The split matters. A live token is the credential an extension is holding right
now, and deleting it does *not* re-mint transparently: `cloud-sync.ts` tolerates
a couple of 401s and then unlinks the install and asks the learner to re-link by
hand. Superseded tokens are the actual backlog — one live credential per linked
user, thousands of abandoned ones behind it.

Keys that already carry an expiration are never touched, so the sweep is
idempotent and safe to re-run.

## Running it

Needs an API token with **Account · Workers KV Storage · Edit**.

```bash
export CF_ACCOUNT_ID=…
export CF_KV_API_TOKEN=…

# 1. Staging namespace first, dry run. Writes nothing.
KV_NAMESPACE_ID=<staging-ns> npm run kv:sweep-sync-tokens

# 2. Staging, for real.
KV_NAMESPACE_ID=<staging-ns> npm run kv:sweep-sync-tokens -- --apply

# 3. Production dry run — read the counts before believing them.
KV_NAMESPACE_ID=8e67f3701aa04195975a583cc59d8425 npm run kv:sweep-sync-tokens

# 4. Production. --limit caps the delete batch if you want a first slice.
KV_NAMESPACE_ID=8e67f3701aa04195975a583cc59d8425 \
  npm run kv:sweep-sync-tokens -- --apply --limit 500
```

`--namespace <id>` works instead of the env var.

## Verifying

1. Re-run the dry run: `immortal, superseded` should be ~0.
2. Sign in at `animevocab.com/app` with the extension installed and confirm the
   popup still reports the account as linked, then make a change and watch it
   sync. A user whose token was deleted re-mints on the next page load.
3. `/owner` → **All time** → linked users should be unchanged; the sweep never
   removes a `synctoken:user:*` pointer.
