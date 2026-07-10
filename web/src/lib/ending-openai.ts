// Server-only OpenAI calls for the Ending Funnel. Deliberately separate from
// studio-openai.ts: the funnel bakes dialogue INTO the art (Studio never does),
// and its script prompt writes canon characters of famous series as fan art.

import {
  buildEndingPanelPrompt,
  buildEndingScriptPrompt,
  ENDING_IMAGE_SIZE,
  normalizeEndingScript,
  type EndingScript,
  type EndingScriptRequest,
} from "./ending-funnel";
import type { MangaLine, StudioCastMember } from "./studio";
import type { StyleKey } from "./cards";

export async function generateEndingScript(
  apiKey: string,
  model: string,
  req: EndingScriptRequest
): Promise<EndingScript> {
  const { system, user } = buildEndingScriptPrompt(req);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.85,
      max_tokens: 1800,
    }),
  });
  if (!res.ok) throw new Error(`openai_${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return normalizeEndingScript(JSON.parse(data.choices?.[0]?.message?.content ?? "{}"));
}

/** One funnel panel with the dialogue hand-lettered into the artwork.
 * Returns base64 PNG (no data: prefix). */
export async function generateEndingPanelImage(
  apiKey: string,
  opts: {
    model: string;
    quality: string;
    styleKey: StyleKey;
    seriesTitle: string;
    panelIndex: number;
    scene: string;
    cast: StudioCastMember[];
    lines: MangaLine[];
  }
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: opts.model,
      prompt: buildEndingPanelPrompt(opts),
      size: ENDING_IMAGE_SIZE,
      quality: opts.quality,
      n: 1,
      output_format: "png",
      moderation: "low",
    }),
  });
  if (!res.ok) throw new Error(`openai_image_${res.status}`);
  const data = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = data.data?.[0]?.b64_json ?? "";
  if (!b64) throw new Error("openai_image_empty");
  return b64;
}
