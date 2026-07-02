export function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function hasJapanese(text: string): boolean {
  return /[぀-ヿ㐀-䶿一-鿿]/.test(text);
}
