import { GITHUB_URL } from "@/lib/site";

const STEPS = [
  {
    n: "01",
    title: "Install the extension",
    body: "One click. It works on Crunchyroll, Netflix, and YouTube — nothing else to set up.",
  },
  {
    n: "02",
    title: "Play anime with subtitles",
    body: "A quiet sidebar fades in. As each line is spoken, the word worth learning surfaces with its reading and meaning.",
  },
  {
    n: "03",
    title: "Tap Know or Learn",
    body: "Words you save sync straight here — reviews, the coach, your rally, and your card collection fill in on their own.",
  },
];

// New-user onboarding: the numbered loop plus a speech-bubble replica of the
// in-video card, so people see the product instead of reading about it.
export function GettingStarted() {
  return (
    <section aria-label="Getting started">
      <p className="av-eyebrow">Start here · はじめに</p>
      <h2 className="mt-2 font-jpround text-[clamp(24px,3.5vw,32px)] font-black leading-tight">
        Turn the anime you already watch into vocabulary
      </h2>

      <div className="mt-9 grid gap-x-14 gap-y-10 md:grid-cols-[1fr_320px]">
        <ol>
          {STEPS.map((step, i) => (
            <li key={step.n} className={"flex gap-5 py-4 " + (i > 0 ? "border-t border-dashed border-line" : "pt-0")}>
              <span className="font-jpround text-lg font-black text-accent tabular-nums">{step.n}</span>
              <div>
                <h3 className="text-[15px] font-extrabold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink2">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div>
          <p className="av-eyebrow mb-3">What you'll see</p>
          <div className="av-bubble !p-5">
            <p className="text-[10.5px] font-extrabold tracking-[0.16em] text-indigo">NOW PLAYING · EPISODE 3</p>
            <p className="mt-3 font-jp text-lg leading-relaxed">
              今日は<span className="font-bold text-accent">約束</span>を守る。
            </p>
            <p className="mt-1.5 font-jp text-sm text-ink2">やくそく · a promise</p>
            <div className="mt-4 flex gap-2">
              <span className="rounded-full border-2 border-ink px-3.5 py-1 text-xs font-extrabold">Know</span>
              <span className="rounded-full bg-accent px-3.5 py-1 text-xs font-extrabold text-[#fffdf6]">Learn</span>
              <span className="rounded-full border border-line px-3.5 py-1 text-xs text-ink3">Skip</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <a href={GITHUB_URL} rel="noopener noreferrer" className="av-btn av-btn-primary">
          Add to Chrome
        </a>
        <span className="text-[13px] text-ink3">Free — and your saved words stay local and exportable.</span>
      </div>
    </section>
  );
}
