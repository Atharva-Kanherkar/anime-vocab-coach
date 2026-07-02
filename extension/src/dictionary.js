AVC.dict = {
  _promise: null,
  _data: null,

  load() {
    if (!this._promise) {
      this._promise = fetch(chrome.runtime.getURL("data/dictionary.json"))
        .then((r) => r.json())
        .then((data) => {
          this._data = data;
          return data;
        })
        .catch((err) => {
          AVC.warn("dictionary load failed:", err);
          this._data = {};
          return {};
        });
    }
    return this._promise;
  },

  lookup(base) {
    if (!this._data) return null;
    const entry = this._data[base];
    if (!entry) return null;
    return {
      reading: entry.r,
      glosses: entry.g,
      level: entry.l,
      freqRank: entry.f
    };
  }
};
