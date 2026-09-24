// One loader for everything /owner shows, shared by the page and the AI
// insights route so "insights on what I can see" stays literally true: same
// window, same user, same exclusions (#163).

import { loadOwnerDashboard, type OwnerDashboardData } from "./owner-dashboard";
import { loadOwnerHistory, type OwnerHistory } from "./owner-history";
import { ownerScope, resolveExclusions, type Exclusions } from "./owner-exclusions";
import { loadPlanTags, type PlanTagCheck } from "./owner-plan-tags";

export interface OwnerView {
  data: OwnerDashboardData;
  history: OwnerHistory | null;
  exclusions: Exclusions;
  /** True when this render leaves the excluded accounts out. */
  excluding: boolean;
  /** Paid and gifted accounts next to the plan their calls carried (#163). */
  planTags: PlanTagCheck | null;
}

export async function loadOwnerView(opts: {
  hours: number;
  focusUser?: string;
  includeUs: boolean;
}): Promise<OwnerView> {
  const exclusions = await resolveExclusions();
  const scope = ownerScope({ ...opts, exclusions });
  const [data, history] = await Promise.all([
    loadOwnerDashboard(opts.hours, scope),
    opts.focusUser
      ? Promise.resolve(null)
      : loadOwnerHistory({ exclude: opts.includeUs ? [] : exclusions.ids }),
  ]);
  // Needs the Clerk accounts, so it runs after history. Two small queries, and
  // none at all when nobody holds a paid plan.
  const planTags =
    history && data.configured ? await loadPlanTags(opts.hours, history.planAccounts) : null;
  if (planTags?.failed.length) {
    const named = `query_failed (${planTags.failed.length}: ${planTags.failed.join(", ")})`;
    data.queryError = data.queryError ? `${data.queryError} · ${named}` : named;
  }

  return {
    data,
    history,
    exclusions,
    planTags,
    excluding: !opts.focusUser && !opts.includeUs && exclusions.ids.length > 0,
  };
}

/** One line saying whose numbers these are, for the page and the digest. */
export function scopeSentence(view: Pick<OwnerView, "excluding" | "exclusions">, focusUser?: string): string {
  if (focusUser) return "single learner, nobody excluded";
  if (!view.excluding) return "everyone, including the owner and test accounts";
  const n = view.exclusions.ids.length;
  return `excluding ${n} owner/test account${n === 1 ? "" : "s"}`;
}
