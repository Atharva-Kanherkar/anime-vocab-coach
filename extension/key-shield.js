"use strict";
(() => {
  // src/lib/key-shield.ts
  var UI_HOST_ATTR = "data-avc-ui";
  var KEY_EVENTS = ["keydown", "keyup", "keypress"];
  function fromOurUi(e) {
    for (const node of e.composedPath()) {
      if (node instanceof Element && node.hasAttribute(UI_HOST_ATTR)) return true;
    }
    return false;
  }
  function originalTarget(e) {
    const path = e.composedPath();
    return path.length ? path[0] : e.target;
  }
  function relay(e) {
    const target = originalTarget(e);
    if (!(target instanceof Node) || !(target.getRootNode() instanceof ShadowRoot)) return;
    const copy = new KeyboardEvent(e.type, {
      key: e.key,
      code: e.code,
      location: e.location,
      repeat: e.repeat,
      isComposing: e.isComposing,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      bubbles: true,
      cancelable: true,
      composed: false
    });
    if (!target.dispatchEvent(copy)) e.preventDefault();
  }
  function shield(e) {
    if (!e.isTrusted || !fromOurUi(e)) return;
    e.stopImmediatePropagation();
    relay(e);
  }
  function installKeyShield(win = window) {
    const w = win;
    if (w.__avcKeyShield) return false;
    w.__avcKeyShield = true;
    for (const type of KEY_EVENTS) win.addEventListener(type, shield, true);
    return true;
  }

  // src/entries/key-shield.ts
  installKeyShield();
})();
