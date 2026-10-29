import { n5OwnerId } from "@/lib/n5/server";
import { redirect } from "next/navigation";
import { CourseAttempt } from "@/components/n5/attempt";
export default async function Page({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const ownerId = await n5OwnerId();
  if (!ownerId) redirect("/sign-in");
  return <CourseAttempt key={attemptId} attemptId={attemptId} ownerId={ownerId} />;
}
