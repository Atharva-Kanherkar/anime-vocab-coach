"use client";

import { installUrl, isStoreInstallAvailable } from "@/lib/site";

/** Sticky tip: Chrome extension is a desktop path — don't bury mobile ad visitors. */
export function DesktopChromeBanner() {
  const href = installUrl();
  const store = isStoreInstallAvailable();

  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3 backdrop-blur-md"
      style={{
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        borderColor: "var(--line)",
        background: "color-mix(in srgb, var(--bg) 92%, transparent)",
      }}
    >
      <div className="mx-auto flex max-w-[720px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p
          className="text-[13px] font-bold leading-snug"
          style={{ color: "var(--ink-2)" }}
        >
          On a laptop? Learn Japanese from Crunchyroll/Netflix with the free Chrome extension.
        </p>
        <a
          href={href}
          rel="noopener noreferrer"
          target={store ? "_blank" : undefined}
          className="inline-flex shrink-0 items-center justify-center rounded-xl px-4 py-2.5 text-[13px] font-extrabold no-underline"
          style={{ background: "var(--accent)", color: "#100b08" }}
        >
          {store ? "Add to Chrome" : "Get the extension"}
        </a>
      </div>
    </aside>
  );
}
