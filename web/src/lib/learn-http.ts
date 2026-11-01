import { LearnError } from "./learn-store";
export async function learnBody(req: Request, max = 500_000): Promise<Record<string, unknown>> {
  if (Number(req.headers.get("content-length")) > max) throw new LearnError("body_too_large",413);
  const reader = req.body?.getReader();
  if (!reader) throw new LearnError("invalid_json");
  const chunks: Uint8Array[] = [];
  let size=0;
  for (;;) {
    const {value,done} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size>max) { await reader.cancel(); throw new LearnError("body_too_large",413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset=0; for (const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.length; }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new LearnError("invalid_json"); }
}
export const learnJson = (data: unknown, status=200) => Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
export function learnFailure(error: unknown) {
  if (error instanceof LearnError) return learnJson({error:error.message},error.status);
  if (error instanceof Error && /^invalid_/.test(error.message)) return learnJson({error:error.message},400);
  console.error("[learn] request failed",error);
  return learnJson({error:"learner_store_unavailable"},503);
}
