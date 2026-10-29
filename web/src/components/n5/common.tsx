"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { DEV_NO_CLERK } from "@/lib/dev-auth";
import type { ReactNode } from "react";

export class CourseFailure extends Error {
  constructor(readonly code: string, readonly status: number, readonly questionId?: string) { super(code); }
}
export async function courseRequest<T>(path: string, body?: unknown, method?: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/n5" + path, { method: method ?? (body === undefined ? "GET" : "POST"), credentials: "same-origin", cache: "no-store", signal,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event("avc-n5-auth-lost"));
    throw new CourseFailure(data.error?.code ?? "course_unavailable", response.status, data.error?.details?.questionId);
  }
  return data as T;
}
export function useCourse<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{ data: T | null; error: unknown }>({ data: null, error: null });
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then((data) => { if (!controller.signal.aborted) setState({ data, error: null }); })
      .catch((error) => { if (!controller.signal.aborted) setState({ data: null, error }); });
    return () => controller.abort();
  }, [load]);
  return state;
}
export const newKey = () => crypto.randomUUID();
export function clearCourseStorage() {
  try { for (const key of Object.keys(sessionStorage)) if (key.startsWith("avc:n5:")) sessionStorage.removeItem(key); } catch { /* storage unavailable */ }
}
function ClerkSession({ ownerId, children }: { ownerId: string; children: ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const valid = isLoaded && isSignedIn && user?.id === ownerId;
  useEffect(() => { if (isLoaded && !valid) clearCourseStorage(); }, [isLoaded, valid]);
  return valid ? children : <p role="status">Your account changed. <Link href="/app/n5">Reload your course</Link> or <Link href="/sign-in">sign in again</Link>.</p>;
}
export function CourseSession({ ownerId, children }: { ownerId: string; children: ReactNode }) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    try {
      const previous = sessionStorage.getItem("avc:n5:owner");
      if (previous !== ownerId) clearCourseStorage();
      sessionStorage.setItem("avc:n5:owner", ownerId);
    } catch { /* drafts are best effort, server state remains authoritative */ }
    const lost = () => { clearCourseStorage(); setExpired(true); };
    window.addEventListener("avc-n5-auth-lost", lost);
    return () => window.removeEventListener("avc-n5-auth-lost", lost);
  }, [ownerId]);
  return <main className="n5-root" id="main">
    <header className="n5-top"><Link href="/app">AnimeVocab</Link><Link href="/app/n5">N5 course</Link><span className="n5-tag">Private preview</span></header>
    {expired ? <section className="n5-panel"><h1>Sign in again</h1><p>Your course session ended. Saved progress stays with your account.</p><Link href="/sign-in">Sign in</Link></section>
      : DEV_NO_CLERK ? children : <ClerkSession ownerId={ownerId}>{children}</ClerkSession>}
  </main>;
}
const messages: Record<string, string> = {
  conflict: "A newer version was saved elsewhere. Your local answers are still here. Reload the server version to continue.",
  stale_content: "This practice uses retired lesson content. Keep a copy of your answers, then discard this unfinished attempt and start fresh.",
  invalid_answers: "Check the highlighted question. Use only your selected script and one of the offered choices.",
  attempt_limit: "You have five unfinished attempts. Resume or discard one before starting another.",
  not_found: "This course or attempt is unavailable for your account.",
  invalid_script: "Choose your course script before opening this lesson.",
};
export function Failure({ error }: { error: unknown }) {
  const code = error instanceof CourseFailure ? error.code : "network";
  return <div role="alert" className="n5-error">{messages[code] ?? "Connection unavailable. Your answers are preserved. Retry when you are back online."}</div>;
}
export function Loading() { return <p role="status" className="n5-panel">Loading your practice…</p>; }
