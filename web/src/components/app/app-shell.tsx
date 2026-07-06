"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { DEV_NO_CLERK } from "@/lib/dev-auth";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { ConnectionStatus } from "@/components/connection-banner";
import { IconOverview, IconCoach, IconNotebook, IconProgress, IconBackup } from "@/components/app/icons";
import { AppDashboard } from "@/components/app-dashboard";
import { AiCoach } from "@/components/ai-coach";
import { NotebooksPanel } from "@/components/notebooks-panel";
import { GamificationPanel } from "@/components/gamification-panel";
import { CloudSyncPanel } from "@/components/cloud-sync-panel";

type SectionId = "overview" | "coach" | "notebooks" | "progress" | "backup";

const NAV: { id: SectionId; label: string; Icon: (p: { className?: string }) => ReactNode }[] = [
  { id: "overview", label: "Overview", Icon: IconOverview },
  { id: "coach", label: "AI coach", Icon: IconCoach },
  { id: "notebooks", label: "Notebooks", Icon: IconNotebook },
  { id: "progress", label: "Progress", Icon: IconProgress },
  { id: "backup", label: "Backup", Icon: IconBackup },
];

export function AppShell({ name }: { name: string }) {
  const [section, setSection] = useState<SectionId>("overview");

  return (
    <div className="md:grid md:min-h-screen md:grid-cols-[236px_1fr]">
      <aside className="border-b border-line px-4 py-4 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:border-b-0 md:border-r md:px-5 md:py-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-jp text-[17px]" aria-label="AnimeVocab home">
            アニメ<b className="font-semibold text-accent">Vocab</b>
          </Link>
          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            {!DEV_NO_CLERK && <UserButton />}
          </div>
        </div>

        <nav
          aria-label="Sections"
          className="mt-4 flex gap-1 overflow-x-auto md:mt-7 md:flex-col md:gap-0.5 md:overflow-visible"
        >
          {NAV.map(({ id, label, Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setSection(id)}
                className={
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition " +
                  (active ? "bg-field font-semibold text-ink" : "text-ink2 hover:text-ink")
                }
              >
                <Icon className={active ? "text-accent" : "text-ink3"} />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto hidden pt-6 md:block">
          <ConnectionStatus />
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <ThemeToggle />
            {!DEV_NO_CLERK && <UserButton />}
          </div>
        </div>
      </aside>

      <main id="main" className="min-w-0 px-5 py-8 md:px-12 md:py-12">
        <div className="mx-auto max-w-[880px]">
          <div className="mb-6 md:hidden">
            <ConnectionStatus />
          </div>

          {section === "overview" && <AppDashboard name={name} />}
          {section === "coach" && <AiCoach />}
          {section === "notebooks" && <NotebooksPanel />}
          {section === "progress" && <GamificationPanel />}
          {section === "backup" && <CloudSyncPanel />}
        </div>
      </main>
    </div>
  );
}
