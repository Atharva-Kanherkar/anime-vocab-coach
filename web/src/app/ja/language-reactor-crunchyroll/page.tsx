import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { JaClosingCta, JaHubFooter, JaPageShell } from "@/components/ja-landing-chrome";
import { jaArticleJsonLd, jaPageMetadata } from "@/lib/ja-seo";
import { faqJsonLd } from "@/lib/seo";

const path = "/ja/language-reactor-crunchyroll";

const DESC =
  "Language Reactor は Crunchyroll 対応？ 2026年の答え：非対応（Netflix / YouTube のみ）。Crunchyroll で日本語を学ぶ代替ツール。";

export const metadata: Metadata = jaPageMetadata({
  path,
  title: "Language Reactor は Crunchyroll で使える？（2026：いいえ）",
  description: DESC,
  keywords: [
    "does language reactor work on crunchyroll",
    "language reactor crunchyroll",
    "Language Reactor Crunchyroll 使えない",
  ],
  enAlternate: "/does-language-reactor-work-on-crunchyroll",
});

const faqs = [
  {
    question: "Language Reactor は Crunchyroll で使えますか？",
    answer:
      "いいえ。Language Reactor は Netflix と YouTube 向けに作られており、Crunchyroll は公式サポート外です。フォーラムでも Crunchyroll 対応は長年要望のみ。",
  },
  {
    question: "Crunchyroll では何を使えばいい？",
    answer:
      "ひらがなが読めない初心者 → AnimeVocab（Listening Mode + ローマ字カード）。読める人 → Lexirise や ManabiDojo。上級者 → ファン字幕 + Substital / Jimaku。",
  },
];

export default function JaLanguageReactorCrunchyrollPage() {
  const faqLd = faqJsonLd(faqs);
  const jsonLd = jaArticleJsonLd({ path, title: "Language Reactor × Crunchyroll", description: DESC });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <JaPageShell>
        <main id="main">
          <Breadcrumbs
            items={[{ href: "/ja", label: "日本語ガイド" }, { label: "LR × Crunchyroll" }]}
            currentPath={path}
          />

          <CompareHero
            title="Language Reactor は Crunchyroll で使える？"
            lede={
              <>
                「<strong>does language reactor work on crunchyroll</strong>」— 日本からもこの英語クエリが来ています。
                短答：<strong>いいえ</strong>。LR は二重字幕リーダーとして Netflix / YouTube 専用です。
              </>
            }
            verdictTag="代替"
            verdict={
              <>
                Crunchyroll の simulcast 夜は <strong>AnimeVocab</strong>（日本語字幕がなくても Listening Mode）。
                Netflix 夜は LR のまま — 使い分けが普通です。
                英語版：<Link href="/does-language-reactor-work-on-crunchyroll">Does LR work on CR? (EN)</Link>
              </>
            }
          />

          <section style={{ paddingTop: 0 }}>
            <div className="wrap prose">
              <h2>なぜ Crunchyroll 非対応か</h2>
              <ul>
                <li>日本国外では英語字幕のみの作品が多い → 二重字幕の前提が崩れる</li>
                <li>Crunchyroll プレイヤーは Netflix と API が異なる</li>
                <li>LR 開発側も Crunchyroll 優先度は低い（フォーラム要望のみ）</li>
              </ul>
              <p>
                詳細比較：<Link href="/ja/vs-language-reactor">AnimeVocab vs Language Reactor（日本語）</Link>
                · <Link href="/language-reactor-alternative-crunchyroll">LR alternative for CR (EN)</Link>
              </p>
            </div>
          </section>

          <JaClosingCta mode="en-ja" headline="Crunchyroll でも LR なしで日本語を学べる。" />
        </main>
        <JaHubFooter />
      </JaPageShell>
    </>
  );
}
