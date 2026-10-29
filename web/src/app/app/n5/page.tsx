import { CourseHub } from "@/components/n5/hub";
import { n5OwnerId } from "@/lib/n5/server";
export const metadata = { title: "Japanese N5 with Your Lie in April | AnimeVocab" };
export default async function CoursePage() {
  return <CourseHub ownerId={(await n5OwnerId()) ?? ""} />;
}
