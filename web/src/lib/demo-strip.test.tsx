// Unit test for the feature demo strip (contract revision 2): the five demo
// panels must ship their copy + interactive affordances in the server HTML.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DemoStrip } from "@/components/demo-strip";

const html = renderToStaticMarkup(<DemoStrip />).replace(/&#x27;/g, "'");

describe("DemoStrip server render (feature demos)", () => {
  it("renders the section with the demo anchor", () => {
    expect(html).toContain('id="demo"');
    expect(html).toContain("See it work");
  });

  it("renders all five feature panels", () => {
    for (const title of [
      "One word per line, pushed to you",
      "Works when there are no Japanese subtitles",
      "An AI coach that knows the scene",
      "Reviews find you in the next episode",
      "Every word you learn is XP",
    ]) {
      expect(html, `missing panel: ${title}`).toContain(title);
    }
  });

  it("ships demo vocabulary as real text", () => {
    expect(html).toContain("退屈");
    expect(html).toContain("taikutsu");
    expect(html).toContain("mabushii");
    expect(html).toContain("zutto");
    expect(html).toContain("Lv 4");
  });

  it("renders real interactive affordances (buttons, not decorative spans)", () => {
    expect(html).toContain("Replay");
    expect(html).toContain("Pause");
    expect(html).toContain("tap to reveal");
    expect(html).toContain("aria-label=\"Next demo\"");
    expect(html.match(/<button/g)?.length).toBeGreaterThan(8);
  });

  it("renders the first coach question and answer", () => {
    expect(html).toContain("What does 退屈 mean here?");
    // the answer streams word-by-word, so assert on fragments, not the line
    expect(html).toContain("(taikutsu)");
    expect(html).toContain("boredom.");
  });

  it("renders the active review card with its next-review interval", () => {
    expect(html).toContain("Due now · again · 1d");
    expect(html).toContain("tap to reveal");
  });
});
