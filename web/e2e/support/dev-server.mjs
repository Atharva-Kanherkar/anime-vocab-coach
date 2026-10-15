// Stop a `next dev` this suite spawned, for real.
//
// The suites spawn `npx next dev`. Killing that pid only stops npx: on Linux
// the next-server it started keeps running and keeps the stdout/stderr pipes
// open, so this node process never exits. In CI that hung the web-e2e job for
// 40 minutes after observability had already passed. Spawn with
// `detached: true` (its own process group), then signal the whole group.
export function stopDevServer(server) {
  if (!server || server.exitCode !== null) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    try {
      server.kill("SIGTERM");
    } catch {
      // already gone
    }
  }
  server.stdout?.destroy();
  server.stderr?.destroy();
}
