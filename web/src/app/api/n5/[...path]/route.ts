import { gateway } from "@/lib/n5/server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(req: Request, context: Context) { return gateway(req, (await context.params).path); }
export { handle as GET, handle as POST, handle as DELETE };
