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
