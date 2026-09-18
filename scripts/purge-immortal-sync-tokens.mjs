#!/usr/bin/env node
// One-off sweep for the immortal sync tokens in KV (#114).
//
// THE BACKLOG. Before web/src/lib/sync-store.ts grew its 30-day sliding TTL,
// every mint wrote `synctoken:<token>:v1` with no expiration, and a page load
// could mint. KV ended up holding ~14.7k of them. Each one is a live,
// non-revocable-by-waiting bearer credential for a real account: the only way
// any of them stops working is if someone deletes it. That is the whole issue.
//
// WHY NOTHING IS DELETED. An earlier version of this script deleted every
// token with no `synctoken:user:<id>:v1` pointer aimed at it, on the theory
// that a pointerless token is a superseded mint nobody holds. That theory is
// backwards. The reverse pointer was introduced BY the TTL fix, so *every*
// token in this backlog predates it and none of them has a pointer — including
// the one an extension that linked before the fix and never re-linked is still
// using right now. Deleting it does not "re-mint transparently": cloud-sync.ts
// tolerates a couple of 401s and then unlinks the install and asks the learner
// to re-link by hand.
//
// There is no way to prove a token is dead from KV alone. So the sweep only
// ever does the safe half: give every immortal key the same 30-day sliding TTL
// a fresh mint gets. An active extension keeps working and refreshes its TTL on
// the next mint; an abandoned one expires on its own. Keys with no expiration
// drop to ~0 immediately, which is what the issue asks for, and the credentials
// stop being immortal, which is what the issue is *for*.
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
 * `keys` is the KV list payload: `{ name, expiration? }`. A key that already
 * has an `expiration` is left completely alone, so re-running this is a no-op.
 * Everything else that is one of ours gets a TTL — tokens and pointers alike,
 * since an immortal pointer would keep naming a token forever.
 */
export function planSweep(keys) {
  const plan = { expire: [], alreadyExpiring: 0, other: 0 };

  for (const key of keys) {
    const name = key?.name;
    if (typeof name !== "string") continue;

    const isPointer = POINTER_KEY.test(name);
    const token = TOKEN_KEY.exec(name)?.[1] ?? null;
    if (!isPointer && !token) {
      plan.other++;
      continue;
    }
    if (key.expiration) {
      plan.alreadyExpiring++;
      continue;
    }
    plan.expire.push({ name, token, kind: isPointer ? "pointer" : "token" });
  }

  return plan;
}

/**
 * `--limit N` must be a positive integer.
 *
 * The obvious `Number(arg) || Infinity` is wrong in three separate ways:
 * `--limit abc` is NaN and falls through to Infinity, `--limit 0` is falsy and
 * also becomes Infinity, and `--limit -5` survives as a negative that turns a
 * slice into "all but the last five". Every one of those silently writes far
 * more than the operator asked for, which is the opposite of what a limit is
 * for — so anything that is not a positive integer is a hard error.
 */
export function parseLimit(raw) {
  if (raw === undefined) return { ok: true, limit: Infinity };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    return { ok: false, error: `--limit must be a positive integer, got ${JSON.stringify(raw)}` };
  }
  return { ok: true, limit: n };
}

// ---------------------------------------------------------------- CLI driver

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  // A flag with no value (`--limit` at the end, or `--limit --apply`) must not
  // read as "absent" — that is the same silent-unlimited trap as `--limit 0`.
  const value = process.argv[i + 1];
  return value === undefined || value.startsWith("--") ? "" : value;
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

  const parsed = parseLimit(arg("limit"));
  if (!parsed.ok) {
    console.error(parsed.error);
    process.exit(1);
  }
  const { limit } = parsed;

  const apply = flag("apply");
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
  const plan = planSweep(all);
  const todo = limit === Infinity ? plan.expire : plan.expire.slice(0, limit);

  console.log(
    [
      "",
      `keys listed under synctoken:      ${all.length}`,
      `  already expiring (left alone)   ${plan.alreadyExpiring}`,
      `  immortal → 30-day TTL           ${plan.expire.length}`,
      `    of which user→token pointers  ${plan.expire.filter((k) => k.kind === "pointer").length}`,
      `  unrecognised key shapes         ${plan.other}  (left alone)`,
      "",
      apply
        ? `APPLYING to ${todo.length}${limit === Infinity ? "" : ` (--limit ${limit})`}`
        : "DRY RUN — pass --apply to write",
      "",
    ].join("\n")
  );

  if (!apply) return;

  // Re-TTL means read-then-write: the value is the stored profile (or, for a
  // pointer, the token) and must survive untouched. Reads are the expensive
  // half, so they run with bounded concurrency; writes go through KV's bulk
  // endpoint, which takes a per-entry expiration_ttl.
  const READ_CONCURRENCY = 8;
  const WRITE_BATCH = 1000;
  let read = 0;
  const failures = [];

  async function readValues(batch) {
    const out = [];
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(READ_CONCURRENCY, batch.length) }, async () => {
        for (;;) {
          const i = next++;
          if (i >= batch.length) return;
          const { name } = batch[i];
          try {
            const value = await (await cf(`/values/${encodeURIComponent(name)}`)).text();
            out.push({ key: name, value, expiration_ttl: SYNC_TOKEN_TTL_SECONDS });
          } catch (err) {
            // A key that expired or was deleted between the listing and now is
            // not a failure of this sweep; anything else is worth reporting.
            failures.push(`${name}: ${err.message || err}`);
          }
          read++;
          if (read % 500 === 0) console.log(`  read ${read}/${todo.length}`);
        }
      })
    );
    return out;
  }

  let written = 0;
  for (let i = 0; i < todo.length; i += WRITE_BATCH) {
    const batch = todo.slice(i, i + WRITE_BATCH);
    const entries = await readValues(batch);
    if (!entries.length) continue;

    const res = await cf("/bulk", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entries),
    });
    // A 200 from the bulk endpoint does NOT mean every key landed: the body
    // carries `success` and an `errors` array, and reporting the batch size as
    // written without reading them is how a half-failed sweep gets recorded as
    // a clean one.
    const body = await res.json().catch(() => ({}));
    if (body.success === false) {
      const detail = JSON.stringify(body.errors ?? body).slice(0, 300);
      failures.push(`bulk write of ${entries.length} keys rejected: ${detail}`);
      continue;
    }
    written += entries.length;
    console.log(`  TTL set on ${written}/${todo.length}`);
  }

  console.log(
    [
      "",
      `TTL set on ${written} of ${todo.length} key(s).`,
      failures.length ? `${failures.length} failure(s):` : "No failures.",
      ...failures.slice(0, 20).map((f) => `  ${f}`),
      failures.length > 20 ? `  …and ${failures.length - 20} more` : "",
      "",
      "Verify: re-run without --apply — `immortal → 30-day TTL` should be ~0.",
      "Spot-check: open animevocab.com/app as a linked user and confirm sync still works.",
    ]
      .filter(Boolean)
      .join("\n")
  );

  if (failures.length) process.exitCode = 1;
}

// Only run when invoked directly, so `import { planSweep }` stays side-effect free.
if (process.argv[1] && process.argv[1].endsWith("purge-immortal-sync-tokens.mjs")) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
