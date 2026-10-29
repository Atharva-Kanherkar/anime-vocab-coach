// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { N5Lesson, N5Script } from "../../../../shared/n5/contracts";
const api = vi.hoisted(() => ({ data: {} as unknown, request: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }) }));
vi.mock("./common", async (original) => ({
  ...(await original<object>()),
  useCourse: () => ({ data: api.data, error: null }),
  courseRequest: api.request,
}));
import { CourseHub } from "./hub";
import { CourseLesson } from "./lesson";
const trackId = "your-lie-in-april-2014";
const lessonId = "your-lie-in-april-u01";
const units = [{ id: "unit-1", number: 1, title: "Greet and introduce yourself", status: "unreviewed_preview", lessonId, kind: "episode", episode: { number: 1, title: "Monotone/Colorful" } }];
beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });
afterEach(cleanup);
it("reconciles the original script after the opposite enrolment committed but its response was lost", async () => {
  api.data = {
    catalog: { tracks: [{ id: trackId, status: "unreviewed_preview", title: "Your Lie in April" }] },
    course: { availableLessons: [lessonId], units },
    progress: { enrolment: { trackId, script: "romaji" }, attempts: [], lessons: [], nextLessonId: lessonId },
  };
  let serverScript = "romaji";
  let first = true;
  api.request.mockImplementation(async (_path, body) => {
    serverScript = body.script;
    if (first) { first = false; throw new TypeError("Response lost after commit"); }
    return { trackId, script: serverScript };
  });
  render(<CourseHub />);
  fireEvent.click(screen.getByRole("radio", { name: /Kana/ }));
  fireEvent.click(screen.getByRole("button", { name: "Continue: Unit 1" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("radio", { name: /Romaji/ }));
  fireEvent.click(screen.getByRole("button", { name: "Continue: Unit 1" }));
  await waitFor(() => expect(api.push).toHaveBeenCalledWith(`/app/n5/lessons/${lessonId}?script=romaji`));
  expect(serverScript).toBe("romaji");
  expect(api.request.mock.calls.map(([, body]) => body.script)).toEqual(["kana", "romaji"]);
  expect(api.request.mock.calls[0][1].idempotencyKey).not.toBe(api.request.mock.calls[1][1].idempotencyKey);
});
it("never recovers a lost start receipt from another script", async () => {
  const lesson = (script: N5Script): N5Lesson => ({
    apiVersion: 1, id: lessonId, episodeId: "episode-1", courseId: "n5", contentVersion: "course-1", script, trackId, unit: 1, kind: "episode",
    title: "Greet", episode: { number: 1, title: "Monotone/Colorful" }, hook: "Listen", status: "unreviewed_preview", canDo: "Introduce yourself",
    summary: "", summarySource: null, vocabulary: [], grammar: [], dialogue: [], watchLinks: [], questions: [],
    speaking: { goal: "Introduce yourself", opener: { text: "hajimemashite", english: "Nice to meet you", audio: "0000000000000000" }, prompts: [] },
    previousLessonId: null, nextLessonId: null,
  });
  api.data = { lesson: lesson("romaji"), watched: true, active: [], status: null, completed: [] };
  api.request.mockRejectedValueOnce(new TypeError("Lost start response"));
  const view = render(<CourseLesson lessonId={lessonId} ownerId="alice" />);
  fireEvent.click(screen.getByRole("button", { name: "Begin practice" }));
  await screen.findByRole("alert");
  const first = api.request.mock.calls[0][1];
  view.unmount();
  api.data = { lesson: lesson("kana"), watched: true, active: [], status: null, completed: [] };
  api.request.mockResolvedValueOnce({ id: "kana-attempt", script: "kana" });
  render(<CourseLesson lessonId={lessonId} ownerId="alice" />);
  fireEvent.click(screen.getByRole("button", { name: "Begin practice" }));
  await waitFor(() => expect(api.push).toHaveBeenCalledWith("/app/n5/attempts/kana-attempt"));
  const second = api.request.mock.calls[1][1];
  expect(first.script).toBe("romaji");
  expect(second.script).toBe("kana");
  expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
});

it("reconciles an unchanged selection when another tab has changed the server enrolment", async () => {
  api.data = {
    catalog: { tracks: [{ id: trackId, status: "unreviewed_preview", title: "Your Lie in April" }] },
    course: { availableLessons: [lessonId], units },
    progress: { enrolment: { trackId, script: "romaji" }, attempts: [], lessons: [], nextLessonId: lessonId },
  };
  let serverScript = "kana";
  api.request.mockImplementation(async (_path, body) => {
    serverScript = body.script;
    return { trackId, script: serverScript };
  });
  render(<CourseHub />);
  fireEvent.click(screen.getByRole("button", { name: "Continue: Unit 1" }));
  await waitFor(() => expect(api.push).toHaveBeenCalledWith(`/app/n5/lessons/${lessonId}?script=romaji`));
  expect(serverScript).toBe("romaji");
});
