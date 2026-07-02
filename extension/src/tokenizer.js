function kataToHira(s) {
  return s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

AVC.tokenizer = {
  _promise: null,
  _tokenizer: null,
  _disabled: false,

  init() {
    if (this._disabled) return Promise.reject(new Error("tokenizer disabled"));
    if (this._promise) return this._promise;

    this._promise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: chrome.runtime.getURL("kuromoji/dict/") }).build((err, tokenizer) => {
        if (err) {
          AVC.warn("tokenizer init failed:", err);
          this._disabled = true;
          reject(err);
          return;
        }
        this._tokenizer = tokenizer;
        resolve(tokenizer);
      });
    });

    return this._promise;
  },

  async tokenize(text) {
    await this.init();
    if (!this._tokenizer) return [];
    return this._tokenizer.tokenize(text).map((t) => ({
      surface: t.surface_form,
      base: t.basic_form === "*" ? t.surface_form : t.basic_form,
      reading: kataToHira(t.reading || ""),
      pos: t.pos,
      pos1: t.pos_detail_1
    }));
  }
};
