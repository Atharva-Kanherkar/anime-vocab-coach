import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/marketing";
import { JaClosingCta, JaHubFooter, JaPageShell } from "@/components/ja-landing-chrome";
import { jaArticleJsonLd, jaPageMetadata, jaEnOnboardUrl } from "@/lib/ja-seo";

const path = "/ja/kakucho-nashi";

const TITLE = "拡張機能なしで AnimeVocab を使う";
const DESC =
  "Chrome 拡張を入れなくても使える AnimeVocab の機能 — ノート、AI コーチ、ストリーク、マンガ、クラウド同期。";

export const metadata: Metadata = jaPageMetadata({
  path,
  title: TITLE,
  description: DESC,
  enAlternate: "/without-extension",
});

export default function JaKakuchoNashiPage() {
  const jsonLd = jaArticleJsonLd({ path, title: TITLE, description: DESC });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <JaPageShell>
        <main id="main">
          <Breadcrumbs
            items={[
              { href: "/ja", label: "アニメで英語学習" },
              { label: "拡張機能なし" },
            ]}
            currentPath={path}
          />

          <section className="legal wrap narrow" style={{ paddingTop: 48 }}>
            <h1>{TITLE}</h1>
            <p>
              拡張機能は視聴しながら英単語を拾う<strong>最も効く方法</strong>です。
              でもインストール前・審査待ちでも、<Link href="/app">クラウドアプリ</Link>だけで価値は得られます。
            </p>

            <h2>Chrome Web Store の審査待ち？</h2>
            <p>
              審査中でも学習は止まりません。クラウドアプリにサインインし、下の機能を先に使えます。
              拡張が承認されたら、同期済みの進捗がそのまま引き継がれます。
            </p>

            <h2>拡張なしで今すぐ使えること</h2>
            <ul>
              <li>
                <strong>ノートブック</strong> — 単語・セリフ・シーンを保存・整理・エクスポート
              </li>
              <li>
                <strong>AI 復習サマリー</strong> — ノートから弱点と復習プロンプトを生成（日本語で返答可能）
              </li>
              <li>
                <strong>ダッシュボード</strong> — 学習単語数、復習予定、学習時間（同期データから）
              </li>
              <li>
                <strong>ストリーク・チャレンジ・リーダーボード</strong> — 同期済み履歴から表示
              </li>
            </ul>

            <h2>拡張機能が必要なこと</h2>
            <p>
              視聴<strong>中</strong>のライブ学習 — セリフから英単語を拾う、Listening Mode で音声を文字起こし —
              はブラウザ拡張でのみ動きます。Netflix・Crunchyroll・YouTube 上のキャプチャは拡張が担当します。
            </p>

            <p style={{ marginTop: 32 }}>
              <Link className="btn btn-accent" href={jaEnOnboardUrl()}>
                クラウドアプリを開く（ja→en）
              </Link>
            </p>
          </section>

          <JaClosingCta
            headline="準備ができたら拡張も追加。"
            secondaryLabel="クラウドアプリを開く"
          />
        </main>
        <JaHubFooter />
      </JaPageShell>
    </>
  );
}
