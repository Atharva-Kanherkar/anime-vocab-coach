"use client";

// In-app (/app#studio) mount of the creative Manga Studio. The whole editor
// lives in studio-editor.tsx and is shared with the public /studio front door.

import { StudioEditor } from "@/components/app/studio-editor";

export function StudioPanel({ signedIn = true }: { signedIn?: boolean }) {
  return <StudioEditor signedIn={signedIn} />;
}
