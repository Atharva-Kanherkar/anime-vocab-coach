import { currentUser } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { DEV_NO_CLERK, DEV_PROFILE } from "@/lib/dev-auth";
import { n5Config } from "@/lib/n5/server";
import { CourseSession } from "@/components/n5/common";
import type { ReactNode } from "react";
import "./n5.css";
export const dynamic = "force-dynamic";
export default async function CourseLayout({ children }: { children: ReactNode }) {
  if (!(await n5Config()).enabled) notFound();
  const ownerId = DEV_NO_CLERK ? DEV_PROFILE.id : (await currentUser())?.id;
  if (!ownerId) redirect("/sign-in");
  return <CourseSession key={ownerId} ownerId={ownerId}>{children}</CourseSession>;
}
