// Thin Resend wrapper for transactional mail from the Next.js Worker.
// The Resend SDK returns `{ data, error }` for API errors but THROWS on
// network/fetch failures — sendEmail normalizes both into { id, error } so a
// transient fetch failure can never abort a caller's batch loop.

import { Resend } from "resend";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SITE_URL } from "./site";

const DEFAULT_FROM = "Anime Vocab <atharva@animevocab.com>";
const DEFAULT_REPLY_TO = "atharvakanherkar25@gmail.com";

interface EmailEnv {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_REPLY_TO?: string;
}

async function emailEnv(): Promise<EmailEnv> {
  const fromProcess: EmailEnv = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
  };
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cf = env as EmailEnv;
    return {
      RESEND_API_KEY: fromProcess.RESEND_API_KEY || cf.RESEND_API_KEY,
      EMAIL_FROM: fromProcess.EMAIL_FROM || cf.EMAIL_FROM,
      EMAIL_REPLY_TO: fromProcess.EMAIL_REPLY_TO || cf.EMAIL_REPLY_TO,
    };
  } catch {
    return fromProcess;
  }
}

/** Escape user-controlled text for interpolation into email HTML. Clerk names
 * are user-settable — never trust them as markup. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  /** Prevents duplicate sends on retries. */
  idempotencyKey?: string;
  replyTo?: string | string[];
}

export interface SendEmailResult {
  id: string | null;
  error: string | null;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const env = await emailEnv();
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return { id: null, error: "resend_not_configured" };
  }

  const resend = new Resend(apiKey);
  const to = Array.isArray(input.to) ? input.to : [input.to];
  const replyTo = input.replyTo ?? env.EMAIL_REPLY_TO ?? DEFAULT_REPLY_TO;

  try {
    const { data, error } = await resend.emails.send(
      {
        from: env.EMAIL_FROM || DEFAULT_FROM,
        to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        replyTo: Array.isArray(replyTo) ? replyTo : [replyTo],
      },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
    );
    if (error) {
      return { id: null, error: error.message };
    }
    return { id: data?.id ?? null, error: null };
  } catch (err) {
    return { id: null, error: err instanceof Error ? err.message : "email_send_failed" };
  }
}

// ── Batch sending ──────────────────────────────────────────────────────────
// One POST /emails/batch carries up to 100 fully-formed emails, so a 500-person
// send is 5 requests instead of 500. Verified against resend@6.17.2:
//   resend.batch.send(payload: CreateBatchEmailOptions[], options?)
//   CreateBatchEmailOptions = CreateEmailOptions minus `attachments` and
//   `scheduledAt` (neither is supported by the batch endpoint).
// Each entry is its own email, so per-recipient personalization means building
// per-recipient entries. There is no server-side merge/templating here.

/** Resend's documented ceiling for one batch request. */
export const BATCH_MAX = 100;

export interface BatchEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
}

export interface BatchSendResult {
  to: string;
  id: string | null;
  error: string | null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Send many emails through the batch endpoint, chunked to BATCH_MAX.
 *
 * `batchValidation: "permissive"` matters for a real blast: the default
 * ("strict") rejects the WHOLE chunk if any single address is malformed, which
 * on a list built from user-entered emails means one bad row silently costs you
 * 99 good sends. Permissive delivers the rest and reports the failures by index,
 * which is what the per-recipient result array is built from.
 *
 * `idempotencyKeyPrefix` guards against double-sends on retry. Resend scopes an
 * idempotency key for 24 hours and caps it at 256 characters, so the key is
 * per-chunk (a whole-batch key would make chunk 2 a replay of chunk 1).
 */
export async function sendEmailBatch(
  emails: BatchEmailInput[],
  opts?: { idempotencyKeyPrefix?: string }
): Promise<BatchSendResult[]> {
  if (emails.length === 0) return [];

  const env = await emailEnv();
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return emails.map((e) => ({ to: e.to, id: null, error: "resend_not_configured" }));
  }

  const resend = new Resend(apiKey);
  const from = env.EMAIL_FROM || DEFAULT_FROM;
  const replyTo = env.EMAIL_REPLY_TO || DEFAULT_REPLY_TO;
  const results: BatchSendResult[] = [];

  const chunks = chunk(emails, BATCH_MAX);
  for (const [chunkIndex, group] of chunks.entries()) {
    const payload = group.map((e) => ({
      from,
      to: [e.to],
      subject: e.subject,
      text: e.text,
      html: e.html,
      replyTo: [replyTo],
      headers: e.headers,
    }));

    try {
      const { data, error } = await resend.batch.send(payload, {
        batchValidation: "permissive" as const,
        ...(opts?.idempotencyKeyPrefix
          ? { idempotencyKey: `${opts.idempotencyKeyPrefix}/chunk-${chunkIndex}`.slice(0, 256) }
          : {}),
      });

      if (error || !data) {
        // Whole-chunk failure (auth, rate limit, network-level API error).
        const message = error?.message ?? "batch_send_failed";
        for (const e of group) results.push({ to: e.to, id: null, error: message });
        continue;
      }

      // Permissive mode reports failures by their index in the payload; every
      // other index succeeded and its id sits at the same position in `data`.
      const failures = new Map<number, string>();
      for (const f of data.errors ?? []) failures.set(f.index, f.message);

      group.forEach((e, i) => {
        const failure = failures.get(i);
        if (failure) {
          results.push({ to: e.to, id: null, error: failure });
          return;
        }
        results.push({ to: e.to, id: data.data[i]?.id ?? null, error: null });
      });
    } catch (err) {
      // The SDK throws (rather than returning `error`) on fetch/network failure.
      const message = err instanceof Error ? err.message : "batch_send_failed";
      for (const e of group) results.push({ to: e.to, id: null, error: message });
    }
  }

  return results;
}

/** Bump when starting a new feedback wave. Used in the idempotency key so a
 * re-run of the same wave cannot double-send, while a new wave can. */
export const FEEDBACK_CAMPAIGN = "feedback-2026-08";

/**
 * Headers every bulk (non-transactional) send should carry.
 *
 * A feedback blast is relationship mail, not transactional, so it needs a real
 * opt-out path. Gmail and Outlook also both surface List-Unsubscribe as a
 * one-tap control, and mail that lacks it is more likely to be filed as spam.
 * Mailto only, deliberately: List-Unsubscribe-Post one-click requires a POST
 * endpoint that actually suppresses the address, which does not exist yet.
 */
export function bulkMailHeaders(unsubscribeTo = DEFAULT_REPLY_TO): Record<string, string> {
  return {
    "List-Unsubscribe": `<mailto:${unsubscribeTo}?subject=unsubscribe>`,
  };
}

/**
 * Feedback request sent to existing accounts. Deliberately short, asks a small
 * number of concrete questions, and routes replies straight to a human inbox
 * rather than a form, because a reply is the lowest-friction thing a reader can
 * do from their phone.
 */
export function feedbackEmailCopy(opts: {
  name: string | null;
}): { subject: string; text: string; html: string } {
  const first = opts.name?.trim().split(/\s+/)[0] || null;
  const hello = first ? `Hey ${first},` : "Hey,";

  const subject = "What would make AnimeVocab better?";

  const text = `${hello}

You signed up for AnimeVocab to learn Japanese from the anime you already watch. I want to know how that has actually gone for you.

I build this on my own, so there is no research team here. Your reply is the research.

If you have two minutes, hit reply and tell me any of these:

1. What made you stop using it, if you did?
2. What is the one thing you wish it did?
3. Did anything feel broken, slow, or confusing?

One line is plenty. "Listening Mode never worked for me" is far more useful to me than silence.

A few things changed recently, in case it has been a while:

* Free now includes 10 hours of Listening Mode and 300 AI messages a month, roughly a 7x increase
* Automatic word picking and pronunciation audio no longer eat into your AI messages
* When you do hit a limit, the app now tells you instead of quietly stopping
* Fixed a bug where listening time was being counted twice, so your hours now last as long as they claim

${SITE_URL}

Thanks for trying it, honestly. Even the harsh replies help.

Atharva
AnimeVocab, ${SITE_URL}

Do not want emails like this? Reply with "stop" and I will take you off the list.
`;

  const html = `<p>${escapeHtml(hello)}</p>
<p>You signed up for AnimeVocab to learn Japanese from the anime you already watch. I want to know how that has actually gone for you.</p>
<p>I build this on my own, so there is no research team here. Your reply is the research.</p>
<p>If you have two minutes, hit reply and tell me any of these:</p>
<ol>
<li>What made you stop using it, if you did?</li>
<li>What is the one thing you wish it did?</li>
<li>Did anything feel broken, slow, or confusing?</li>
</ol>
<p>One line is plenty. "Listening Mode never worked for me" is far more useful to me than silence.</p>
<p>A few things changed recently, in case it has been a while:</p>
<ul>
<li>Free now includes 10 hours of Listening Mode and 300 AI messages a month, roughly a 7x increase</li>
<li>Automatic word picking and pronunciation audio no longer eat into your AI messages</li>
<li>When you do hit a limit, the app now tells you instead of quietly stopping</li>
<li>Fixed a bug where listening time was being counted twice, so your hours now last as long as they claim</li>
</ul>
<p><a href="${SITE_URL}">${SITE_URL}</a></p>
<p>Thanks for trying it, honestly. Even the harsh replies help.</p>
<p>Atharva<br>
AnimeVocab, <a href="${SITE_URL}">animevocab.com</a></p>
<p style="color:#888;font-size:12px">Do not want emails like this? Reply with "stop" and I will take you off the list.</p>`;

  return { subject, text, html };
}

export function maxGiftEmailCopy(opts: {
  name: string | null;
  expiresAt: string;
}): { subject: string; text: string; html: string } {
  const first = opts.name?.trim().split(/\s+/)[0] || null;
  const hello = first ? `Hey ${first},` : "Hey,";
  const expiresLabel = new Date(opts.expiresAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const subject = "You're getting 3 months of Anime Vocab Max — free";

  const text = `${hello}

Thanks for signing up for Anime Vocab early.

I'm giving every account Max for the next 3 months — free (through ${expiresLabel}).
That's the higher AI coach + Listening Mode limits. Nothing to buy.

Just keep using the app / extension as you are:
${SITE_URL}

One ask: reply to this email with any feedback — what's working, what's confusing, what you want next. I read every reply.

— Atharva
Anime Vocab · ${SITE_URL}
`;

  const html = `<p>${escapeHtml(hello)}</p>
<p>Thanks for signing up for Anime Vocab early.</p>
<p>I'm giving every account <strong>Max for the next 3 months — free</strong> (through ${expiresLabel}).
That's the higher AI coach + Listening Mode limits. Nothing to buy.</p>
<p>Just keep using the app / extension as you are:<br>
<a href="${SITE_URL}">${SITE_URL}</a></p>
<p><strong>One ask:</strong> reply to this email with any feedback — what's working, what's confusing, what you want next. I read every reply.</p>
<p>— Atharva<br>
Anime Vocab · <a href="${SITE_URL}">animevocab.com</a></p>`;

  return { subject, text, html };
}
