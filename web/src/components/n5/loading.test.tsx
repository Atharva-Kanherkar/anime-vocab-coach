// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CourseLoading, MELODY, TIPS } from "./loading";

const reduced = { matches: false };
beforeEach(() => {
  vi.useFakeTimers();
  reduced.matches = false;
  vi.stubGlobal("matchMedia", () => ({ matches: reduced.matches, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const lit = () => document.querySelectorAll(".n5-key[data-lit]").length;

it("announces the label once, hides the skeleton from screen readers, and shows a tip", () => {
  render(<CourseLoading variant="home" label="Getting your course ready…" />);
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.getByRole("status").textContent).toBe("Getting your course ready…");
  expect(document.querySelector(".n5-skel")?.getAttribute("aria-hidden")).toBe("true");
  expect(TIPS.some((tip) => screen.queryByText(tip))).toBe(true);
});
it("plays the melody in light, using only real white keys", () => {
  expect(MELODY.every((n) => n === -1 || (n >= 0 && n < 8))).toBe(true);
  render(<CourseLoading />);
  expect(screen.getAllByRole("button", { name: /^Play [A-G]( sharp)?$/ })).toHaveLength(13);
  expect(lit()).toBe(1);
  act(() => vi.advanceTimersByTime(380 * 7));
  expect(lit()).toBe(0); // the rest after the first phrase
  act(() => vi.advanceTimersByTime(380));
  expect(lit()).toBe(1);
});
it("lights a key while it's pressed and stays still under reduced motion", () => {
  reduced.matches = true;
  render(<CourseLoading variant="lesson" />);
  expect(lit()).toBe(0);
  expect(screen.queryByRole("button", { name: "Play the melody" })).toBeNull();
  fireEvent.pointerDown(screen.getByRole("button", { name: "Play F sharp" }));
  expect(lit()).toBe(1);
  act(() => vi.advanceTimersByTime(300));
  expect(lit()).toBe(0);
});
