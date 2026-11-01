import { resolveProfile } from "@/lib/auth";
import { deleteLearnerAccount } from "@/lib/learn-lifecycle";
import { learnBody, learnFailure, learnJson } from "@/lib/learn-http";
export const dynamic = "force-dynamic";
export async function DELETE(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return learnJson({ error: "unauthorized" }, 401);
  try {
    if ((await learnBody(req, 100)).confirm !== "DELETE")
      return learnJson({ error: "confirmation_required" }, 400);
    await deleteLearnerAccount(profile.id);
    return learnJson({ ok: true });
  } catch (err) {
    return learnFailure(err);
  }
}
