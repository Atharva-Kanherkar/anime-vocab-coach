// Minimal typings for the vendored kuromoji UMD bundle (loaded as a separate
// content script before the bundle; also importable in extension pages).

interface KuromojiToken {
  surface_form: string;
  basic_form: string;
  reading?: string;
  pos: string;
  pos_detail_1: string;
}

interface KuromojiTokenizer {
  tokenize(text: string): KuromojiToken[];
}

interface KuromojiBuilder {
  build(cb: (err: Error | null, tokenizer: KuromojiTokenizer) => void): void;
}

declare const kuromoji: {
  builder(options: { dicPath: string }): KuromojiBuilder;
};
