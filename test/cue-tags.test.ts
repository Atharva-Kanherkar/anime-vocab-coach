import { describe, it, expect } from "vitest";
import { normalize, stripCueTags } from "../src/lib/adapters/util";

/** What the generic adapter actually does with a cue: strip, then normalize. */
const cue = (text: string): string => normalize(stripCueTags(text));

describe("stripCueTags", () => {
  describe("separator tags keep the words apart", () => {
    it("treats <br> as the line break it stands in for", () => {
      expect(cue("went home<br>since then")).toBe("went home since then");
    });

    it("accepts the self-closing and spaced spellings", () => {
      expect(cue("a<br/>b")).toBe("a b");
      expect(cue("a<br />b")).toBe("a b");
      expect(cue("a<BR>b")).toBe("a b");
    });

    it("treats block wrappers as separators too", () => {
      expect(cue("<p>first line</p><p>second line</p>")).toBe("first line second line");
      expect(cue("<div>first</div><div>second</div>")).toBe("first second");
    });

    it("leaves no doubled or edge whitespace behind", () => {
      expect(cue("<br>a<br><br>b<br>")).toBe("a b");
    });
  });

  describe("inline tags never invent a word boundary", () => {
    // WebVTT's own spans are styling, not segmentation: the words they wrap
    // are the same words with or without them.
    it("keeps an English word whole when markup splits it", () => {
      expect(cue("un<i>believ</i>able")).toBe("unbelievable");
      expect(cue("<b>Home</b>coming")).toBe("Homecoming");
    });

    it("does not space out Japanese, which is written without spaces", () => {
      expect(cue("もう<i>二度と</i>会えない")).toBe("もう二度と会えない");
      expect(cue("<c.yellow>お前</c>は誰だ")).toBe("お前は誰だ");
      expect(cue("お<i>前</i>は誰だ")).toBe("お前は誰だ");
    });

    it("drops voice, class, lang and karaoke timestamp tags", () => {
      expect(cue("<v 主人公>行くぞ")).toBe("行くぞ");
      expect(cue("<lang ja>ありがとう</lang>")).toBe("ありがとう");
      expect(cue("Hello <00:00:01.500><c>world</c>")).toBe("Hello world");
    });

    it("does not mistake a p-initial tag name for a block tag", () => {
      // <person> is not <p>; \b in the separator pattern has to hold the line.
      expect(cue("mid<person>dle")).toBe("middle");
      expect(cue("bro<brand>ken")).toBe("broken");
      expect(cue("di<divider>vide")).toBe("divide");
    });
  });

  describe("cue text that carries no markup", () => {
    it("passes plain text through untouched", () => {
      expect(cue("こんな退屈な毎日はもう嫌だ")).toBe("こんな退屈な毎日はもう嫌だ");
    });

    it("still collapses the literal newline WebVTT really uses", () => {
      expect(cue("went home\nsince then")).toBe("went home since then");
    });

    it("handles an empty cue", () => {
      expect(cue("")).toBe("");
      expect(cue("<i></i>")).toBe("");
    });
  });
});
