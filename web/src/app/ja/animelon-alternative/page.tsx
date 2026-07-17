import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { JaClosingCta, JaHubFooter, JaPageShell } from "@/components/ja-landing-chrome";
import { jaArticleJsonLd, jaPageMetadata } from "@/lib/ja-seo";
import { faqJsonLd } from "@/lib/seo";

const path = "/ja/animelon-alternative";

const DESC =
  "Animelon 代替ツール（2026）。合法ストリーム（Netflix・Crunchyroll・YouTube）でローマ字ファーストの単語カード + SRS。ホスト型カタログに依存しない。";

export const metadata: Metadata = jaPageMetadata({
  path,
  title: "Animelon 代替（2026）— 合法ストリームでアニメ日本語学習",
  description: DESC,
  keywords: ["animelon alternative", "Animelon 代替", "アニメ 日本語 学習 無料"],
  enAlternate: "/animelon-alternative",
});

const faqs = [
  {
    question: "Animelon の代替は何がいい？",
    answer:
      "2026年時点では AnimeVocab が最も近い代替：ローマ字ファーストの単語カードを、すでに契約している Netflix・Crunchyroll・YouTube 上で使える。Animelon はホスト型カタログが落ちると使えなくなる。",
  },
  {
    question: "Animelon と AnimeVocab の違いは？",
    answer:
      "Animelon はサイト内でアニメを再生し字幕モードを切り替える。AnimeVocab は拡張機能で合法ストリームに重なる。AnimeVocab は内蔵 SRS と Listening Mode（日本語字幕がないとき）もある。",
  },
];

export default function JaAnimelonAlternativePage() {
  const faqLd = faqJsonLd(faqs);
  const jsonLd = jaArticleJsonLd({ path, title: "Animelon 代替", description: DESC });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <JaPageShell>
        <main id="main">
          <Breadcrumbs
            items={[{ href: "/ja", label: "日本語ガイド" }, { label: "Animelon 代替" }]}
            currentPath={path}
          />

          <CompareHero
            title="Animelon 代替（2026）"
            lede={
              <>
                日本から「<strong>animelon alternative</strong>」で検索する人向け。
                Animelon はローマ字モードが良かったが、<strong>ホスト型・不安定</strong>。
                AnimeVocab は<strong>合法ストリーム</strong>の上で同じ「アニメから日本語」ループを回せます。
              </>
            }
            verdictTag="結論"
            verdict={
              <>
                特定タイトルが Animelon で見られるならその限りでは使える。
                毎晩の学習なら <strong>AnimeVocab</strong>（無料コア + 内蔵 SRS）の方が安全。
                英語版：<Link href="/animelon-alternative">Animelon alternative (EN)</Link>
              </>
            }
          />

          <section style={{ paddingTop: 0 }}>
            <div className="wrap prose">
              <h2>Animelon が向いていた人</h2>
              <ul>
                <li>ひらがなが読めない初心者</li>
                <li>ローマ字 / ひらがな / 漢字の切り替え</li>
                <li>無料カタログで完結させたい</li>
              </ul>
              <p>
                そのニーズのうち<strong>「合法 + 落ちない」</strong>部分を AnimeVocab がカバーします。
                比較：<Link href="/vs-animelon">AnimeVocab vs Animelon (EN)</Link>
              </p>
            </div>
          </section>

          <JaClosingCta mode="en-ja" />
        </main>
        <JaHubFooter />
      </JaPageShell>
    </>
  );
}
