import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { JaClosingCta, JaHubFooter, JaPageShell } from "@/components/ja-landing-chrome";
import { jaArticleJsonLd, jaPageMetadata } from "@/lib/ja-seo";
import { faqJsonLd } from "@/lib/seo";

const path = "/ja/anime-eigo-listening";

const DESC =
  "アニメで英語リスニング。英語字幕が読めなくても、音声から英単語を拾う Listening Mode。日本語解説・SRS 付き。Netflix・Crunchyroll 対応。";

export const metadata: Metadata = jaPageMetadata({
  path,
  title: "アニメ 英語 リスニング — 字幕なしでも英語を学ぶ（2026）",
  description: DESC,
  keywords: [
    "アニメ 英語 リスニング",
    "アニメ 英語 聞き取り",
    "アニメで英語 リスニング 練習",
    "japanese listening practice anime",
    "shadowing anime",
  ],
  enAlternate: "/learn-japanese-with-anime",
});

const faqs = [
  {
    question: "英語字幕が読めなくてもリスニングはできますか？",
    answer:
      "はい。AnimeVocab の Listening Mode は英語音声を文字起こしし、日本語で意味を添えた英単語カードを出します。字幕を読む必要はありません。",
  },
  {
    question: "シャドーイングだけでは足りませんか？",
    answer:
      "シャドーイングは発音練習に有効ですが、語彙が自動で残りません。1語ずつ保存して SRS で再会させると、アニメ視聴が語彙学習になります。",
  },
];

export default function JaAnimeEigoListeningPage() {
  const faqLd = faqJsonLd(faqs);
  const jsonLd = jaArticleJsonLd({
    path,
    title: "アニメ 英語 リスニング",
    description: DESC,
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <JaPageShell>
        <main id="main">
          <Breadcrumbs
            items={[
              { href: "/ja", label: "アニメで英語学習" },
              { label: "アニメ 英語 リスニング" },
            ]}
            currentPath={path}
          />

          <CompareHero
            title="アニメ 英語 リスニング"
            lede={
              <>
                「アニメ 英語 リスニング」— 好きな作品の<strong>英語音声</strong>は最高のリスニング教材です。
                ただし<strong>聞くだけ</strong>では単語は増えません。聞いた英語を<strong>1語ずつ拾い、日本語で意味を確認し、復習する</strong>
                仕組みが必要です。
              </>
            }
            verdictTag="おすすめ"
            verdict={
              <>
                AnimeVocab の <strong>Listening Mode</strong> + <strong>ja→en モード</strong>：
                英語音声から単語を抽出、解説は日本語、翌日 SRS。英語字幕が読めなくても OK。
                <Link href="/ja/netflix-eigo-jimaku-tango"> Netflix 向けガイド</Link>も参照。
              </>
            }
          />

          <section style={{ paddingTop: 0 }}>
            <div className="wrap prose">
              <h2>シャドーイングとの組み合わせ</h2>
              <p>
                「<strong>shadowing anime</strong>」「<strong>japanese listening practice anime</strong>」—
                シャドーイングは発音・リズムに効きますが、<strong>語彙は自動では残りません</strong>。
                聞いたあと AnimeVocab で 1 語だけ保存 → 翌日 SRS、が現実的な併用です。
              </p>

              <h2>リスニングが「学習」になる条件</h2>
              <ul>
                <li>同じ単語を<strong>別の場面</strong>でもう一度聞く（SRS）</li>
                <li>意味を<strong>日本語</strong>で即確認できる</li>
                <li>1エピソードあたり<strong>詰め込みすぎない</strong>（1語ずつで十分）</li>
              </ul>

              <h2>対応プラットフォーム</h2>
              <p>YouTube、Netflix、Crunchyroll — 英語音声が流れていれば Listening Mode が動きます。</p>
            </div>
          </section>

          <JaClosingCta headline="聞いた英語を、忘れないうちに復習。" />
        </main>
        <JaHubFooter />
      </JaPageShell>
    </>
  );
}
