import { n5OwnerId } from "@/lib/n5/server";
import { redirect } from "next/navigation";
import { CourseSpeak } from "@/components/n5/speak";
export const metadata = { title: "Speak with Haru | AnimeVocab N5" };
export default async function Page({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const ownerId = await n5OwnerId();
  if (!ownerId) redirect("/sign-in");
  return <CourseSpeak key={lessonId} lessonId={lessonId} ownerId={ownerId} />;
}
