import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { JaClosingCta, JaHubFooter, JaPageShell } from "@/components/ja-landing-chrome";
import { jaArticleJsonLd, jaPageMetadata } from "@/lib/ja-seo";
import { faqJsonLd } from "@/lib/seo";

const path = "/ja/crunchyroll-eigo-jimaku";

const DESC =
  "Crunchyroll でアニメを見ながら英語を学ぶ方法。英語字幕・英語音声、Listening Mode、日本語解説付き単語カード。Language Reactor 非対応の代替。";

export const metadata: Metadata = jaPageMetadata({
  path,
  title: "Crunchyroll で英語学習 — アニメの英語字幕・音声から（2026）",
  description: DESC,
  keywords: [
    "Crunchyroll 英語 学習",
    "Crunchyroll 英語 字幕",
    "アニメ 英語 Crunchyroll",
  ],
  enAlternate: "/learn-japanese-crunchyroll",
});

const faqs = [
  {
    question: "Crunchyroll で Language Reactor は使えますか？",
    answer:
      "いいえ。Language Reactor は Netflix / YouTube のみ。Crunchyroll で英語学習するなら AnimeVocab が対応プラットフォームです。",
  },
  {
    question: "英語字幕がない作品でも学べますか？",
    answer:
      "Listening Mode が英語音声を文字起こしすれば、字幕がなくても英単語カードを作れます。",
  },
];

export default function JaCrunchyrollEigoJimakuPage() {
  const faqLd = faqJsonLd(faqs);
  const jsonLd = jaArticleJsonLd({
    path,
    title: "Crunchyroll で英語学習",
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
              { label: "Crunchyroll 英語学習" },
            ]}
            currentPath={path}
          />

          <CompareHero
            title="Crunchyroll で英語学習"
            lede={
              <>
                Crunchyroll は simulcast の中心 — 英語吹き替えや英語字幕付き作品も多い。
                日本人が<strong>アニメで英語を学ぶ</strong>なら、Crunchyroll 上で
                <strong>1セリフ1英単語 + 日本語解説</strong>のループが現実的です。
                Language Reactor は Crunchyroll 非対応なので、<Link href="/ja/vs-language-reactor">代替ツール</Link>
                が必要です。
              </>
            }
            verdictTag="ワークフロー"
            verdict={
              <>
                ① 英語音声 or 英語字幕で視聴 ② AnimeVocab（ja→en）で単語保存 ③ 翌日 SRS。
                字幕が読めない → <Link href="/ja/anime-eigo-listening">Listening Mode</Link>。
              </>
            }
          />

          <section style={{ paddingTop: 0 }}>
            <div className="wrap prose">
              <h2>Crunchyroll 特有の注意点</h2>
              <ul>
                <li>作品によって英語字幕の有無が異なる — プレイヤー設定で確認</li>
                <li>英語が読めない段階では、二重字幕より Listening Mode + 日本語解説が楽</li>
                <li>同じシリーズを週次で追うと、同じ英単語が自然に復習される</li>
              </ul>
            </div>
          </section>

          <JaClosingCta headline="Crunchyroll の英語を、単語に変える。" />
        </main>
        <JaHubFooter />
      </JaPageShell>
    </>
  );
}
