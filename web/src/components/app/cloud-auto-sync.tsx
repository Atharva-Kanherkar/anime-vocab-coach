"use client";

import { useAutoCloudSync } from "@/lib/cloud-snapshot-store";

/** Invisible hook mount — keeps dashboard data fresh from the server. */
export function CloudAutoSync() {
  useAutoCloudSync();
  return null;
}
