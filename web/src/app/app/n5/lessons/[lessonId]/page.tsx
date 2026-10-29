import { n5OwnerId } from "@/lib/n5/server";
import { notFound, redirect } from "next/navigation";
import { CourseLesson } from "@/components/n5/lesson";
export default async function Page({ params, searchParams }: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ script?: string | string[] }>;
}) {
  const { lessonId } = await params;
  const { script } = await searchParams;
  if (script !== undefined && script !== "romaji" && script !== "kana") notFound();
  const ownerId = await n5OwnerId();
  if (!ownerId) redirect("/sign-in");
  return <CourseLesson key={`${lessonId}:${script ?? "current"}`} lessonId={lessonId} ownerId={ownerId} script={script} />;
}
