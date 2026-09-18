/**
 * The chrome-facing half of first-run onboarding (issue #77).
 *
 * Kept apart from `onboarding.ts` so the rules stay unit-testable without a
 * chrome stub, and so the hot paths that call `stampOnboarding` (every subtitle
 * line, every card) import only what they need.
 */
import { warn } from "./log";
import { trackExtensionMilestone } from "./extension-events";
import {
  ONBOARDING_STORAGE_KEY,
  normalizeOnboarding,
  applyStamp,
  type OnboardingStamp,
  type OnboardingState,
} from "./onboarding";

/**
 * Own serial queue, separate from storage.ts's. The stamps live under their own
 * key, and `recordSeen` fires on every subtitle line — two concurrent
 * read-modify-writes would let one of them drop the other's stamp.
 */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch((err) => warn("onboarding storage error:", err));
  return next;
}

/**
 * Reads go through the same queue as writes. Stamps are fired and forgotten
 * from the mining paths (`void stampOnboarding(...)`), so without FIFO
 * ordering a popup opened on the same tick as a save could read the state from
 * just before the save and render a checklist the learner has already beaten.
 */
export function getOnboarding(): Promise<OnboardingState> {
  return enqueue(async () => {
    try {
      return await readState();
    } catch {
      return normalizeOnboarding(null);
    }
  });
}

async function readState(): Promise<OnboardingState> {
  const r = await chrome.storage.local.get([ONBOARDING_STORAGE_KEY]);
  return normalizeOnboarding(r[ONBOARDING_STORAGE_KEY]);
}

/** One read-modify-write. True when this call is the one that set the field. */
async function writeStamp(field: OnboardingStamp, now: number): Promise<boolean> {
  const state = await readState();
  const next = applyStamp(state, field, now);
  if (next === state) return false;
  await chrome.storage.local.set({ [ONBOARDING_STORAGE_KEY]: next });
  return true;
}

/**
 * Write-once stamp. Returns true only for the call that actually set it, so a
 * caller can hang a one-shot side effect (an event, a 🎉) off the return value.
 * Never throws — onboarding bookkeeping must not break mining or playback.
 *
 * The queue above only serialises this context. This key is also written by the
 * service worker, the welcome page, the popup and every content script, and
 * chrome.storage.local has no compare-and-set — so a read-modify-write
 * elsewhere can drop the stamp we just made. It happens on the one path that
 * matters most: the install handler stamps `installedAt` while the welcome tab
 * it just opened is stamping `shownAt`, and losing `installedAt` would mean the
 * 24h checklist never appears for that install.
 *
 * Stamps are write-once and monotonic, so re-applying one is always safe.
 * Verify the write landed and merge ours back in if it did not; the other
 * writer's own verify pass restores theirs, so both converge.
 */
export function stampOnboarding(field: OnboardingStamp, now = Date.now()): Promise<boolean> {
  return enqueue(async () => {
    try {
      if (!(await writeStamp(field, now))) return false;
      if ((await readState())[field] === 0) await writeStamp(field, now);
      return true;
    } catch {
      return false;
    }
  });
}

/** Welcome page paint: stamp it and count it, once per install. */
export async function recordOnboardingShown(now = Date.now()): Promise<void> {
  if (await stampOnboarding("shownAt", now)) {
    await trackExtensionMilestone("onboarding_shown");
  }
}
