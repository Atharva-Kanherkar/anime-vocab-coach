# Sweeping immortal sync tokens out of KV

Runbook for `scripts/purge-immortal-sync-tokens.mjs` (issue #114).

## What the problem is

`synctoken:<token>:v1` maps the extension's bearer credential to the profile it
was minted for. Before `web/src/lib/sync-store.ts` grew its 30-day sliding TTL,
every mint wrote that key with **no expiration**, and a mint could happen on an
ordinary page load. The result was ~14,749 keys that never expire, each one a
still-valid bearer credential for a real account, and nothing about waiting
ever takes one away.

The TTL fix stopped the bleeding. It did nothing about the backlog, because KV
has no way to retroactively attach an expiration to keys already written.

## What the sweep does

It lists everything under `synctoken:` and gives every key with **no
expiration** the same 30-day sliding TTL a fresh mint gets — tokens and
`synctoken:user:<id>:v1` pointers alike. Keys that already carry an expiration
are never touched, so the sweep is idempotent and safe to re-run.

**Nothing is deleted.** An earlier draft deleted any token with no reverse
pointer aimed at it, on the theory that a pointerless token is a superseded
mint nobody holds. That theory is backwards: the reverse pointer was introduced
*by* the TTL fix, so every key in this backlog predates it and none of them has
a pointer — including the credential an extension that linked before the fix
and never re-linked is still using. Deleting that does not "re-mint
transparently": `cloud-sync.ts` tolerates a couple of 401s and then unlinks the
install and asks the learner to re-link by hand.

Nothing in KV can prove a token is dead, so the sweep does only the safe half.
That is still the whole point of the issue: keys with no expiration drop to ~0
immediately, an active extension keeps working and refreshes its TTL on the
next mint, and an abandoned credential now expires on its own instead of
lasting forever.

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

# 4. Production, a cautious first slice. --limit must be a positive integer;
#    anything else is rejected rather than quietly meaning "no limit".
KV_NAMESPACE_ID=8e67f3701aa04195975a583cc59d8425 \
  npm run kv:sweep-sync-tokens -- --apply --limit 500

# 5. Production, the rest.
KV_NAMESPACE_ID=8e67f3701aa04195975a583cc59d8425 \
  npm run kv:sweep-sync-tokens -- --apply
```

Re-TTL is a read followed by a write, because the stored value (the profile, or
the token a pointer names) has to survive untouched. Reads run eight at a time
and writes go through KV's bulk endpoint; the run reports how many keys
actually landed, and exits non-zero if any batch was rejected.

`--namespace <id>` works instead of the env var.

## Verifying

1. Re-run the dry run: `immortal → 30-day TTL` should be ~0.
2. Sign in at `animevocab.com/app` with the extension installed and confirm the
   popup still reports the account as linked, then make a change and watch it
   sync. Nothing was deleted, so no one should need to re-link.
3. `/owner` → **All time** → linked users should be unchanged.

Thirty days after the run, any credential nobody refreshed is gone on its own.
