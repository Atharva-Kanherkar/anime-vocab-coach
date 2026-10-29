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
const lessonId = "your-lie-in-april-s1-e1";
beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });
afterEach(cleanup);
it("reconciles the original script after the opposite enrolment committed but its response was lost", async () => {
  api.data = {
    catalog: { tracks: [{ id: trackId, status: "unreviewed_preview", title: "Your Lie in April" }] },
    course: { availableLessons: [lessonId], units: [] },
    progress: { enrolment: { trackId, script: "romaji" }, attempts: [] },
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
  fireEvent.click(screen.getByRole("button", { name: "Open episode 1" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("radio", { name: /Romaji/ }));
  fireEvent.click(screen.getByRole("button", { name: "Open episode 1" }));
  await waitFor(() => expect(api.push).toHaveBeenCalledWith(`/app/n5/lessons/${lessonId}?script=romaji`));
  expect(serverScript).toBe("romaji");
  expect(api.request.mock.calls.map(([, body]) => body.script)).toEqual(["kana", "romaji"]);
  expect(api.request.mock.calls[0][1].idempotencyKey).not.toBe(api.request.mock.calls[1][1].idempotencyKey);
});
it("never recovers a lost start receipt from another script", async () => {
  const lesson = (script: N5Script): N5Lesson => ({
    apiVersion: 1, id: lessonId, episodeId: "episode-1", courseId: "n5", contentVersion: "preview-1", script,
    status: "unreviewed_preview", canDo: "Introduce yourself", summary: "", summarySource: "", vocabulary: [], grammar: [], watchLinks: [], questions: [],
  });
  api.data = { lesson: lesson("romaji"), watched: true, active: [] };
  api.request.mockRejectedValueOnce(new TypeError("Lost start response"));
  const view = render(<CourseLesson lessonId={lessonId} ownerId="alice" />);
  fireEvent.click(screen.getByRole("button", { name: "Begin episode practice" }));
  await screen.findByRole("alert");
  const first = api.request.mock.calls[0][1];
  view.unmount();
  api.data = { lesson: lesson("kana"), watched: true, active: [] };
  api.request.mockResolvedValueOnce({ id: "kana-attempt", script: "kana" });
  render(<CourseLesson lessonId={lessonId} ownerId="alice" />);
  fireEvent.click(screen.getByRole("button", { name: "Begin episode practice" }));
  await waitFor(() => expect(api.push).toHaveBeenCalledWith("/app/n5/attempts/kana-attempt"));
  const second = api.request.mock.calls[1][1];
  expect(first.script).toBe("romaji");
  expect(second.script).toBe("kana");
  expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
});

it("reconciles an unchanged selection when another tab has changed the server enrolment", async () => {
  api.data = {
    catalog: { tracks: [{ id: trackId, status: "unreviewed_preview", title: "Your Lie in April" }] },
    course: { availableLessons: [lessonId], units: [] },
    progress: { enrolment: { trackId, script: "romaji" }, attempts: [] },
  };
  let serverScript = "kana";
  api.request.mockImplementation(async (_path, body) => {
    serverScript = body.script;
    return { trackId, script: serverScript };
  });
  render(<CourseHub />);
  fireEvent.click(screen.getByRole("button", { name: "Open episode 1" }));
  await waitFor(() => expect(api.push).toHaveBeenCalledWith(`/app/n5/lessons/${lessonId}?script=romaji`));
  expect(serverScript).toBe("romaji");
});
