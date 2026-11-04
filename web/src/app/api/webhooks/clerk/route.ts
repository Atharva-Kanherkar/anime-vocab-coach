import type { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { deleteLearnerAccount } from "@/lib/learn-lifecycle";
import { learnFailure, learnJson } from "@/lib/learn-http";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    event = await verifyWebhook(req);
  } catch {
    return learnJson({ error: "invalid_signature" }, 400);
  }
  try {
    if (event.type === "user.deleted" && event.data.id)
      await deleteLearnerAccount(event.data.id);
    return learnJson({ ok: true });
  } catch (err) {
    return learnFailure(err);
  }
}
