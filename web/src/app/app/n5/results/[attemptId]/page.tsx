import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DEV_NO_CLERK, DEV_PROFILE } from "@/lib/dev-auth";
import { CourseAttempt } from "@/components/n5/attempt";
export default async function Page({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const ownerId = DEV_NO_CLERK ? DEV_PROFILE.id : (await currentUser())?.id;
  if (!ownerId) redirect("/sign-in");
  return <CourseAttempt key={attemptId} attemptId={attemptId} ownerId={ownerId} />;
}
