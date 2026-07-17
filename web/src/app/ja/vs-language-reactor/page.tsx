import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { JaClosingCta, JaHubFooter, JaPageShell } from "@/components/ja-landing-chrome";
import { jaArticleJsonLd, jaPageMetadata } from "@/lib/ja-seo";
import { TIERS } from "@/lib/site";

const path = "/ja/vs-language-reactor";

const DESC =
  "Language Reactor 日本語向け比較。二重字幕リーダー vs 日本語解説付き英単語カード + Listening Mode。アニメで英語を学ぶ人向け。";

export const metadata: Metadata = jaPageMetadata({
  path,
  title: "AnimeVocab vs Language Reactor（2026）— 日本語比較",
  description: DESC,
  keywords: [
    "Language Reactor 日本語",
    "Language Reactor 比較",
    "Language Reactor 代替",
    "アニメ 英語 Language Reactor",
  ],
  enAlternate: "/vs-language-reactor",
});

export default function JaVsLanguageReactorPage() {
  const jsonLd = jaArticleJsonLd({
    path,
    title: "AnimeVocab vs Language Reactor（日本語）",
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
              { label: "vs Language Reactor" },
            ]}
            currentPath={path}
          />

          <CompareHero
            title="AnimeVocab vs Language Reactor（2026）"
            lede={
              <>
                <strong>Language Reactor 日本語</strong>で検索している人向けの比較。
                Language Reactor は Netflix / YouTube の<strong>二重字幕リーダー</strong>として優秀。
                AnimeVocab は<strong>英語がまだ読めない</strong>人、または
                <strong>アニメで英語を学びたい日本人</strong>向け — 日本語解説付き英単語カード + SRS。
              </>
            }
            verdictTag="結論"
            verdict={
              <>
                <strong>英語字幕を読んで単語を自分で選びたい中級者</strong> → Language Reactor。
                <strong>英語が読めない / 1語ずつ日本語で理解したい / Crunchyroll も使う</strong> → AnimeVocab。
              </>
            }
          />

          <section style={{ paddingTop: 0 }}>
            <div className="wrap">
              <div className="table-scroll">
                <table className="cmp">
                  <thead>
                    <tr>
                      <th scope="col">&nbsp;</th>
                      <th scope="col" className="us">
                        AnimeVocab
                      </th>
                      <th scope="col">Language Reactor</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">向いている人</th>
                      <td className="us">英語が読めない初心者・ja→en 学習者</td>
                      <td>英語字幕を読める中級者</td>
                    </tr>
                    <tr>
                      <th scope="row">学習の向き</th>
                      <td className="us">
                        <span className="yes">日本語 → English</span>
                      </td>
                      <td>多言語（英語学習も可だが UI は英語中心）</td>
                    </tr>
                    <tr>
                      <th scope="row">価格</th>
                      <td className="us">
                        無料 · Pro {TIERS.pro.priceLabel}
                      </td>
                      <td>無料 · Pro 約 $5/月</td>
                    </tr>
                    <tr>
                      <th scope="row">1セリフ1単語（自動）</th>
                      <td className="us">
                        <span className="yes">あり</span>
                      </td>
                      <td>
                        <span className="no">なし</span>（自分でホバー保存）
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">解説言語</th>
                      <td className="us">日本語（ja→en モード）</td>
                      <td>主に英語</td>
                    </tr>
                    <tr>
                      <th scope="row">内蔵 SRS</th>
                      <td className="us">
                        <span className="yes">あり</span>
                      </td>
                      <td>Anki 連携が中心</td>
                    </tr>
                    <tr>
                      <th scope="row">Crunchyroll</th>
                      <td className="us">
                        <span className="yes">対応</span>
                      </td>
                      <td>
                        <span className="no">非対応</span>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Listening Mode（音声文字起こし）</th>
                      <td className="us">
                        <span className="yes">あり</span>
                      </td>
                      <td>
                        <span className="no">なし</span>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">オープンソース</th>
                      <td className="us">
                        <span className="yes">はい</span>（AGPL）
                      </td>
                      <td>
                        <span className="no">いいえ</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section style={{ paddingTop: 0 }}>
            <div className="wrap prose">
              <h2>併用もアリ</h2>
              <p>
                英語が読めるようになったら Language Reactor を足す人も多い。
                最初の数ヶ月は AnimeVocab で<strong>日本語解説付きの英単語</strong>を固め、
                その後二重字幕で読み量を増やす — という順序が現実的です。
              </p>
              <p>
                英語版の詳細比較：<Link href="/vs-language-reactor">AnimeVocab vs Language Reactor (EN)</Link>
              </p>
            </div>
          </section>

          <JaClosingCta headline="英語が読めなくても、アニメから始められる。" />
        </main>
        <JaHubFooter />
      </JaPageShell>
    </>
  );
}
