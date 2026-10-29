"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import { DEV_NO_CLERK } from "@/lib/dev-auth";

export class CourseFailure extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly questionId?: string,
  ) {
    super(code);
  }
}

export async function courseRequest<T>(
  path: string,
  body?: unknown,
  method?: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api/n5" + path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    credentials: "same-origin",
    cache: "no-store",
    signal,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  // Status remains authoritative even if an edge error arrives as HTML.
  if (response.status === 401) {
    window.dispatchEvent(new Event("avc-n5-auth-lost"));
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new CourseFailure(
      data?.error?.code ?? "course_unavailable",
      response.status,
      data?.error?.details?.questionId,
    );
  }
  if (!data || typeof data !== "object") {
    throw new CourseFailure("invalid_response", 503);
  }
  return data as T;
}

export function useCourse<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{ data: T | null; error: unknown }>({
    data: null,
    error: null,
  });
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ data: null, error });
      });
    return () => controller.abort();
  }, [load]);
  return state;
}

export const newKey = () => crypto.randomUUID();

export function clearCourseStorage() {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("avc:n5:")) sessionStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable */
  }
}

function ClerkSession({
  ownerId,
  children,
}: {
  ownerId: string;
  children: ReactNode;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const mismatch = isLoaded && isSignedIn && user?.id !== ownerId;
  useEffect(() => {
    if (mismatch) clearCourseStorage();
  }, [mismatch]);

  if (!isLoaded) return <Loading />;
  if (!isSignedIn) return <SessionExpired />;
  if (mismatch) {
    return (
      <p role="status">
        Your account changed. <Link href="/app/n5">Reload your course</Link>.
      </p>
    );
  }
  return children;
}

function SessionExpired() {
  const pathname = usePathname();
  const returnTo = pathname?.startsWith("/app/n5/") ? pathname : "/app/n5";
  return (
    <section className="n5-panel">
      <h1>Sign in again</h1>
      <p>
        Your session needs refreshing. Unsaved answers remain in this tab for
        the same account.
      </p>
      <Link href={`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`}>
        Sign in
      </Link>
      <p>
        <Link href={returnTo}>Reload after signing in</Link>
      </p>
    </section>
  );
}

export function CourseSession({
  ownerId,
  children,
}: {
  ownerId: string;
  children: ReactNode;
}) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    try {
      const previous = sessionStorage.getItem("avc:n5:owner");
      if (previous !== ownerId) clearCourseStorage();
      sessionStorage.setItem("avc:n5:owner", ownerId);
    } catch {
      /* drafts are best effort; server state remains authoritative */
    }
    const lost = () => setExpired(true);
    window.addEventListener("avc-n5-auth-lost", lost);
    return () => window.removeEventListener("avc-n5-auth-lost", lost);
  }, [ownerId]);

  return (
    <main className="n5-root" id="main">
      <header className="n5-top">
        <Link href="/app">AnimeVocab</Link>
        <Link href="/app/n5">N5 course</Link>
        <span className="n5-tag">Private preview</span>
      </header>
      {expired ? (
        <SessionExpired />
      ) : DEV_NO_CLERK ? (
        children
      ) : (
        <ClerkSession ownerId={ownerId}>{children}</ClerkSession>
      )}
    </main>
  );
}

const messages: Record<string, string> = {
  conflict:
    "A newer version was saved elsewhere. Your local answers are still here. Reload the server version to continue.",
  stale_content:
    "This practice uses retired lesson content. Keep a copy of your answers, then discard this unfinished attempt and start fresh.",
  invalid_answers:
    "Check the highlighted question. Use only your selected script and one of the offered choices.",
  attempt_limit:
    "You have five unfinished attempts. Resume or discard one before starting another.",
  not_found: "This course or attempt is unavailable for your account.",
  invalid_script: "Choose your course script before opening this lesson.",
  unauthorized:
    "Sign in again with the same account. Your answers remain in this tab.",
};

export function Failure({ error }: { error: unknown }) {
  const message =
    error instanceof CourseFailure
      ? (messages[error.code] ??
        "We couldn't complete that request. Your answers are kept. Please retry.")
      : error instanceof TypeError
        ? "Connection unavailable. Your answers are preserved. Retry when you are back online."
        : "We couldn't complete that request. Your answers are kept. Please retry.";
  return (
    <div role="alert" className="n5-error">
      {message}
    </div>
  );
}

export function Loading() {
  return (
    <p role="status" className="n5-panel">
      Loading your practice…
    </p>
  );
}
