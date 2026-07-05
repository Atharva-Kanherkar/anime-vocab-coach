"use client";

import { useState } from "react";
import { AppDashboard } from "@/components/app-dashboard";
import { AiCoach } from "@/components/ai-coach";
import { CloudSyncPanel } from "@/components/cloud-sync-panel";
import { ConnectionBanner } from "@/components/connection-banner";
import { GamificationPanel } from "@/components/gamification-panel";
import { NotebooksPanel } from "@/components/notebooks-panel";

const TABS = [
  { id: "home", label: "Home" },
  { id: "coach", label: "AI coach" },
  { id: "notebooks", label: "Notebooks" },
  { id: "progress", label: "Progress" },
  { id: "sync", label: "Sync" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AppWorkspace() {
  const [tab, setTab] = useState<TabId>("home");

  return (
    <div className="app-workspace">
      <ConnectionBanner onOpenSync={() => setTab("sync")} />

      <div className="app-tabs" role="tablist" aria-label="App sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            className={`app-tab${tab === item.id ? " is-active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        id="panel-home"
        role="tabpanel"
        aria-labelledby="tab-home"
        hidden={tab !== "home"}
        className="app-tab-panel"
      >
        <AppDashboard />
      </div>

      <div
        id="panel-coach"
        role="tabpanel"
        aria-labelledby="tab-coach"
        hidden={tab !== "coach"}
        className="app-tab-panel"
      >
        <AiCoach />
      </div>

      <div
        id="panel-notebooks"
        role="tabpanel"
        aria-labelledby="tab-notebooks"
        hidden={tab !== "notebooks"}
        className="app-tab-panel"
      >
        <NotebooksPanel />
      </div>

      <div
        id="panel-progress"
        role="tabpanel"
        aria-labelledby="tab-progress"
        hidden={tab !== "progress"}
        className="app-tab-panel"
      >
        <GamificationPanel />
      </div>

      <div
        id="panel-sync"
        role="tabpanel"
        aria-labelledby="tab-sync"
        hidden={tab !== "sync"}
        className="app-tab-panel"
      >
        <CloudSyncPanel />
      </div>
    </div>
  );
}
