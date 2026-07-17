import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { JaClosingCta, JaHubFooter, JaPageShell } from "@/components/ja-landing-chrome";
import { jaArticleJsonLd, jaPageMetadata } from "@/lib/ja-seo";
import { faqJsonLd } from "@/lib/seo";

const path = "/ja/yomitan-netflix";

const DESC =
  "Yomitan + Netflix の組み合わせ（2026）。Yomitan はブラウザ辞書 — Netflix 単体では mining ループが完結しない。初心者向け代替。";

export const metadata: Metadata = jaPageMetadata({
  path,
  title: "Yomitan × Netflix — アニメ日本語学習の現実（2026）",
  description: DESC,
  keywords: ["yomitan netflix", "Yomitan Netflix", "Netflix 日本語 拡張機能"],
  enAlternate: "/learn-japanese-netflix-anime",
});

const faqs = [
  {
    question: "Yomitan は Netflix で使えますか？",
    answer:
      "Yomitan 自体はページ上の日本語テキストにホバーする辞書拡張。Netflix では日本語字幕が取れない・読めない場面が多く、Yomitan だけでは「1語ずつ + 復習」ループが自動化されない。asbplayer + Anki 等の上級スタックが別途必要。",
  },
  {
    question: "Netflix で初心者は何を使うべき？",
    answer:
      "ひらがなが読めない → AnimeVocab（ローマ字カード + Listening Mode）。読める → Language Reactor や HASHIGO。Yomitan は中級 mining 向け。",
  },
];

export default function JaYomitanNetflixPage() {
  const faqLd = faqJsonLd(faqs);
  const jsonLd = jaArticleJsonLd({ path, title: "Yomitan × Netflix", description: DESC });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <JaPageShell>
        <main id="main">
          <Breadcrumbs
            items={[{ href: "/ja", label: "日本語ガイド" }, { label: "Yomitan × Netflix" }]}
            currentPath={path}
          />

          <CompareHero
            title="Yomitan × Netflix"
            lede={
              <>
                「<strong>yomitan netflix</strong>」— 日本からの検索もあります。
                Yomitan は<strong>強力な辞書</strong>ですが、Netflix アニメ学習の<strong>一式ではありません</strong>。
                字幕 mining + Anki まで自分で組む必要があります。
              </>
            }
            verdictTag="初心者向け"
            verdict={
              <>
                スタックを組みたくないなら <strong>AnimeVocab</strong>：1セリフ1単語 + 内蔵 SRS + Netflix 対応。
                英語版：<Link href="/learn-japanese-netflix-anime">Learn Japanese on Netflix (EN)</Link>
              </>
            }
          />

          <section style={{ paddingTop: 0 }}>
            <div className="wrap prose">
              <h2>Yomitan スタック vs AnimeVocab</h2>
              <ul>
                <li>
                  <strong>Yomitan ルート</strong> — 字幕ファイル / asbplayer / AnkiConnect… セットアップ重い
                </li>
                <li>
                  <strong>AnimeVocab</strong> — 拡張を入れて視聴するだけ。ローマ字 → ひらがな → 漢字と段階的に
                </li>
              </ul>
              <p>
                上級者向け mining 比較：<Link href="/asbplayer-alternative">asbplayer alternative (EN)</Link>
              </p>
            </div>
          </section>

          <JaClosingCta mode="en-ja" headline="Netflix アニメを、辞書ホバーなしで学習に。" />
        </main>
        <JaHubFooter />
      </JaPageShell>
    </>
  );
}
