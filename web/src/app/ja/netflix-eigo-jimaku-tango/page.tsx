import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { JaClosingCta, JaHubFooter, JaPageShell } from "@/components/ja-landing-chrome";
import { jaArticleJsonLd, jaPageMetadata } from "@/lib/ja-seo";

const path = "/ja/netflix-eigo-jimaku-tango";

const DESC =
  "Netflix アニメの英語字幕から単語を学ぶ方法。二重字幕ツールとの使い分け、英語が読めない人向け Listening Mode、日本語解説付き SRS。";

export const metadata: Metadata = jaPageMetadata({
  path,
  title: "Netflix 英語 字幕 単語 — アニメで英語語彙を増やす（2026）",
  description: DESC,
  keywords: [
    "Netflix 英語 字幕 単語",
    "Netflix アニメ 英語 学習",
    "Netflix 英語 字幕 拡張機能",
  ],
  enAlternate: "/learn-japanese-netflix-anime",
});

export default function JaNetflixEigoJimakuPage() {
  const jsonLd = jaArticleJsonLd({
    path,
    title: "Netflix 英語 字幕 単語",
    description: DESC,
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <JaPageShell>
        <main id="main">
          <Breadcrumbs
            items={[
              { href: "/ja", label: "アニメで英語学習" },
              { label: "Netflix 英語 字幕 単語" },
            ]}
            currentPath={path}
          />

          <CompareHero
            title="Netflix 英語 字幕 単語"
            lede={
              <>
                Netflix アニメは<strong>英語字幕</strong>が付いている作品が多い — でも字幕を読むだけでは語彙は残りません。
                「Netflix 英語 字幕 単語」で探しているなら、<strong>拾う → 日本語で理解 → 復習</strong>
                のループが必要です。
              </>
            }
            verdictTag="まず確認"
            verdict={
              <>
                字幕設定で <strong>English</strong> を選び、セリフを聞きながら読めるか確認。
                読めるなら Language Reactor 等の二重字幕も選択肢。
                読めない・単語が残らないなら <strong>AnimeVocab</strong> の ja→en モード +
                <Link href="/ja/anime-eigo-listening"> Listening Mode</Link>。
              </>
            }
          />

          <section style={{ paddingTop: 0 }}>
            <div className="wrap prose">
              <h2>Netflix での英語学習ワークフロー</h2>
              <ol>
                <li>英語音声 + 英語字幕（または日本語音声 + 英語字幕）で視聴</li>
                <li>AnimeVocab で 1 セリフ 1 英単語を保存（意味は日本語）</li>
                <li>翌日 SRS 復習 — 同じ作品の別エピソードで再会</li>
              </ol>

              <h2>英語字幕がない・読めないとき</h2>
              <p>
                Listening Mode が英語音声を文字起こしし、日本語解説付きカードにします。
                英語字幕トラックがなくても、<strong>聞いた英語</strong>から学べます。
              </p>
            </div>
          </section>

          <JaClosingCta headline="Netflix アニメを英語教材に。" />
        </main>
        <JaHubFooter />
      </JaPageShell>
    </>
  );
}
