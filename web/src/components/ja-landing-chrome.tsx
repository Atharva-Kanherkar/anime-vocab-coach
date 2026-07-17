import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL } from "@/lib/site";
import { jaEnInstallUrl, jaEnOnboardUrl } from "@/lib/ja-seo";

export function JaClosingCta({
  mode = "ja-en",
  headline,
  primaryLabel = "Chrome に追加（無料）",
  secondaryLabel = "拡張機能なしで始める",
}: {
  /** ja-en = learn English; en-ja = learn Japanese (most Japan GSC competitor queries). */
  mode?: "ja-en" | "en-ja";
  headline?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
}) {
  const resolvedHeadline =
    headline ??
    (mode === "en-ja"
      ? "アニメを見ながら、今日から日本語を覚えよう。"
      : "アニメを見ながら、今日から英語を覚えよう。");
  const lede =
    mode === "en-ja"
      ? "ローマ字ファーストの単語カード + Listening Mode + 内蔵 SRS。Crunchyroll・Netflix・YouTube 対応。"
      : "設定で「日本語 → English」を選ぶと、解説は日本語・単語は英語で学べます。";

  return (
    <section className="closing">
      <div className="wrap narrow">
        <h2>{resolvedHeadline}</h2>
        <p className="lede" style={{ marginBottom: 20 }}>
          {lede}
        </p>
        <a className="btn btn-accent" href={jaEnInstallUrl()} rel="noopener noreferrer">
          {primaryLabel}
        </a>{" "}
        <Link
          className="btn btn-line"
          href={mode === "en-ja" ? "/app" : jaEnOnboardUrl()}
          style={{ marginLeft: 12 }}
        >
          {secondaryLabel}
        </Link>
      </div>
    </section>
  );
}

export function JaHubFooter() {
  return (
    <SiteFooter
      links={[
        { href: "/ja/animelon-alternative", label: "Animelon 代替" },
        { href: "/ja/language-reactor-crunchyroll", label: "LR × Crunchyroll" },
        { href: "/ja/migaku-crunchyroll", label: "Migaku × Crunchyroll" },
        { href: "/ja/yomitan-netflix", label: "Yomitan × Netflix" },
        { href: "/ja/anime-eigo-listening", label: "リスニング練習" },
        { href: "/ja/eigo-jimaku-kakucho", label: "英語学習" },
        { href: "/ja/kakucho-nashi", label: "拡張機能なし" },
        { href: "/", label: "English site" },
        { href: GITHUB_URL, label: "GitHub" },
      ]}
    />
  );
}

export function JaPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div lang="ja" className="ja-locale" style={{ fontFamily: "var(--jp), var(--sans)" }}>
      <SiteHeader compact />
      {children}
    </div>
  );
}
