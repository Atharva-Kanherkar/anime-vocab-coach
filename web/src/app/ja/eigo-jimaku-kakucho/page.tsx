import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { JaClosingCta, JaHubFooter, JaPageShell } from "@/components/ja-landing-chrome";
import { jaArticleJsonLd, jaPageMetadata } from "@/lib/ja-seo";
import { faqJsonLd } from "@/lib/seo";
import { TIERS } from "@/lib/site";

const path = "/ja/eigo-jimaku-kakucho";

const DESC =
  "アニメの英語字幕から単語を学ぶ Chrome 拡張機能。日本語解説付きカード、SRS 復習、Listening Mode。Netflix・Crunchyroll・YouTube 対応。";

export const metadata: Metadata = jaPageMetadata({
  path,
  title: "英語字幕 拡張機能 — アニメで英語を学ぶ Chrome 拡張（2026）",
  description: DESC,
  keywords: [
    "英語字幕 拡張機能",
    "アニメ 英語 拡張機能",
    "Netflix 英語 拡張機能",
    "Chrome 拡張 英語学習",
  ],
  enAlternate: "/free-japanese-anime-extension",
});

const faqs = [
  {
    question: "英語字幕の拡張機能で本当に英語は学べますか？",
    answer:
      "字幕を流し読みするだけでは足りません。拡張機能が「1セリフ1単語」を日本語で解説し、翌日復習まで面倒を見れば、アニメ視聴が語彙学習になります。",
  },
  {
    question: "日本語字幕ではなく英語字幕から学べますか？",
    answer:
      "はい。AnimeVocab の日本語 → English モードは英語字幕・英語音声から英単語を拾い、意味は日本語で表示します。",
  },
];

export default function JaEigoJimakuKakuchoPage() {
  const faqLd = faqJsonLd(faqs);
  const jsonLd = jaArticleJsonLd({
    path,
    title: "英語字幕 拡張機能 — アニメで英語を学ぶ",
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
              { label: "英語字幕 拡張機能" },
            ]}
            currentPath={path}
          />

          <CompareHero
            title="英語字幕 拡張機能 — アニメで英語を学ぶ"
            lede={
              <>
                「英語字幕 拡張機能」で探している人向け：<strong>AnimeVocab</strong> は視聴中に
                <strong>1セリフ1英単語</strong>を日本語解説付きで出す Chrome 拡張です。
                Netflix・Crunchyroll・YouTube で動き、<Link href="/ja">ja→en 学習モード</Link>に対応しています。
              </>
            }
            verdictTag="向いている人"
            verdict={
              <>
                英語字幕は付いているが<strong>単語が頭に残らない</strong>、または
                <strong>英語がまだ読めない</strong>がアニメの英語音声から学びたい人向け。
                辞書ホバー型ツールより、初心者向けの「1語ずつ + 復習」設計です。
              </>
            }
          />

          <section style={{ paddingTop: 0 }}>
            <div className="wrap prose">
              <h2>他ツールとの違い</h2>
              <ul>
                <li>
                  <strong>Language Reactor</strong> — 二重字幕で「読む」学習。英語が読める中級者向け。
                  <Link href="/ja/vs-language-reactor"> 比較ページ</Link>
                </li>
                <li>
                  <strong>AnimeVocab</strong> — 日本語解説 + 頻出語フィルタ + 内蔵 SRS。英語が読めなくても Listening
                  Mode で音声から拾える。
                </li>
              </ul>

              <h2>できること（無料）</h2>
              <ul>
                <li>視聴中の英単語カード（日本語の意味付き）</li>
                <li>内蔵スペースドリピティション</li>
                <li>Listening Mode 月{TIERS.free.listeningMinutes / 60}時間</li>
                <li>アカウント不要・データは端末内</li>
              </ul>
            </div>
          </section>

          <JaClosingCta headline="英語字幕を「学習」に変える。" />
        </main>
        <JaHubFooter />
      </JaPageShell>
    </>
  );
}
