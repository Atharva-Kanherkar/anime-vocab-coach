// Server-only OpenAI calls for Manga Studio. Two things:
//   - generateScript: chat model → a normalized N-panel script (title, cast, panels).
//   - generatePanelImage: one square panel. Text beat → images/generations;
//     a learner's rough sketch → images/edits (the "beautify my drawing" path).
// Kept out of the route files so /draft and /panel-art share exactly one impl.

import {
  buildPanelPrompt,
  buildScriptPrompt,
  buildSketchPrompt,
  normalizeScript,
  STUDIO_PANEL_SIZE,
  type StudioCastMember,
  type StudioGenerateRequest,
} from "./studio";

export async function generateScript(
  apiKey: string,
  model: string,
  req: StudioGenerateRequest
): Promise<ReturnType<typeof normalizeScript>> {
  const { system, user } = buildScriptPrompt(req);
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
      temperature: 0.8,
      max_tokens: 1800,
    }),
  });
  if (!res.ok) throw new Error(`openai_${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return normalizeScript(JSON.parse(data.choices?.[0]?.message?.content ?? "{}"));
}

function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** One square panel, no baked text. Returns base64 PNG (no data: prefix). */
export async function generatePanelImage(
  apiKey: string,
  opts: {
    model: string;
    quality: string;
    styleKey: import("./cards").StyleKey;
    scene: string;
    cast: StudioCastMember[];
    sketchB64?: string;
  }
): Promise<string> {
  const { model, quality, styleKey, scene, cast, sketchB64 } = opts;

  if (sketchB64) {
    // images/edits: the sketch defines composition; the model renders it in style.
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", buildSketchPrompt(styleKey, scene, cast));
    form.append("size", STUDIO_PANEL_SIZE);
    form.append("quality", quality);
    form.append("n", "1");
    form.append(
      "image",
      new Blob([b64ToArrayBuffer(sketchB64)], { type: "image/png" }),
      "sketch.png"
    );
    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`openai_edit_${res.status}`);
    const data = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = data.data?.[0]?.b64_json ?? "";
    if (!b64) throw new Error("openai_edit_empty");
    return b64;
  }

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      prompt: buildPanelPrompt(styleKey, scene, cast),
      size: STUDIO_PANEL_SIZE,
      quality,
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
