import { describe,it,expect,vi,beforeEach } from "vitest";
const mocks = vi.hoisted(()=>({read:vi.fn(),apply:vi.fn(),legacy:vi.fn(),kv:vi.fn()}));
vi.mock("@opennextjs/cloudflare",()=>({getCloudflareContext:async()=>({env:{LEARN_DB:{}}})}));
vi.mock("./learn-store",()=>({LearnStore:class {read=mocks.read;apply=mocks.apply;}}));
vi.mock("./sync-store",()=>({getLegacyCloudSyncEnvelope:mocks.legacy,resolveStore:async()=>({get:mocks.kv})}));
import { getLearnStore } from "./learn-server";
import { normalizeAnimeVocabExport } from "./sync";
beforeEach(()=>{vi.clearAllMocks();mocks.read.mockResolvedValue({migrated:false});mocks.kv.mockResolvedValue(null);mocks.legacy.mockResolvedValue({snapshot:normalizeAnimeVocabExport({settings:{openaiKey:"private",subLens:false},vocab:{猫:{state:"known",reading:"neko",gloss:"cat"}}})});});
describe("one-time legacy migration",()=>{
  it("imports stable operations, excludes secrets, and marks completion last",async()=>{
    await getLearnStore("a");
    const first = structuredClone(mocks.apply.mock.calls);
    expect(JSON.stringify(first)).not.toContain("private");
    expect(first[0][0][0]).toMatchObject({kind:"import_local",payload:{word:{base:"猫"}}});
    expect(first.at(-1)?.[1]).toEqual({migrated:true});
    mocks.apply.mockClear(); await getLearnStore("a");
    expect(mocks.apply.mock.calls).toEqual(first);
  });
  it("does not reread KV or reimport after migration",async()=>{
    mocks.read.mockResolvedValue({migrated:true});
    await getLearnStore("a");
    expect(mocks.legacy).not.toHaveBeenCalled();expect(mocks.apply).not.toHaveBeenCalled();
  });
});
