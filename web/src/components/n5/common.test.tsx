// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const clerk = vi.hoisted(() => ({
  current: {
    isLoaded: false,
    isSignedIn: false,
    user: null as { id: string } | null,
  },
}));
vi.mock("@clerk/nextjs", () => ({ useUser: () => clerk.current }));
vi.mock("@/lib/dev-auth", () => ({ DEV_NO_CLERK: false }));
import { CourseSession, courseRequest, CourseFailure, Failure } from "./common";

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem("avc:n5:owner", "alice");
  sessionStorage.setItem("avc:n5:draft", "unsaved answers");
  clerk.current = { isLoaded: false, isSignedIn: false, user: null };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const course = () => (
  <CourseSession ownerId="alice">
    <p>Private lesson</p>
  </CourseSession>
);
it("shows neutral Clerk loading before the correct user's lesson, without an account-change flash", () => {
  const view = render(course());
  expect(screen.getByText("Loading your practice…")).toBeTruthy();
  expect(screen.queryByText(/Your account changed/)).toBeNull();
  expect(screen.queryByText("Private lesson")).toBeNull();
  expect(sessionStorage.getItem("avc:n5:draft")).toBe("unsaved answers");
  clerk.current = { isLoaded: true, isSignedIn: true, user: { id: "alice" } };
  view.rerender(course());
  expect(screen.getByText("Private lesson")).toBeTruthy();
});
it("hides a signed-out session but preserves same-owner recovery; a confirmed other account clears drafts", () => {
  clerk.current = { isLoaded: true, isSignedIn: false, user: null };
  const view = render(course());
  expect(screen.getByRole("heading", { name: "Sign in again" })).toBeTruthy();
  expect(sessionStorage.getItem("avc:n5:draft")).toBe("unsaved answers");
  clerk.current = { isLoaded: true, isSignedIn: true, user: { id: "bob" } };
  view.rerender(course());
  expect(screen.getByText(/Your account changed/)).toBeTruthy();
  expect(sessionStorage.getItem("avc:n5:draft")).toBeNull();
});
it("keeps drafts on an HTTP auth loss and restores visibility after same-owner remount", async () => {
  clerk.current = { isLoaded: true, isSignedIn: true, user: { id: "alice" } };
  const view = render(course());
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("HTML", { status: 401 })),
  );
  await act(async () => {
    await expect(courseRequest("/catalog")).rejects.toMatchObject({
      status: 401,
    });
  });
  expect(screen.queryByText("Private lesson")).toBeNull();
  expect(sessionStorage.getItem("avc:n5:draft")).toBe("unsaved answers");
  view.unmount();
  render(course());
  expect(screen.getByText("Private lesson")).toBeTruthy();
});
it("preserves HTTP status for HTML failures and never labels server errors as offline", async () => {
  for (const status of [405, 503]) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>edge</html>", { status })),
    );
    await expect(courseRequest("/catalog")).rejects.toMatchObject({
      status,
      code: "course_unavailable",
    });
  }
  for (const error of [
    new CourseFailure("unknown", 503),
    new SyntaxError("HTML"),
  ]) {
    const view = render(<Failure error={error} />);
    expect(screen.getByRole("alert").textContent).not.toContain("offline");
    view.unmount();
  }
  render(<Failure error={new TypeError("Failed to fetch")} />);
  expect(screen.getByRole("alert").textContent).toContain("back online");
});
