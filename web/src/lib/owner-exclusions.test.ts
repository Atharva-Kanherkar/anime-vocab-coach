import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ clerkClient: async () => ({}) }));

const {
  MAX_EXCLUDED,
  excludedEmailList,
  excludedIdList,
  includeUsParam,
  ownerScope,
  resolveExclusions,
} = await import("./owner-exclusions");
const { OWNER_EMAILS } = await import("./entitlements");
const { DEV_PROFILE } = await import("./dev-auth");

/** Issue #163: whose traffic /owner leaves out, and how it fails. */

afterEach(() => {
  delete process.env.OWNER_EXCLUDE_EMAILS;
  delete process.env.OWNER_EXCLUDE_USER_IDS;
});

describe("excludedEmailList", () => {
  it("is the owners plus the test accounts, lowercased and deduplicated", () => {
    const list = excludedEmailList(` Tester@Example.com, tester@example.com ,${OWNER_EMAILS[0]!.toUpperCase()}`);
    expect(list).toEqual([...OWNER_EMAILS.map((e) => e.toLowerCase()), "tester@example.com"]);
  });

  it("drops anything that is not an email", () => {
    expect(excludedEmailList("nope, @x.com, a@b, two words@x.io")).toEqual(
      OWNER_EMAILS.map((e) => e.toLowerCase())
    );
  });
});

describe("excludedIdList", () => {
  it("keeps valid Clerk ids once", () => {
    expect(excludedIdList("user_abc, user_abc,user_DEF9")).toEqual(["user_abc", "user_DEF9"]);
  });

  it("drops anything that is not a Clerk id", () => {
    expect(excludedIdList("anon, user_, user_a'b, dev-user, 123")).toEqual([]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: 80 }, (_, i) => `user_${i}`).join(",");
    expect(excludedIdList(many)).toHaveLength(MAX_EXCLUDED);
  });
});

describe("resolveExclusions", () => {
  it("resolves owner emails to Clerk ids and adds the env ids", async () => {
    process.env.OWNER_EXCLUDE_USER_IDS = "user_tester";
    const find = vi.fn(async () => [{ id: "user_owner", email: OWNER_EMAILS[0]! }]);
    const out = await resolveExclusions(find, false);
    expect(find).toHaveBeenCalledWith(OWNER_EMAILS.map((e) => e.toLowerCase()));
    expect(out).toEqual({ ids: ["user_owner", "user_tester"], emails: [OWNER_EMAILS[0]] });
  });

  it("keeps the env ids and says so when Clerk fails, never silently including us", async () => {
    process.env.OWNER_EXCLUDE_USER_IDS = "user_tester";
    const out = await resolveExclusions(async () => {
      throw new Error("clerk down");
    }, false);
    expect(out.ids).toEqual(["user_tester"]);
    expect(out.note).toMatch(/clerk down/);
    expect(out.note).toMatch(/may include them/);
  });

  it("excludes the dev profile under the dev bypass, without calling Clerk", async () => {
    const find = vi.fn();
    const out = await resolveExclusions(find, true);
    expect(find).not.toHaveBeenCalled();
    expect(out.ids).toEqual([DEV_PROFILE.id]);
  });
});

describe("ownerScope", () => {
  const exclusions = { ids: ["user_owner"], emails: [] };
  it("excludes by default", () => {
    expect(ownerScope({ includeUs: false, exclusions })).toEqual({ exclude: ["user_owner"] });
  });
  it("includes everyone with ?all=1", () => {
    expect(ownerScope({ includeUs: true, exclusions })).toEqual({ exclude: [] });
  });
  it("never excludes on the drill-down", () => {
    expect(ownerScope({ focusUser: "user_owner", includeUs: false, exclusions })).toBe("user_owner");
  });
  it("reads the toggle strictly", () => {
    expect(includeUsParam("1")).toBe(true);
    expect(includeUsParam(true)).toBe(true);
    expect(includeUsParam("0")).toBe(false);
    expect(includeUsParam(undefined)).toBe(false);
    expect(includeUsParam("yes")).toBe(false);
  });
});
