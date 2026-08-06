import type { Metadata } from "next";
import "./owner.css";

export const metadata: Metadata = {
  title: "Owner",
  // Internal tooling: keep it out of search results even though it 404s for
  // everyone else. robots.ts blocks the path too; this is the belt to that
  // suspenders, since a metadata tag survives a robots.txt someone forgets.
  robots: { index: false, follow: false },
};

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <div className="ow-page">{children}</div>;
}
