#!/usr/bin/env node
// One-off sweep for the immortal sync tokens in KV (#114).
//
// THE BACKLOG. Before web/src/lib/sync-store.ts grew its 30-day sliding TTL,
// every mint wrote `synctoken:<token>:v1` with no expiration, and a page load
// could mint. KV ended up holding ~14.7k of them. Each one is a live,
// non-revocable-by-waiting bearer credential for a real account: the only way
// any of them stops working is if someone deletes it. That is the whole issue.
//
// WHY NOT JUST DELETE EVERYTHING. One of those tokens per linked user is the
// credential their extension is holding right now. Deleting it does not
// "re-mint transparently" — cloud-sync.ts tolerates a couple of 401s and then
// unlinks the install and asks the learner to re-link by hand. So the sweep
// splits the set:
//
//   live   — pointed at by `synctoken:user:<id>:v1`. Rewritten with the same
//            30-day TTL a fresh mint would get, so it keeps working and stops
//            being immortal.
//   orphan — everything else: a superseded mint nobody holds. Deleted.
//
// Dry-run by default. Nothing is written without --apply.
//
// Usage:
//   CF_ACCOUNT_ID=… CF_KV_API_TOKEN=… KV_NAMESPACE_ID=… \
//     node scripts/purge-immortal-sync-tokens.mjs [--apply] [--limit N]
//
// The token needs Account · Workers KV Storage · Edit. Run it against the
// staging namespace first (--namespace <id>), as the issue requires.

const API = "https://api.cloudflare.com/client/v4";

/** Same value as SYNC_TOKEN_TTL_SECONDS in web/src/lib/sync-store.ts. */
export const SYNC_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

const TOKEN_KEY = /^synctoken:(avc_st_[A-Za-z0-9]+):v1$/;
const POINTER_KEY = /^synctoken:user:(.+):v1$/;

/**
 * Decide what to do with every listed key. Pure, so the classification is
 * testable without touching an account (test/sync-token-sweep.test.ts).
 *
 * `keys` is the KV list payload: `{ name, expiration? }`. A key with an
 * `expiration` already has a TTL and is left completely alone — this sweep
 * only ever touches the immortal ones, so re-running it is a no-op.
 */
export function planSweep(keys, liveTokens) {
  const live = liveTokens instanceof Set ? liveTokens : new Set(liveTokens);
  const plan = { expire: [], delete: [], pointers: 0, alreadyExpiring: 0, other: 0 };

  for (const key of keys) {
    const name = key?.name;
    if (typeof name !== "string") continue;

    if (POINTER_KEY.test(name)) {
      // The reverse pointer is what tells us which token is live, so it is
      // never deleted. It was introduced BY the TTL fix and so should always
      // carry one — but an immortal pointer would keep a token alive forever,
      // so give it the same TTL rather than trusting that.
      plan.pointers++;
      if (!key.expiration) plan.expire.push({ name, token: null });
      continue;
    }

    const match = TOKEN_KEY.exec(name);
    if (!match) {
      plan.other++;
      continue;
    }
    if (key.expiration) {
      plan.alreadyExpiring++;
      continue;
    }

    const token = match[1];
    if (live.has(token)) plan.expire.push({ name, token });
    else plan.delete.push(name);
  }

  return plan;
}

// ---------------------------------------------------------------- CLI driver

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const flag = (name) => process.argv.includes(`--${name}`);

/** Entry point kept out of module scope so importing this file for its pure
 *  helpers never talks to Cloudflare. */
async function main() {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_KV_API_TOKEN;
  const namespaceId = arg("namespace") || process.env.KV_NAMESPACE_ID;
  if (!accountId || !apiToken || !namespaceId) {
    console.error(
      "Set CF_ACCOUNT_ID, CF_KV_API_TOKEN (Workers KV Storage: Edit) and KV_NAMESPACE_ID\n" +
        "(or pass --namespace <id>), then rerun. Staging namespace first."
    );
    process.exit(1);
  }

  const apply = flag("apply");
  const limit = Number(arg("limit") || 0) || Infinity;
  const base = `${API}/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`;
  const auth = { Authorization: `Bearer ${apiToken}` };

  async function cf(path, init = {}) {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...auth, ...(init.headers || {}) },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`);
    }
    return res;
  }

  /** Page through a prefix. KV caps a list page at 1000 names. */
  async function listPrefix(prefix) {
    const out = [];
    let cursor = "";
    for (;;) {
      const qs = new URLSearchParams({ prefix, limit: "1000" });
      if (cursor) qs.set("cursor", cursor);
      const json = await (await cf(`/keys?${qs}`)).json();
      out.push(...(json.result || []));
      cursor = json.result_info?.cursor || "";
      if (!cursor) return out;
    }
  }

  console.log("Listing synctoken:* …");
  const all = await listPrefix("synctoken:");

  // Which token is each linked user actually holding? The pointer's VALUE is
  // the token, so this costs one read per linked user (tens, not thousands).
  const pointers = all.filter((k) => POINTER_KEY.test(k.name));
  const liveTokens = new Set();
  for (const pointer of pointers) {
    const value = (await (await cf(`/values/${encodeURIComponent(pointer.name)}`)).text()).trim();
    if (value) liveTokens.add(value);
  }

  const plan = planSweep(all, liveTokens);
  const toDelete = plan.delete.slice(0, limit === Infinity ? undefined : limit);

  console.log(
    [
      "",
      `keys listed under synctoken:      ${all.length}`,
      `  user→token pointers             ${plan.pointers}`,
      `  tokens already expiring         ${plan.alreadyExpiring}`,
      `  immortal but still in use       ${plan.expire.length}  → set ${SYNC_TOKEN_TTL_SECONDS}s TTL`,
      `  immortal and superseded         ${plan.delete.length}  → delete`,
      `  unrecognised key shapes         ${plan.other}  (left alone)`,
      "",
      apply ? `APPLYING (deleting ${toDelete.length})` : "DRY RUN — pass --apply to write",
      "",
    ].join("\n")
  );

  if (!apply) return;

  // Give the still-linked credentials the TTL a fresh mint would have. Read
  // then write: the value is the stored profile and must survive untouched.
  for (const { name } of plan.expire) {
    const body = await (await cf(`/values/${encodeURIComponent(name)}`)).text();
    await cf(`/values/${encodeURIComponent(name)}?expiration_ttl=${SYNC_TOKEN_TTL_SECONDS}`, {
      method: "PUT",
      headers: { "content-type": "text/plain" },
      body,
    });
  }
  console.log(`TTL set on ${plan.expire.length} key(s) that are still in use.`);

  // Bulk delete takes up to 10k names per call; 1k keeps each request small
  // enough to retry cheaply if one fails.
  const BATCH = 1000;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batch = toDelete.slice(i, i + BATCH);
    await cf("/bulk", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(batch),
    });
    deleted += batch.length;
    console.log(`  deleted ${deleted}/${toDelete.length}`);
  }

  console.log(
    `\nDone. Spot-check: open animevocab.com/app as a linked user and confirm the ` +
      `extension still syncs (it re-mints on the next page load if it needs to).`
  );
}

// Only run when invoked directly, so `import { planSweep }` stays side-effect free.
if (process.argv[1] && process.argv[1].endsWith("purge-immortal-sync-tokens.mjs")) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
