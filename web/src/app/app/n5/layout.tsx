import { notFound, redirect } from "next/navigation";
import { n5OwnerId, n5AvailableFor } from "@/lib/n5/server";
import { CourseSession } from "@/components/n5/common";
import type { ReactNode } from "react";
import "./n5.css";
export const dynamic = "force-dynamic";
export default async function CourseLayout({ children }: { children: ReactNode }) {
  const ownerId = await n5OwnerId();
  if (!ownerId) redirect("/sign-in");
  if (!(await n5AvailableFor(ownerId))) notFound();
  return <CourseSession key={ownerId} ownerId={ownerId}>{children}</CourseSession>;
}
