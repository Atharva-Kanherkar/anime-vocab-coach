// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./common", async (original) => ({
  ...(await original<object>()),
  courseRequest: api.request,
  newKey: () => "key",
}));
import { CourseFailure } from "./common";
import { useAttempt } from "./use-attempt";
import type { N5Attempt, N5Lesson } from "../../../../shared/n5/contracts";
const answers = [{ questionId: "name", value: "Haru desu" }];
const initial: N5Attempt = {
  id: "a",
  courseId: "n5",
  lessonId: "l",
  contentVersion: "v1",
  script: "romaji",
  revision: 1,
  status: "active",
  answers,
  result: null,
};
const lesson: N5Lesson = {
  apiVersion: 1,
  id: "l",
  courseId: "n5",
  contentVersion: "v1",
  episodeId: "e",
  script: "romaji",
  status: "unreviewed_preview",
  trackId: "t",
  unit: 1,
  kind: "episode",
  title: "Greet",
  episode: { number: 1, title: "One" },
  hook: "",
  dialogue: [],
  speaking: { goal: "", opener: { text: "hai", english: "yes", audio: "0000000000000000" }, prompts: [] },
  previousLessonId: null,
  nextLessonId: null,
  summary: "",
  summarySource: "",
  canDo: "",
  vocabulary: [],
  grammar: [],
  watchLinks: [],
  questions: [
    {
      id: "name",
      kind: "production",
      skill: "writing",
      objectiveId: "intro",
      prompt: "Introduce yourself",
    },
  ],
};
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});
it.each([
  [404, "not_found"],
  [409, "incomplete_answers"],
])(
  "unlocks editing after finish rejection %s/%s without losing answers",
  async (status, code) => {
    api.request.mockRejectedValueOnce(
      new CourseFailure(code as string, status as number),
    );
    const { result } = renderHook(() => useAttempt(initial, lesson, "alice"));
    await act(async () => {
      await result.current.submit(true);
    });
    expect(result.current.state.finishRevision).toBeNull();
    expect(result.current.state.answers).toEqual(answers);
    act(() => result.current.edit([{ questionId: "name", value: "Aki desu" }]));
    expect(result.current.state.answers[0].value).toBe("Aki desu");
  },
);
it("retains an uncertain finish revision for network retries without another answer save", async () => {
  api.request.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  api.request.mockResolvedValueOnce({ ...initial, status: "complete" });
  const { result } = renderHook(() => useAttempt(initial, lesson, "alice"));
  await act(async () => {
    await result.current.submit(true);
  });
  expect(result.current.state.finishRevision).toBe(1);
  await act(async () => {
    await result.current.submit(true);
  });
  expect(api.request.mock.calls.map((call) => call.slice(0, 2))).toEqual([
    ["/attempts/a/finish", { revision: 1 }],
    ["/attempts/a/finish", { revision: 1 }],
  ]);
});
