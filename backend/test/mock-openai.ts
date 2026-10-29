/**
 * A deterministic stand-in for OpenAI, wired as the Worker's outbound fetch in
 * tests and the local harness. It records calls and can be told to fail.
 */
export interface MockOpenAI {
  calls: { path: string; schema?: string; body?: unknown }[];
  fail: Set<string>;
  transcript: string;
  handle(request: Request): Promise<Response>;
}

export function mockOpenAI(): MockOpenAI {
  const mock: MockOpenAI = {
    calls: [], fail: new Set(), transcript: "わたしは がくせいです",
    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url);
      if (url.hostname !== "api.openai.com") return new Response("blocked outbound request", { status: 599 });
      const path = url.pathname;
      if (request.headers.get("Authorization") !== "Bearer test-openai-key") return Response.json({ error: { message: "bad key" } }, { status: 401 });
      if (path === "/v1/audio/speech") {
        const body = await request.json() as { input: string };
        mock.calls.push({ path, body });
        if (mock.fail.has("speech")) return Response.json({ error: {} }, { status: 500 });
        // A small, valid-looking MP3 payload whose bytes encode the request, for assertions.
        const bytes = new TextEncoder().encode(`ID3 mock speech: ${body.input} `.padEnd(160, "."));
        return new Response(bytes, { headers: { "Content-Type": "audio/mpeg" } });
      }
      if (path === "/v1/audio/transcriptions") {
        const form = await request.formData();
        mock.calls.push({ path, body: { model: form.get("model"), language: form.get("language"), bytes: (form.get("file") as Blob).size } });
        if (mock.fail.has("transcribe")) return Response.json({ error: {} }, { status: 500 });
        return Response.json({ text: mock.transcript });
      }
      if (path === "/v1/chat/completions") {
        const body = await request.json() as { response_format: { json_schema: { name: string } }; messages: { role: string; content: string }[] };
        const schema = body.response_format.json_schema.name;
        mock.calls.push({ path, schema, body });
        if (mock.fail.has(schema) || mock.fail.has("chat")) return Response.json({ error: {} }, { status: 500 });
        const content = (() => {
          if (schema === "typed_feedback") {
            const request = JSON.parse(body.messages[1].content) as { items: { questionId: string; modelAnswers: string[] }[] };
            return { items: request.items.map((item) => ({ questionId: item.questionId, verdict: "close", correction: item.modelAnswers[0], note: "Check the particle after the topic." })) };
          }
          if (schema === "tutor_turn") {
            if (mock.fail.has("bad_reply")) return { heard: "", reply: "私はハルです", english: "", tip: "", correction: "", finished: false };
            return { heard: "わたし_は がくせい_です。", reply: "そう_ですか。 ^ハル_も がくせい_です。", english: "I see. Haru is a student too.", tip: "Try asking a question back.", correction: "", finished: false };
          }
          if (schema === "speaking_grade") {
            return { taskCompletion: 2, targetUse: 2, interaction: 2, evidence: ["わたし_は がくせい_です。"], correction: "わたし_は がくせい_です。", summary: "Nice work introducing yourself. Next, ask Haru a question back." };
          }
          return {};
        })();
        return Response.json({ choices: [{ message: { content: JSON.stringify(content) } }] });
      }
      return Response.json({ error: { message: "unknown path" } }, { status: 404 });
    },
  };
  return mock;
}
