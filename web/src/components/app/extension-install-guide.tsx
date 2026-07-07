"use client";

import { useCallback, useState } from "react";
import {
  CHROME_EXTENSIONS_URL,
  EXTENSION_DOWNLOAD_URL,
  isStoreInstallAvailable,
  installUrl,
} from "@/lib/site";
import { useExtensionLink } from "@/lib/use-extension-link";

const STEPS = [
  {
    n: "1",
    title: "Download the extension",
    body: "Click the button below. A file called AnimeVocab-Extension.zip lands in your Downloads folder. That is the whole extension — nothing else to sign up for.",
  },
  {
    n: "2",
    title: "Unzip it",
    body: "Windows: right-click the zip → Extract All. Mac: double-click the zip. You should get a folder — open it and confirm you see a file named manifest.json inside.",
  },
  {
    n: "3",
    title: "Open Chrome’s extensions page",
    body: "In Chrome’s address bar (where you type google.com), paste chrome://extensions and press Enter. Or click Copy link below and paste it there.",
  },
  {
    n: "4",
    title: "Turn on Developer mode",
    body: "Top-right of that page — flip the switch labeled Developer mode to ON. A new row of buttons appears. This is normal for early access before the Chrome Web Store listing goes live.",
  },
  {
    n: "5",
    title: "Load unpacked",
    body: "Click Load unpacked (top-left). In the file picker, select the folder you unzipped — the one that contains manifest.json. Not the zip file itself.",
  },
  {
    n: "6",
    title: "Come back here & watch anime",
    body: "Pin the AnimeVocab icon in Chrome’s toolbar. Refresh this page while signed in — your account will link automatically. Open Crunchyroll, Netflix, or YouTube and press play.",
  },
] as const;

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this:", text);
    }
  }, [text]);

  return (
    <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={copy}>
      {copied ? "Copied!" : label}
    </button>
  );
}

/** Dead-simple Chrome install for non-technical users (pre–Web Store). */
export function ExtensionInstallGuide({ compact = false }: { compact?: boolean }) {
  const { installed } = useExtensionLink();
  const storeLive = isStoreInstallAvailable();

  if (installed && !compact) {
    return (
      <div className="av-install-done rounded-2xl border-2 border-ok bg-panel px-5 py-4">
        <p className="text-[15px] font-extrabold text-ok">Extension connected</p>
        <p className="mt-1 text-sm text-ink2">
          Open an anime tab and save words — they will show up here automatically.
        </p>
      </div>
    );
  }

  if (storeLive) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <a className="av-btn av-btn-primary" href={installUrl()} rel="noopener noreferrer">
          Add to Chrome — one click
        </a>
        <span className="text-[13px] text-ink3">Official Chrome Web Store install.</span>
      </div>
    );
  }

  return (
    <div className="av-install-guide">
      {!compact && (
        <div className="mb-8 rounded-2xl border-2 border-indigo bg-panel px-5 py-4">
          <p className="text-[15px] font-extrabold">Early access install (about 3 minutes)</p>
          <p className="mt-2 text-sm leading-relaxed text-ink2">
            Google is still reviewing our Chrome Web Store listing. Until that goes live, install this
            way — it is the same extension, just loaded manually. You do not need GitHub, coding tools,
            or a developer account.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <a className="av-btn av-btn-primary" href={EXTENSION_DOWNLOAD_URL} download>
          Download extension (zip)
        </a>
        <CopyButton text={CHROME_EXTENSIONS_URL} label="Copy chrome://extensions" />
      </div>

      {!compact && (
        <ol className="mt-10 list-none space-y-0 pl-0">
          {STEPS.map((step, i) => (
            <li
              key={step.n}
              className={
                "flex gap-5 py-5 " + (i > 0 ? "border-t border-dashed border-line" : "pt-0")
              }
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-bg font-jpround text-sm font-black"
                aria-hidden
              >
                {step.n}
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-extrabold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink2">{step.body}</p>
                {step.n === "3" && (
                  <div className="mt-3">
                    <CopyButton text={CHROME_EXTENSIONS_URL} label="Copy extensions link" />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {compact && (
        <p className="mt-3 text-[13px] text-ink3">
          Download the zip → unzip → chrome://extensions → Developer mode ON → Load unpacked → pick the
          folder.
        </p>
      )}

      {!compact && (
        <details className="mt-8 text-sm text-ink3">
          <summary className="cursor-pointer font-bold text-ink2 hover:text-ink">
            Stuck? Common fixes
          </summary>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
            <li>
              <strong>Load unpacked is greyed out</strong> — turn Developer mode on first (step 4).
            </li>
            <li>
              <strong>Chrome says manifest invalid</strong> — you selected the zip, not the folder. Pick
              the unzipped folder with manifest.json inside.
            </li>
            <li>
              <strong>Nothing happens on Crunchyroll</strong> — pin the extension, refresh the anime tab,
              and make sure subtitles are on (any language is fine).
            </li>
            <li>
              <strong>Still not linked here</strong> — refresh this page after installing. Stay signed in.
            </li>
          </ul>
        </details>
      )}
    </div>
  );
}
