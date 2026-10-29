import type { N5ExtensionState } from "../../shared/n5/contracts";
type Lesson = NonNullable<N5ExtensionState["lesson"]>;
/** Only original lesson targets are mounted, never captured dialogue or grades. */
export function mountN5Focus(lesson: Lesson, practise: () => Promise<void>, exit: () => void): () => void {
  const host = document.createElement("div"); host.id = "avc-n5-focus";
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `:host{all:initial;position:fixed;bottom:18px;left:18px;z-index:2147483646;font:14px/1.5 system-ui;color:#eee6da;width:min(320px,calc(100vw - 36px))}section{background:#151a21;border:1px solid #6d756e;border-radius:16px;padding:18px;box-shadow:0 12px 40px #0008}h2{font-size:16px;margin:4px 0}p{margin:8px 0}small{color:#bdc4c0}details{max-height:35vh;overflow:auto}summary,button{cursor:pointer}button{border:1px solid #a7b9b0;border-radius:7px;background:#cde4d8;color:#15221b;padding:9px 12px;margin:5px 4px 0 0;font:inherit}button:disabled{opacity:.6}button:focus-visible,summary:focus-visible{outline:3px solid #ffc26d}li{margin:9px 0}ul{padding-left:18px}.secondary{background:transparent;color:inherit}output{display:block;margin-top:8px}`;
  const panel = document.createElement("section"); panel.setAttribute("aria-label", "N5 lesson focus");
  const tag = document.createElement("small"); tag.textContent = `N5 private preview · ${lesson.script}`;
  const title = document.createElement("h2"); title.textContent = lesson.canDo;
  const note = document.createElement("p"); note.textContent = "Original practice examples. Live overlays are paused during course focus.";
  const details = document.createElement("details");
  const summary = document.createElement("summary"); summary.textContent = "Lesson words and examples";
  const list = document.createElement("ul");
  for (const v of lesson.vocabulary) {
    const li = document.createElement("li"), word = document.createElement("strong"), meaning = document.createElement("span");
    word.textContent = v.reading; word.dataset.n5Japanese = ""; if (lesson.script === "kana") word.lang = "ja";
    meaning.textContent = " · " + v.meaning; li.append(word, meaning); list.append(li);
  }
  for (const g of lesson.grammar) {
    const li = document.createElement("li"), example = document.createElement("strong"), explanation = document.createElement("p");
    example.textContent = g.example; example.dataset.n5Japanese = ""; if (lesson.script === "kana") example.lang = "ja";
    explanation.textContent = g.explanation; li.append(example, explanation); list.append(li);
  }
  details.append(summary, list);
  const finish = document.createElement("button"); finish.textContent = "Finish episode and practise";
  const leave = document.createElement("button"); leave.className = "secondary"; leave.textContent = "Exit course focus";
  const status = document.createElement("output"); status.setAttribute("aria-live", "polite");
  finish.onclick = async () => { finish.disabled = true; status.textContent = "Pausing playback and stopping audio capture…"; try { await practise(); status.textContent = "Practice opened. Resume playback yourself when ready."; } catch (e) { status.textContent = e instanceof Error ? e.message : "Please retry."; } finally { finish.disabled = false; } };
  leave.onclick = exit;
  panel.append(tag, title, note, details, finish, leave, status); root.append(style, panel); document.documentElement.append(host);
  return () => host.remove();
}
