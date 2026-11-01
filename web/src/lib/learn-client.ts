"use client";
import { newLearnOp } from "./learn-protocol/model";
import { refreshCloudFromServer } from "./cloud-snapshot-store";
export async function saveLearningSettings(
  settings: Record<string, unknown>,
): Promise<void> {
  const op = newLearnOp("settings", { settings });
  // A transport retry uses the same operation identity, even when the first
  // response was lost after the server committed it.
  let response: Response | undefined;
  for (let i = 0; i < 2; i++) {
    try {
      response = await fetch("/api/learn/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops: [op] }),
      });
      break;
    } catch (err) {
      if (i === 1) throw err;
    }
  }
  if (!response?.ok)
    throw new Error("Couldn't save settings. Please try again.");
  await refreshCloudFromServer({ silent: false });
  window.postMessage(
    { source: "avc-web", type: "avc-settings-updated" },
    window.location.origin,
  );
}
