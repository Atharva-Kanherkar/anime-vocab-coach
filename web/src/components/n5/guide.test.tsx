// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { N5Script } from "../../../../shared/n5/contracts";
import { STEP_GUIDE } from "@/lib/n5/steps";
import { CourseGuide, GUIDE_KEY, StepGuide, guideSeen } from "./guide";

beforeAll(() => {
  // jsdom has no modal dialogs; model the open attribute the guide relies on.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});
// Node's own localStorage global shadows jsdom's, so give each test a fresh store.
function memoryStorage() {
  const items = new Map<string, string>();
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, String(v)), removeItem: (k: string) => void items.delete(k), clear: () => items.clear() };
}
beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Hub({ onStart }: { onStart: () => void }) {
  const [open, setOpen] = useState(!guideSeen());
  const [script, setScript] = useState<N5Script | null>(null);
  return <CourseGuide open={open} onClose={() => setOpen(false)} script={script} onScript={setScript} startLabel="Start Unit 1" onStart={onStart} />;
}
const next = () => fireEvent.click(screen.getByRole("button", { name: "Next" }));

it("opens once, asks for a script before moving on, and ends by starting the unit", () => {
  const onStart = vi.fn();
  const { container } = render(<Hub onStart={onStart} />);
  expect(container.querySelector("dialog")?.open).toBe(true);
  expect(screen.getByRole("heading", { name: "Welcome to your Japanese course" })).toBeTruthy();
  next();
  expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("radio", { name: /Kana/ }));
  next();
  expect(screen.getByRole("heading", { name: "Every unit has five steps" })).toBeTruthy();
  expect(screen.getByText(STEP_GUIDE.learn.why)).toBeTruthy();
  next();
  next();
  expect(screen.getByRole("heading", { name: "Passing and progress" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Start Unit 1" }));
  expect(onStart).toHaveBeenCalledOnce();
  expect(container.querySelector("dialog")?.open).toBe(false);
  expect(localStorage.getItem(GUIDE_KEY)).toBe("seen");
  cleanup();
  render(<Hub onStart={onStart} />);
  expect(document.querySelector("dialog")?.open).toBe(false);
});
it("Escape or Skip closes it for good, and the page dots jump between pages", () => {
  const { container, unmount } = render(<Hub onStart={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Watching, page 4" }));
  expect(screen.getByRole("heading", { name: "Watching the episodes" })).toBeTruthy();
  fireEvent(container.querySelector("dialog")!, new Event("cancel", { cancelable: true }));
  expect(container.querySelector("dialog")?.open).toBe(false);
  expect(guideSeen()).toBe(true);
  unmount();
  localStorage.clear();
  render(<Hub onStart={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Skip guide" }));
  expect(guideSeen()).toBe(true);
});
it("as a reference from a lesson, it explains scripts without a picker and ends with Got it", () => {
  const onClose = vi.fn();
  render(<CourseGuide open onClose={onClose} />);
  next();
  expect(screen.queryByRole("radio")).toBeNull();
  next();
  next();
  next();
  fireEvent.click(screen.getByRole("button", { name: "Got it" }));
  expect(onClose).toHaveBeenCalledOnce();
});
it("tells you what to do on each step", () => {
  render(<StepGuide step="drill" position={2} total={5} />);
  expect(screen.getByText(/Step 2 of 5: Drill/)).toBeTruthy();
  expect(screen.getByText(STEP_GUIDE.drill.todo)).toBeTruthy();
});
