import { n5OwnerId } from "@/lib/n5/server";
import { redirect } from "next/navigation";
import { CourseLesson } from "@/components/n5/lesson";
export default async function Page({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const ownerId = await n5OwnerId();
  if (!ownerId) redirect("/sign-in");
  return <CourseLesson key={lessonId} lessonId={lessonId} ownerId={ownerId} />;
}
