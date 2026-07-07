"use client";

// In-app (/app#studio) mount of the Manga Studio. The whole editor lives in
// studio-editor.tsx and is shared with the public /studio front door.

import { StudioEditor } from "@/components/app/studio-editor";

export function StudioPanel() {
  return <StudioEditor />;
}
