// Thin Resend wrapper for transactional mail from the Next.js Worker.
// Always check `{ data, error }` — the Resend SDK does not throw on API errors.

import { Resend } from "resend";
import { getCloudflareContext } from "@opennextjs/cloudflare";

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
https://animevocab.com

One ask: reply to this email with any feedback — what's working, what's confusing, what you want next. I read every reply.

— Atharva
Anime Vocab · https://animevocab.com
`;

  const html = `<p>${hello}</p>
<p>Thanks for signing up for Anime Vocab early.</p>
<p>I'm giving every account <strong>Max for the next 3 months — free</strong> (through ${expiresLabel}).
That's the higher AI coach + Listening Mode limits. Nothing to buy.</p>
<p>Just keep using the app / extension as you are:<br>
<a href="https://animevocab.com">https://animevocab.com</a></p>
<p><strong>One ask:</strong> reply to this email with any feedback — what's working, what's confusing, what you want next. I read every reply.</p>
<p>— Atharva<br>
Anime Vocab · <a href="https://animevocab.com">animevocab.com</a></p>`;

  return { subject, text, html };
}
