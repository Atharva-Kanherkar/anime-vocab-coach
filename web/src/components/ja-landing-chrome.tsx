import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL } from "@/lib/site";
import { jaEnInstallUrl, jaEnOnboardUrl } from "@/lib/ja-seo";

export function JaClosingCta({
  headline = "アニメを見ながら、今日から英語を覚えよう。",
  primaryLabel = "Chrome に追加（無料）",
  secondaryLabel = "拡張機能なしで始める",
}: {
  headline?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="closing">
      <div className="wrap narrow">
        <h2>{headline}</h2>
        <p className="lede" style={{ marginBottom: 20 }}>
          設定で「日本語 → English」を選ぶと、解説は日本語・単語は英語で学べます。
        </p>
        <a className="btn btn-accent" href={jaEnInstallUrl()} rel="noopener noreferrer">
          {primaryLabel}
        </a>{" "}
        <Link className="btn btn-line" href={jaEnOnboardUrl()} style={{ marginLeft: 12 }}>
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
        { href: "/ja/eigo-jimaku-kakucho", label: "英語字幕 拡張機能" },
        { href: "/ja/netflix-eigo-jimaku-tango", label: "Netflix 英語単語" },
        { href: "/ja/anime-eigo-listening", label: "アニメ 英語リスニング" },
        { href: "/ja/vs-language-reactor", label: "Language Reactor 比較" },
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
