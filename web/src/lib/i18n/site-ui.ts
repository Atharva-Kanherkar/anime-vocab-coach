import type { SiteLocale } from "@/lib/locale";

export type SiteUiKey =
  | "skipToContent"
  | "installFree"
  | "addToChrome"
  | "signUp"
  | "signIn"
  | "cloudApp"
  | "blog"
  | "guides"
  | "features"
  | "cloud"
  | "pricing"
  | "faq"
  | "footerTagline"
  | "languageEn"
  | "languageJa"
  | "switchToEnglish"
  | "switchToJapanese";

const EN: Record<SiteUiKey, string> = {
  skipToContent: "Skip to content",
  installFree: "Install free",
  addToChrome: "Add to Chrome",
  signUp: "Sign up",
  signIn: "Sign in",
  cloudApp: "Cloud app",
  blog: "Blog",
  guides: "Guides",
  features: "Features",
  cloud: "Cloud",
  pricing: "Pricing",
  faq: "FAQ",
  footerTagline: "© AnimeVocab · learn Japanese from what you watch",
  languageEn: "English",
  languageJa: "日本語",
  switchToEnglish: "English",
  switchToJapanese: "日本語",
};

const JA: Record<SiteUiKey, string> = {
  skipToContent: "本文へスキップ",
  installFree: "無料でインストール",
  addToChrome: "Chrome に追加",
  signUp: "新規登録",
  signIn: "ログイン",
  cloudApp: "クラウドアプリ",
  blog: "ブログ",
  guides: "ガイド",
  features: "機能",
  cloud: "クラウド",
  pricing: "料金",
  faq: "FAQ",
  footerTagline: "© AnimeVocab · 見ているアニメから日本語（または英語）を学ぶ",
  languageEn: "English",
  languageJa: "日本語",
  switchToEnglish: "English",
  switchToJapanese: "日本語",
};

export function siteUi(locale: SiteLocale, key: SiteUiKey): string {
  return (locale === "ja" ? JA : EN)[key];
}
