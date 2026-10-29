/** Serialize read/modify/write so a pending start cannot overwrite an acknowledged stop. */
export function listeningRegistry(
  read: () => Promise<Record<number, boolean>>,
  write: (tabs: Record<number, boolean>) => Promise<void>,
) {
  let tail: Promise<unknown> = Promise.resolve();
  return (tabId: number, active: boolean, current: () => boolean = () => true): Promise<boolean> => {
    const update = tail.then(async () => {
      const tabs = await read();
      if (!current()) return false;
      if (active) tabs[tabId] = true; else delete tabs[tabId];
      await write(tabs);
      return current();
    });
    tail = update.catch(() => {});
    return update;
  };
}

/** A stopped start must never be retried after the offscreen document finishes loading. */
export async function retryCaptureStart(
  send: () => Promise<{ ok: boolean; error?: string } | undefined>,
  current: () => boolean,
  wait: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 200)),
): Promise<{ ok: boolean; error?: string }> {
  for (let i = 0; i < 15; i++) {
    if (!current()) return { ok: false, error: "Listening start was cancelled." };
    try {
      const response = await send();
      if (response) return response;
    } catch { /* The offscreen listener may still be loading. */ }
    await wait();
  }
  throw new Error("offscreen document never acknowledged (audio capture could not start)");
}
