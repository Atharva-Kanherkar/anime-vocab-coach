import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DEV_NO_CLERK, DEV_PROFILE } from "@/lib/dev-auth";
import { CourseLesson } from "@/components/n5/lesson";
export default async function Page({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const ownerId = DEV_NO_CLERK ? DEV_PROFILE.id : (await currentUser())?.id;
  if (!ownerId) redirect("/sign-in");
  return <CourseLesson key={lessonId} lessonId={lessonId} ownerId={ownerId} />;
}
