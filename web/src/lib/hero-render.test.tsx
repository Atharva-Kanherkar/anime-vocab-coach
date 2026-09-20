// Unit test for the homepage hero render (issues #115 + #117): the entire
// slide narrative must exist in the server HTML, and the first slide must
// carry a real, textual product mockup. Rendered with react-dom/server —
// exactly what a no-JS fetch (curl / Googlebot) sees.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FxSlider } from "@/components/fx-slider";
import { heroSlides } from "@/lib/slides";

// next/link needs the App Router runtime; the anchor output is all the hero
// depends on. Clerk's <Show>/<SignInButton>/<SignUpButton>/<UserButton> need
// the ClerkProvider context; the hero only renders sign-in affordances.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@clerk/nextjs", () => ({
  Show: () => null,
  SignInButton: () => null,
  SignUpButton: () => null,
  UserButton: () => null,
}));

function renderHero(): string {
  return renderToStaticMarkup(<FxSlider slides={heroSlides} />);
}

describe("FxSlider server render (crawlable hero, #115)", () => {
  // react-dom/server escapes apostrophes (&#x27;); decode for copy matching.
  const html = renderHero().replace(/&#x27;/g, "'");

  it("renders all 13 slide titles", () => {
    for (const slide of heroSlides) {
      if (!slide.title) continue;
      expect(html, `missing slide "${slide.id}" title`).toContain(slide.title);
    }
  });

  it("renders slide bodies, not just the first", () => {
    expect(html).toContain("Listening Mode transcribes audio");
    expect(html).toContain("Spaced repetition resurfaces words");
    expect(html).toContain("Pick up to three words");
    expect(html).toContain("Words stay on your device");
  });

  it("renders the pricing slide content", () => {
    expect(html).toContain("Full pricing, regional prices, and billing FAQ");
    expect(html).toContain("The whole game — cards, manga, coach, reviews — is free.");
  });

  it("renders the FAQ slide questions", () => {
    expect(html).toContain("Can I learn Japanese just by watching anime?");
    expect(html).toContain("Where is my data stored?");
  });

  it("uses exactly one h1 (slide 1) and h2 for the rest", () => {
    expect(html.match(/<h1/g)?.length).toBe(1);
    expect(html).toContain("<h1");
    expect(html.match(/<h2/g)?.length).toBe(heroSlides.filter((s) => s.title).length - 1);
  });

  it("gives every slide a crawlable anchor id", () => {
    for (const slide of heroSlides) {
      expect(html, `id="slide-${slide.id}" missing`).toContain(`id="slide-${slide.id}"`);
    }
  });

  it("marks only the first slide active server-side", () => {
    const active = html.match(/hero__center[^"]*is-active/g) ?? [];
    expect(active.length).toBe(1);
    expect(html).toContain("id=\"slide-watch\"");
  });
});

describe("Product shot (product visual above the fold, #117)", () => {
  const html = renderHero().replace(/&#x27;/g, "'");

  it("renders the full-screen mockup inside the first slide", () => {
    expect(html).toContain("hero__split");
    expect(html).toContain("hero__copy");
    expect(html).toContain("class=\"shot\"");
    expect(html).toContain("hero__cta");
  });

  it("shows the demo word with romaji and meaning as real text", () => {
    expect(html).toContain("退屈");
    expect(html).toContain("たいくつ");
    expect(html).toContain("taikutsu");
    expect(html).toContain("<strong>boredom</strong>");
    expect(html).toContain("In this line");
    expect(html).toContain("Know it");
  });

  it("shows the scene image with descriptive alt text", () => {
    expect(html).toMatch(/<img[^>]*shot__art[^>]*alt="Anime scene[^"]*"/);
  });

  it("shows the AI coach exchange explaining the word", () => {
    expect(html).toContain("What does 退屈 mean here?");
    expect(html).toContain("(taikutsu) — “boredom”");
    expect(html).toContain("退屈な夜 = “a boring night”");
  });

  it("carries a caption explaining how the product works", () => {
    expect(html).toContain("One word per line, in romaji");
  });
});
