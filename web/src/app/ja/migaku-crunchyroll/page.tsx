import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { JaClosingCta, JaHubFooter, JaPageShell } from "@/components/ja-landing-chrome";
import { jaArticleJsonLd, jaPageMetadata } from "@/lib/ja-seo";
import { faqJsonLd } from "@/lib/seo";

const path = "/ja/migaku-crunchyroll";

const DESC =
  "Migaku は Crunchyroll 対応？ 2026年：非対応（Netflix / YouTube / Disney+ 中心）。migaku crunchyroll で探している人向けの代替。";

export const metadata: Metadata = jaPageMetadata({
  path,
  title: "Migaku は Crunchyroll で使える？（2026：いいえ）— 代替ツール",
  description: DESC,
  keywords: [
    "migaku crunchyroll",
    "does migaku work on crunchyroll",
    "Migaku Crunchyroll 代替",
  ],
  enAlternate: "/does-migaku-work-on-crunchyroll",
});

const faqs = [
  {
    question: "Migaku は Crunchyroll で動きますか？",
    answer:
      "いいえ。Migaku 公式も Crunchyroll 非対応と明記。Netflix・YouTube・Disney+ 等が中心。Crunchyroll だけ見る人が Migaku を買うと後悔しやすい。",
  },
  {
    question: "Migaku Crunchyroll 代替は？",
    answer:
      "初心者：AnimeVocab（ローマ字 + Listening Mode）。読める人：Lexirise / ManabiDojo。Anki 派：Jimaku + asbplayer（Migaku ではないが同じ mining 習慣）。",
  },
];

export default function JaMigakuCrunchyrollPage() {
  const faqLd = faqJsonLd(faqs);
  const jsonLd = jaArticleJsonLd({ path, title: "Migaku × Crunchyroll", description: DESC });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <JaPageShell>
        <main id="main">
          <Breadcrumbs
            items={[{ href: "/ja", label: "日本語ガイド" }, { label: "Migaku × Crunchyroll" }]}
            currentPath={path}
          />

          <CompareHero
            title="Migaku は Crunchyroll で使える？"
            lede={
              <>
                「<strong>migaku crunchyroll</strong>」「<strong>does migaku work on crunchyroll</strong>」—
                日本からのインプレッションも確認されています。答えは<strong>いいえ</strong>。
                Migaku は mining スイートとして Netflix 等向けです。
              </>
            }
            verdictTag="現実的な構成"
            verdict={
              <>
                Netflix 用に Migaku を継続 + Crunchyroll 夜は <strong>AnimeVocab</strong> を足す。
                Crunchyroll だけなら Migaku より <Link href="/migaku-free-alternative">無料代替 (EN)</Link> から。
              </>
            }
          />

          <section style={{ paddingTop: 0 }}>
            <div className="wrap prose">
              <h2>なぜ Crunchyroll 向きでないか</h2>
              <ul>
                <li>日本語字幕トラックが少ない → mining 前提が合わない</li>
                <li>Migaku は JP テキストが取れるプラットフォームに投資している</li>
                <li>公式ブログでも CR 非対応を認めている</li>
              </ul>
              <p>
                比較：<Link href="/vs-migaku">AnimeVocab vs Migaku (EN)</Link> ·{" "}
                <Link href="/does-migaku-work-on-crunchyroll">Does Migaku work on CR? (EN)</Link>
              </p>
            </div>
          </section>

          <JaClosingCta mode="en-ja" headline="Migaku なしで Crunchyroll から日本語を。" />
        </main>
        <JaHubFooter />
      </JaPageShell>
    </>
  );
}
