"use client";

import { ExtensionInstallGuide } from "@/components/app/extension-install-guide";

export function HelpPanel() {
  return (
    <section aria-label="Help">
      <p className="av-eyebrow">Help · ヘルプ</p>
      <h2 className="mt-2 font-jpround text-[clamp(24px,3.5vw,32px)] font-black leading-tight">
        Install the Chrome extension
      </h2>
      <p className="mt-3 max-w-[52ch] text-[15.5px] leading-relaxed text-ink2">
        The Chrome Web Store listing is still in review. Until one-click install is live, load the
        extension manually — about three minutes, no GitHub account needed.
      </p>
      <div className="mt-10">
        <ExtensionInstallGuide />
      </div>
    </section>
  );
}
