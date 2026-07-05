import { SignUp } from "@clerk/nextjs";
import { DEV_NO_CLERK } from "@/lib/dev-auth";

export default function SignUpPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
      {DEV_NO_CLERK ? (
        <p style={{ color: "#eef2fc" }}>
          Clerk is bypassed in dev. Go to <a href="/app" style={{ color: "#e3ba63" }}>/app</a>.
        </p>
      ) : (
        <SignUp />
      )}
    </div>
  );
}
