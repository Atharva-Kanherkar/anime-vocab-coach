"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { DEV_NO_CLERK } from "@/lib/dev-auth";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { ConnectionStatus } from "@/components/connection-banner";
import { WordTicker } from "@/components/app/ticker";
import { AppDashboard } from "@/components/app-dashboard";
import { AiCoach } from "@/components/ai-coach";
import { NotebooksPanel } from "@/components/notebooks-panel";
import { CardsPanel } from "@/components/app/cards-panel";
import { MangaReader } from "@/components/app/manga-reader";
import { StudioPanel } from "@/components/app/studio-panel";
import { WordMangaPanel } from "@/components/app/word-manga-panel";
import { GamificationPanel } from "@/components/gamification-panel";
import { CloudSyncPanel } from "@/components/cloud-sync-panel";
import { CloudAutoSync } from "@/components/app/cloud-auto-sync";
import { HelpPanel } from "@/components/app/help-panel";
import { SettingsPanel } from "@/components/app/settings-panel";
import { BillingPanel, type BillingPanelProps } from "@/components/app/billing-panel";

type SectionId =
  | "today"
  | "help"
  | "coach"
  | "notebooks"
  | "cards"
  | "manga"
  | "studio"
  | "word-manga"
  | "progress"
  | "backup"
  | "billing"
  | "settings";

const NAV: { id: SectionId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "help", label: "Help" },
  { id: "coach", label: "Coach" },
  { id: "notebooks", label: "Notebooks" },
  { id: "cards", label: "Cards" },
  { id: "manga", label: "Manga" },
  { id: "studio", label: "Studio" },
  { id: "word-manga", label: "Word Manga" },
  { id: "progress", label: "Progress" },
  { id: "backup", label: "Backup" },
  { id: "billing", label: "Billing" },
  { id: "settings", label: "Settings" },
];

function sectionFromHash(): SectionId | null {
  const id = window.location.hash.replace(/^#/, "");
  return NAV.some((n) => n.id === id) ? (id as SectionId) : null;
}

export function AppShell({
  name,
  owner = false,
  billing,
}: {
  name: string;
  owner?: boolean;
  billing: BillingPanelProps;
}) {
  const [section, setSection] = useState<SectionId>("today");

  useEffect(() => {
    const fromHash = sectionFromHash();
    if (fromHash) setSection(fromHash);
    const onHash = () => {
      const next = sectionFromHash();
      if (next) setSection(next);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <>
      <CloudAutoSync />
      <WordTicker />

      <div className="mx-auto max-w-[960px] px-5 pb-24 md:px-8">
        <header className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-2 border-ink bg-panel px-4 py-3 md:px-5">
          <Link href="/" className="flex items-center gap-3 font-jpround text-[16px] font-bold" aria-label="AnimeVocab home">
            <span className="av-hanko" aria-hidden>アニ</span>
            アニメVocab
          </Link>

          <nav aria-label="Sections" className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto md:order-none md:mx-0 md:ml-auto md:w-auto">
            {NAV.map(({ id, label }) => {
              const active = section === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    setSection(id);
                    window.location.hash = id;
                  }}
                  className={
                    "whitespace-nowrap border-2 px-3 py-1.5 text-[13px] font-extrabold transition " +
                    (active ? "border-ink bg-ink text-bg" : "border-transparent text-ink2 hover:text-ink")
                  }
                >
                  {label}
                </button>
              );
            })}
          </nav>

          <span className="ml-auto flex items-center gap-2 md:ml-0">
            <ThemeToggle />
            {!DEV_NO_CLERK && <UserButton />}
          </span>
        </header>

        <div className="mt-2.5 flex justify-end">
          <ConnectionStatus />
        </div>

        <main id="main" className="mt-8 md:mt-10">
          <div hidden={section !== "today"}>
            <AppDashboard name={name} onGo={(s) => setSection(s as SectionId)} />
          </div>
          <div hidden={section !== "help"}>
            <HelpPanel />
          </div>
          <div hidden={section !== "coach"}>
            <AiCoach />
          </div>
          <div hidden={section !== "notebooks"}>
            <NotebooksPanel />
          </div>
          <div hidden={section !== "cards"}>
            <CardsPanel owner={owner} />
          </div>
          <div hidden={section !== "manga"}>
            <MangaReader owner={owner} />
          </div>
          <div hidden={section !== "studio"}>
            <StudioPanel />
          </div>
          <div hidden={section !== "word-manga"}>
            <WordMangaPanel />
          </div>
          <div hidden={section !== "progress"}>
            <GamificationPanel />
          </div>
          <div hidden={section !== "backup"}>
            <CloudSyncPanel />
          </div>
          <div hidden={section !== "billing"}>
            <BillingPanel {...billing} />
          </div>
          <div hidden={section !== "settings"}>
            <SettingsPanel />
          </div>
        </main>
      </div>
    </>
  );
}
