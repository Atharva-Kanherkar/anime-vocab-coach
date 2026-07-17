import type { Notebook } from "./notebooks";

export interface NotebookSummaryResult {
  weakSpots: string[];
  reviewPrompts: string[];
}

// Cap how many entries feed the prompt so cost/latency stay bounded on big
// notebooks. Most-recent first (entries are stored newest-first).
const MAX_PROMPT_ENTRIES = 60;

function entriesBlock(nb: Notebook): string {
  const lines = nb.entries.slice(0, MAX_PROMPT_ENTRIES).map((e) => {
    const bits = [
      e.word ? `word: ${e.word}${e.reading ? ` (${e.reading})` : ""}${e.gloss ? ` = ${e.gloss}` : ""}` : "",
      e.line ? `line: ${e.line}` : "",
      e.note ? `note: ${e.note}` : "",
      e.title ? `[${e.title}${e.level ? `, freq-band ${e.level}/5` : ""}]` : "",
    ].filter(Boolean);
    return "- " + bits.join(" | ");
  });
  return lines.join("\n");
}

/** Summarize a notebook into weak spots + review prompts. Throws on OpenAI error. */
export async function runNotebookSummary(
  apiKey: string,
  model: string,
  nb: Notebook
): Promise<NotebookSummaryResult> {
  const system =
    "You are an anime immersion study coach (Japanese↔English). Given a learner's notebook of saved words, lines, and notes, " +
    "identify recurring weak spots and generate short review prompts that quiz the learner on this exact material. " +
    "Match the output language to the notebook content (Japanese notes → Japanese prompts; English notes → English prompts). " +
    "Be specific to the entries, not generic. " +
    'Respond only as strict JSON {"weakSpots": string[], "reviewPrompts": string[]} with 3-6 items each, ' +
    "each item one sentence.";
  const user = `Notebook: ${nb.name}\nEntries:\n${entriesBlock(nb)}`;

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
      temperature: 0.5,
      max_tokens: 600,
    }),
  });

  if (!res.ok) throw new Error(`openai_${res.status}`);

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as Record<string, unknown>;
  } catch {
    throw new Error("openai_bad_json");
  }

  const strList = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim()).slice(0, 6)
      : [];

  const weakSpots = strList(parsed.weakSpots);
  const reviewPrompts = strList(parsed.reviewPrompts);
  if (!weakSpots.length && !reviewPrompts.length) throw new Error("openai_empty");
  return { weakSpots, reviewPrompts };
}
