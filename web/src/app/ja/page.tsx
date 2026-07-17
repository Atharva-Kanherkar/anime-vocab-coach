import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { JaClosingCta, JaHubFooter, JaPageShell } from "@/components/ja-landing-chrome";
import { jaArticleJsonLd, jaPageMetadata } from "@/lib/ja-seo";
import { faqJsonLd } from "@/lib/seo";
import { TIERS } from "@/lib/site";

const path = "/ja";

export const metadata: Metadata = jaPageMetadata({
  path,
  title: "アニメで英語学習（2026）— 字幕・拡張機能・リスニング",
  description:
    "アニメで英語を学ぶ方法。英語字幕拡張機能、Netflix・Crunchyroll での単語カード、リスニング練習。日本語解説で英語を覚える AnimeVocab ガイド。",
  keywords: [
    "アニメで英語学習",
    "アニメ 英語 勉強",
    "アニメ 英語 リスニング",
    "英語字幕 拡張機能",
    "Netflix 英語 字幕",
  ],
  enAlternate: "/",
});

const faqs = [
  {
    question: "アニメだけで英語は身につきますか？",
    answer:
      "英語字幕だけを読んでいるだけではほとんど身につきません。セリフから英単語を拾い、日本語で意味を確認し、復習するループが必要です。AnimeVocab はその一語ずつのループを拡張機能で自動化します。",
  },
  {
    question: "英語が苦手でもアニメで学べますか？",
    answer:
      "はい。AnimeVocab は日本語 → English モードがあり、解説・AIコーチは日本語、学ぶ単語は英語です。英語字幕を読めなくても、音声から単語を拾う Listening Mode も使えます。",
  },
  {
    question: "Language Reactor との違いは？",
    answer:
      "Language Reactor は二重字幕の「読む」学習向け。AnimeVocab は英語がまだ読めない人向けに、1セリフ1単語を日本語解説付きで出し、SRS 復習まで面倒を見ます。",
  },
];

export default function JaHubPage() {
  const faqLd = faqJsonLd(faqs);
  const jsonLd = jaArticleJsonLd({
    path,
    title: "アニメで英語学習（2026）",
    description:
      "アニメで英語を学ぶ方法。英語字幕拡張機能、Netflix・Crunchyroll、リスニング練習のガイド。",
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <JaPageShell>
        <main id="main">
          <Breadcrumbs
            items={[{ href: "/", label: "Home" }, { label: "アニメで英語学習" }]}
            currentPath={path}
          />

          <CompareHero
            title="アニメで英語学習（2026）"
            lede={
              <>
                日本の視聴者の約4分の1がすでに AnimeVocab に来ています — でも英語学習向けの案内がほとんどありませんでした。
                このページ群は<strong>日本語 → English</strong>向け：解説は日本語、覚えるのはアニメの英単語。
                英語字幕を「なんとなく読む」だけでは語彙は増えません。
              </>
            }
            verdictTag="要点"
            verdict={
              <>
                学習が起きるのは、<strong>セリフから英単語を1つ選び、日本語で意味を確認し、忘れる前にもう一度見る</strong>
                ときだけ。下のガイドはそのループを短くするためのものです。
              </>
            }
          />

          <section style={{ paddingTop: 0 }}>
            <div className="wrap prose">
              <h2>目的別ガイド</h2>
              <ul>
                <li>
                  <Link href="/ja/eigo-jimaku-kakucho">英語字幕 拡張機能</Link>
                  — アニメ視聴中に英単語カードを出す Chrome 拡張
                </li>
                <li>
                  <Link href="/ja/netflix-eigo-jimaku-tango">Netflix 英語 字幕 単語</Link>
                  — Netflix アニメで英語字幕から語彙を拾う
                </li>
                <li>
                  <Link href="/ja/anime-eigo-listening">アニメ 英語 リスニング</Link>
                  — 字幕が読めなくても音声から英語を学ぶ
                </li>
                <li>
                  <Link href="/ja/crunchyroll-eigo-jimaku">Crunchyroll で英語学習</Link>
                  — 英語音声・英語字幕での学習ワークフロー
                </li>
                <li>
                  <Link href="/ja/vs-language-reactor">AnimeVocab vs Language Reactor（日本語）</Link>
                  — 二重字幕ツールとの比較
                </li>
                <li>
                  <Link href="/ja/kakucho-nashi">拡張機能なしで使う</Link>
                  — クラウドアプリだけでできること
                </li>
              </ul>

              <h2>AnimeVocab の ja→en モード</h2>
              <p>
                設定で <strong>日本語 → English</strong> を選ぶと：
              </p>
              <ul>
                <li>カードの単語は<strong>英語</strong>（アニメの英語字幕・音声から）</li>
                <li>意味・例文の解説は<strong>日本語</strong></li>
                <li>AI コーチも<strong>日本語で返答</strong></li>
                <li>復習（SRS）も同じ向きで動作</li>
              </ul>
              <p>
                無料枠：Listening Mode 月{TIERS.free.listeningMinutes / 60}時間、AI {TIERS.free.aiCallsPerMonth}
                回/月。Pro は {TIERS.pro.priceLabel}。
              </p>
            </div>
          </section>

          <JaClosingCta />
        </main>
        <JaHubFooter />
      </JaPageShell>
    </>
  );
}
