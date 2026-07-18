"use strict";
(() => {
  // src/config.ts
  var WEB_URL = "https://animevocab.com";
  var CWS_EXTENSION_ID = "lkjbomofgfonjjbemobacegffepbdnel";

  // src/lib/log.ts
  var warn = (...args) => console.warn("[AVC]", ...args);

  // src/lib/locale-direction.ts
  function isJapaneseUiLocale() {
    try {
      const ui2 = chrome.i18n?.getUILanguage?.() || navigator.language || "en";
      return ui2.toLowerCase().startsWith("ja");
    } catch {
      return false;
    }
  }
  function resolveStoredDirection(stored) {
    if (stored === "ja-en" || stored === "en-ja") return stored;
    return null;
  }

  // src/types.ts
  var DEFAULTS = {
    pauseMode: "copilot",
    cooldownSec: 20,
    maxCardsPerHour: 12,
    targetLevel: 5,
    autoResumeSec: 15,
    displayScript: "romaji",
    learningDirection: "en-ja",
    autoSpeak: true,
    openaiKey: "",
    transcribeModel: "gpt-4o-mini-transcribe",
    sites: { youtube: true, netflix: true, generic: true }
  };
  var SRS_INTERVALS = [0, 4 * 36e5, 24 * 36e5, 3 * 24 * 36e5, 7 * 24 * 36e5, 21 * 24 * 36e5];

  // src/lib/review-prompt.ts
  var CWS_REVIEWS_URL = "https://chromewebstore.google.com/detail/lkjbomofgfonjjbemobacegffepbdnel/reviews";
  var REVIEW_PROMPT_MIN_MINED = 10;
  var REVIEW_PROMPT_MAX_ASKS = 2;
  var REVIEW_PROMPT_SNOOZE_MS = 14 * 24 * 36e5;
  var REVIEW_PROMPT_SNOOZE_EXTRA_CARDS = 20;
  var EMPTY_REVIEW_PROMPT = {
    dismissedForever: false,
    askCount: 0,
    snoozeUntil: 0,
    snoozeAfterCards: 0,
    lastShownAt: 0
  };
  function countMinedCards(vocab) {
    let n2 = 0;
    for (const rec of Object.values(vocab)) {
      if (rec.state === "known" || rec.state === "learning") n2++;
    }
    return n2;
  }
  function totalReviewsDone(stats) {
    let n2 = 0;
    for (const day of Object.values(stats.daily || {})) {
      n2 += day.reviews || 0;
    }
    return n2;
  }
  function asBool(v2) {
    if (v2 === true || v2 === 1) return true;
    if (typeof v2 === "string") return v2.toLowerCase() === "true";
    return false;
  }
  function normalizeReviewPrompt(raw) {
    if (!raw || typeof raw !== "object") return { ...EMPTY_REVIEW_PROMPT };
    const o2 = raw;
    return {
      // Avoid `!!o.dismissedForever` — a legacy string "false" would become true.
      dismissedForever: asBool(o2.dismissedForever),
      askCount: Math.max(0, Number(o2.askCount) || 0),
      snoozeUntil: Math.max(0, Number(o2.snoozeUntil) || 0),
      snoozeAfterCards: Math.max(0, Number(o2.snoozeAfterCards) || 0),
      lastShownAt: Math.max(0, Number(o2.lastShownAt) || 0)
    };
  }
  function shouldShowReviewPrompt(input) {
    const now = input.now ?? Date.now();
    if (input.blocked) return false;
    const { prompt } = input;
    if (prompt.dismissedForever) return false;
    const mined = countMinedCards(input.vocab);
    if (mined < REVIEW_PROMPT_MIN_MINED) return false;
    if (totalReviewsDone(input.stats) < 1) return false;
    const awaitingResponse = prompt.lastShownAt > 0 && prompt.snoozeUntil === 0 && prompt.askCount > 0 && prompt.askCount <= REVIEW_PROMPT_MAX_ASKS;
    if (awaitingResponse) return true;
    if (prompt.askCount >= REVIEW_PROMPT_MAX_ASKS) return false;
    if (prompt.snoozeUntil > 0 && now < prompt.snoozeUntil) return false;
    if (prompt.snoozeAfterCards > 0 && mined < prompt.snoozeAfterCards) return false;
    return true;
  }
  function applyShown(prompt, now = Date.now()) {
    return {
      ...prompt,
      lastShownAt: now,
      askCount: prompt.askCount + 1,
      snoozeUntil: 0,
      snoozeAfterCards: 0
    };
  }
  function shouldCountShown(prompt, now = Date.now()) {
    if (prompt.askCount >= REVIEW_PROMPT_MAX_ASKS) return false;
    if (prompt.lastShownAt === 0) return true;
    return prompt.snoozeUntil > 0 && now >= prompt.snoozeUntil;
  }
  function applyMaybeLater(prompt, minedCards, now = Date.now()) {
    return {
      ...prompt,
      snoozeUntil: now + REVIEW_PROMPT_SNOOZE_MS,
      snoozeAfterCards: minedCards + REVIEW_PROMPT_SNOOZE_EXTRA_CARDS
    };
  }
  function applyNoThanks(prompt) {
    return { ...prompt, dismissedForever: true };
  }
  function applyRate(prompt) {
    return { ...prompt, dismissedForever: true };
  }

  // src/lib/storage.ts
  var queue = Promise.resolve();
  function enqueue(fn2) {
    const next = queue.then(fn2, fn2);
    queue = next.catch((err) => warn("storage error:", err));
    return next;
  }
  function pruneTimestamps(timestamps) {
    const cutoff = Date.now() - 36e5;
    return (timestamps || []).filter((t2) => t2 >= cutoff);
  }
  function emptyStats() {
    return { daily: {}, cardTimestamps: [] };
  }
  function withDefaults(stored) {
    const merged = { ...DEFAULTS, ...stored };
    if (resolveStoredDirection(stored.learningDirection) === null && isJapaneseUiLocale()) {
      merged.learningDirection = "ja-en";
    }
    return merged;
  }
  function getVocab() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["vocab"], (r2) => resolve(r2.vocab || {}));
    });
  }
  function getStats() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["stats"], (r2) => {
        const stats = r2.stats || emptyStats();
        stats.cardTimestamps = pruneTimestamps(stats.cardTimestamps);
        resolve(stats);
      });
    });
  }
  function exportAll() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["settings", "vocab", "stats"], (r2) => {
        resolve({
          settings: withDefaults(r2.settings || {}),
          vocab: r2.vocab || {},
          stats: r2.stats || emptyStats(),
          exportedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      });
    });
  }
  function getSyncToken() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["syncToken"], (r2) => resolve(r2.syncToken || ""));
    });
  }
  function getRelinkNeeded() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["relinkNeeded"], (r2) => resolve(!!r2.relinkNeeded));
    });
  }
  function getSyncProfile() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["syncProfile"], (r2) => {
        const p2 = r2.syncProfile;
        resolve(p2 && typeof p2 === "object" ? { email: p2.email ?? null, name: p2.name ?? null } : null);
      });
    });
  }
  function getReviewPrompt() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["reviewPrompt"], (r2) => {
        resolve(normalizeReviewPrompt(r2.reviewPrompt));
      });
    });
  }
  function setReviewPrompt(next) {
    return enqueue(async () => {
      const state = normalizeReviewPrompt(next);
      await chrome.storage.local.set({ reviewPrompt: state });
      return state;
    });
  }
  function recordReviewPromptShown(now = Date.now()) {
    return enqueue(async () => {
      const r2 = await chrome.storage.local.get(["reviewPrompt"]);
      const prompt = normalizeReviewPrompt(r2.reviewPrompt);
      if (!shouldCountShown(prompt, now)) return false;
      await chrome.storage.local.set({ reviewPrompt: applyShown(prompt, now) });
      return true;
    });
  }

  // src/lib/review.ts
  function dueCount(vocab, now = Date.now()) {
    let n2 = 0;
    for (const base of Object.keys(vocab)) {
      const r2 = vocab[base];
      if (r2.state === "learning" && r2.srs && r2.srs.dueAt <= now) n2++;
    }
    return n2;
  }

  // src/lib/extension-events.ts
  var EXTENSION_EVENTS = [
    "review_prompt_shown",
    "review_prompt_clicked"
  ];
  function isExtensionEvent(v2) {
    return typeof v2 === "string" && EXTENSION_EVENTS.includes(v2);
  }
  function extensionId() {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.id) return chrome.runtime.id;
    } catch {
    }
    return CWS_EXTENSION_ID;
  }
  function trackExtensionEvent(event) {
    if (!isExtensionEvent(event)) return;
    try {
      const url = `${WEB_URL}/api/extension/track`;
      const payload = JSON.stringify({ event });
      void fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-avc-extension-id": extensionId()
        },
        body: payload,
        keepalive: true
      }).catch(() => {
      });
    } catch {
    }
  }

  // src/lib/review-prompt-ui.ts
  async function mountReviewPrompt(opts) {
    const { host, blocked = false, variant = "popup" } = opts;
    try {
      return await mountReviewPromptInner(host, blocked, variant);
    } catch {
      try {
        host.hidden = true;
        host.innerHTML = "";
      } catch {
      }
      return false;
    }
  }
  async function mountReviewPromptInner(host, blocked, variant) {
    const [vocab, stats, prompt] = await Promise.all([
      getVocab(),
      getStats(),
      getReviewPrompt()
    ]);
    const now = Date.now();
    if (!shouldShowReviewPrompt({ vocab, stats, prompt, blocked, now })) {
      host.hidden = true;
      host.innerHTML = "";
      return false;
    }
    if (await recordReviewPromptShown(now)) {
      trackExtensionEvent("review_prompt_shown");
    }
    const rootClass = variant === "popup" ? "av-review-prompt" : "rp-card";
    const btnPrimary = variant === "popup" ? "av-btn av-btn-primary av-btn-block" : "rp-btn rp-btn-primary";
    const btnGhost = variant === "popup" ? "av-btn av-btn-ghost av-btn-block" : "rp-btn rp-btn-ghost";
    const btnQuiet = variant === "popup" ? "av-btn av-btn-quiet av-btn-block" : "rp-btn rp-btn-quiet";
    host.hidden = false;
    host.innerHTML = `<div class="${rootClass}" role="region" aria-label="Rate AnimeVocab"><p class="${variant === "popup" ? "av-review-prompt-copy" : "rp-copy"}">Enjoying AnimeVocab? A rating helps other learners find it.</p><div class="${variant === "popup" ? "av-review-prompt-actions" : "rp-actions"}"><button type="button" class="${btnPrimary}" data-rp="rate">Rate on Chrome Web Store</button><button type="button" class="${btnGhost}" data-rp="later">Maybe later</button><button type="button" class="${btnQuiet}" data-rp="no">No thanks</button></div></div>`;
    const hide = () => {
      host.hidden = true;
      host.innerHTML = "";
    };
    const mined = countMinedCards(vocab);
    host.querySelector('[data-rp="rate"]')?.addEventListener("click", () => {
      void (async () => {
        const current = await getReviewPrompt();
        await setReviewPrompt(applyRate(current));
        trackExtensionEvent("review_prompt_clicked");
        chrome.tabs.create({ url: CWS_REVIEWS_URL });
        hide();
      })();
    });
    host.querySelector('[data-rp="later"]')?.addEventListener("click", () => {
      void (async () => {
        const current = await getReviewPrompt();
        await setReviewPrompt(applyMaybeLater(current, mined));
        hide();
      })();
    });
    host.querySelector('[data-rp="no"]')?.addEventListener("click", () => {
      void (async () => {
        const current = await getReviewPrompt();
        await setReviewPrompt(applyNoThanks(current));
        hide();
      })();
    });
    return true;
  }

  // node_modules/posthog-js/dist/module.no-external.js
  function e(e2, t2, i2, r2, s2, n2, o2) {
    try {
      var a2 = e2[n2](o2), l2 = a2.value;
    } catch (e3) {
      return void i2(e3);
    }
    a2.done ? t2(l2) : Promise.resolve(l2).then(r2, s2);
  }
  function t(t2) {
    return function() {
      var i2 = this, r2 = arguments;
      return new Promise((function(s2, n2) {
        var o2 = t2.apply(i2, r2);
        function a2(t3) {
          e(o2, s2, n2, a2, l2, "next", t3);
        }
        function l2(t3) {
          e(o2, s2, n2, a2, l2, "throw", t3);
        }
        a2(void 0);
      }));
    };
  }
  function i() {
    return i = Object.assign ? Object.assign.bind() : function(e2) {
      for (var t2 = 1; arguments.length > t2; t2++) {
        var i2 = arguments[t2];
        for (var r2 in i2) ({}).hasOwnProperty.call(i2, r2) && (e2[r2] = i2[r2]);
      }
      return e2;
    }, i.apply(null, arguments);
  }
  function r(e2, t2) {
    if (null == e2) return {};
    var i2 = {};
    for (var r2 in e2) if ({}.hasOwnProperty.call(e2, r2)) {
      if (-1 !== t2.indexOf(r2)) continue;
      i2[r2] = e2[r2];
    }
    return i2;
  }
  var s = "1.404.1";
  var n = { DEBUG: false, LIB_VERSION: s, LIB_NAME: "web", JS_SDK_VERSION: s };
  var o = "$people_distinct_id";
  var a = "$device_id";
  var l = "$device_model";
  var u = "__alias";
  var c = "__timers";
  var d = "$autocapture_disabled_server_side";
  var _ = "$heatmaps_enabled_server_side";
  var h = "$exception_capture_enabled_server_side";
  var p = "$error_tracking_suppression_rules";
  var g = "$error_tracking_capture_extension_exceptions";
  var v = "$web_vitals_enabled_server_side";
  var f = "$dead_clicks_enabled_server_side";
  var m = "$product_tours_enabled_server_side";
  var y = "$web_vitals_allowed_metrics";
  var b = "$session_recording_remote_config";
  var w = "$replay_sample_rate";
  var S = "$replay_override_sampling";
  var E = "$replay_override_linked_flag";
  var x = "$replay_override_url_trigger";
  var k = "$replay_override_event_trigger";
  var P = "$sesid";
  var I = "$session_is_sampled";
  var C = "$enabled_feature_flags";
  var T = "$active_feature_flags";
  var F = "$early_access_features";
  var R = "$feature_flag_details";
  var L = "$feature_flag_payloads";
  var M = "$feature_flag_request_id";
  var A = "$override_feature_flags";
  var O = "$override_feature_flag_payloads";
  var D = "$stored_person_properties";
  var N = "$stored_group_properties";
  var B = "$surveys";
  var U = "$surveys_loaded_at";
  var q = "$surveys_activated";
  var H = "ph_product_tours";
  var z = "$flag_call_reported";
  var j = "$flag_call_reported_session_id";
  var V = "$feature_flag_errors";
  var W = "$feature_flag_evaluated_at";
  var G = "$user_state";
  var Q = "$client_session_props";
  var K = "$capture_rate_limit";
  var Y = "$initial_campaign_params";
  var J = "$initial_referrer_info";
  var Z = "$initial_person_info";
  var X = "$epp";
  var ee = "__POSTHOG_TOOLBAR__";
  var te = "$posthog_cookieless";
  var ie = "$sdk_debug_extensions_init_method";
  var re = "$sdk_debug_extensions_init_time_ms";
  var se = "$sdk_debug_recording_script_not_loaded";
  var ne = "PostHog loadExternalDependency extension not found.";
  var oe = "on_reject";
  var ae = "always";
  var le = "anonymous";
  var ue = "identified";
  var ce = "identified_only";
  var de = "visibilitychange";
  var _e = "beforeunload";
  var he = "$pageview";
  var pe = "$pageleave";
  var ge = "$identify";
  var ve = "$groupidentify";
  var fe = "undefined" != typeof window ? window : void 0;
  var me = "undefined" != typeof globalThis ? globalThis : fe;
  "undefined" == typeof self && (me.self = me), "undefined" == typeof File && (me.File = function() {
  });
  var ye = null == me ? void 0 : me.navigator;
  var be = null == me ? void 0 : me.document;
  var we = null == me ? void 0 : me.location;
  var Se = null == me ? void 0 : me.fetch;
  var Ee = null != me && me.XMLHttpRequest && "withCredentials" in new me.XMLHttpRequest() ? me.XMLHttpRequest : void 0;
  var xe = null == me ? void 0 : me.AbortController;
  var ke = null == me ? void 0 : me.CompressionStream;
  var Pe = null == ye ? void 0 : ye.userAgent;
  var Ie = null != fe ? fe : {};
  function Ce() {
    return !(!fe || false === fe.navigator.onLine);
  }
  var Te = (e2) => {
    if ("string" != typeof e2) return e2;
    try {
      return JSON.parse(e2);
    } catch (t2) {
      return e2;
    }
  };
  function Fe(e2) {
    return "string" == typeof e2 || e2;
  }
  function Re(e2) {
    return "string" == typeof e2 ? e2 : void 0;
  }
  var Le;
  var Me = (function(e2) {
    return e2.AnonymousId = "anonymous_id", e2.DistinctId = "distinct_id", e2.Props = "props", e2.EnablePersonProcessing = "enable_person_processing", e2.PersonMode = "person_mode", e2.FeatureFlagDetails = "feature_flag_details", e2.FeatureFlags = "feature_flags", e2.FeatureFlagPayloads = "feature_flag_payloads", e2.BootstrapFeatureFlagDetails = "bootstrap_feature_flag_details", e2.BootstrapFeatureFlags = "bootstrap_feature_flags", e2.BootstrapFeatureFlagPayloads = "bootstrap_feature_flag_payloads", e2.OverrideFeatureFlags = "override_feature_flags", e2.Queue = "queue", e2.AiQueue = "ai_queue", e2.LogsQueue = "logs_queue", e2.OptedOut = "opted_out", e2.SessionId = "session_id", e2.SessionStartTimestamp = "session_start_timestamp", e2.SessionLastTimestamp = "session_timestamp", e2.PersonProperties = "person_properties", e2.GroupProperties = "group_properties", e2.InstalledAppBuild = "installed_app_build", e2.InstalledAppVersion = "installed_app_version", e2.SessionReplay = "session_replay", e2.SessionReplayEventTriggerActivatedSession = "session_replay_event_trigger_activated_session", e2.SurveyLastSeenDate = "survey_last_seen_date", e2.SurveysSeen = "surveys_seen", e2.Surveys = "surveys", e2.RemoteConfig = "remote_config", e2.FlagsEndpointWasHit = "flags_endpoint_was_hit", e2.DeviceId = "device_id", e2;
  })({});
  var Ae = (function(e2) {
    return e2.GZipJS = "gzip-js", e2.Base64 = "base64", e2;
  })({});
  var Oe = ["$snapshot", "$pageview", "$pageleave", "$set", "survey dismissed", "survey sent", "survey shown", "$identify", "$groupidentify", "$create_alias", "$$client_ingestion_warning", "$web_experiment_applied", "$feature_enrollment_update", "$feature_flag_called"];
  var $e = ["token"];
  var De = "NativeGzipValidationError";
  var Ne = (e2) => e2.length >= 2 && 31 === e2[0] && 139 === e2[1];
  var Be = (e2, t2) => e2 === Ae.GZipJS || t2 === Ae.GZipJS || "gzip" === t2;
  var Ue = (e2) => !(!e2 || "object" != typeof e2) && "NotReadableError" === ("name" in e2 ? String(e2.name) : "");
  var qe = (e2) => {
    var t2 = new Error("Native gzip produced invalid output: " + e2);
    throw t2.name = De, t2;
  };
  var He = (function() {
    var e2 = t((function* (e3, t2) {
      18 > e3.size && qe("too-short");
      var i2 = new Uint8Array(yield e3.slice(0, 10).arrayBuffer());
      Ne(i2) && 8 === i2[2] || qe("invalid-header");
      var r2 = new DataView(yield e3.slice(e3.size - 8).arrayBuffer());
      r2.getUint32(0, true) !== ((e4) => {
        for (var t3 = (() => {
          if (Le) return Le;
          Le = [];
          for (var e5 = 0; 256 > e5; e5++) {
            for (var t4 = e5, i4 = 0; 8 > i4; i4++) t4 = 1 & t4 ? 3988292384 ^ t4 >>> 1 : t4 >>> 1;
            Le[e5] = t4 >>> 0;
          }
          return Le;
        })(), i3 = 4294967295, r3 = 0; e4.length > r3; r3++) i3 = t3[255 & (i3 ^ e4[r3])] ^ i3 >>> 8;
        return (4294967295 ^ i3) >>> 0;
      })(t2) && qe("invalid-crc");
      var s2 = t2.length >>> 0;
      r2.getUint32(4, true) !== s2 && qe("invalid-size");
    }));
    return function(t2, i2) {
      return e2.apply(this, arguments);
    };
  })();
  function ze() {
    return ze = t((function* (e2, i2, r2) {
      void 0 === i2 && (i2 = true);
      try {
        var s2 = new TextEncoder().encode(e2), n2 = new globalThis.CompressionStream("gzip"), o2 = n2.writable.getWriter(), a2 = o2.write(s2).then((() => o2.close())).catch((function() {
          var e3 = t((function* (e4) {
            try {
              yield o2.abort(e4);
            } catch (e5) {
            }
            throw e4;
          }));
          return function(t2) {
            return e3.apply(this, arguments);
          };
        })()), l2 = new Response(n2.readable).blob(), u2 = (yield Promise.all([l2, a2]))[0];
        return yield He(u2, s2), u2;
      } catch (e3) {
        if (null != r2 && r2.rethrow) throw e3;
        return i2 && console.error("Failed to gzip compress data", e3), null;
      }
    })), ze.apply(this, arguments);
  }
  var je = ["amazonbot", "amazonproductbot", "app.hypefactors.com", "applebot", "archive.org_bot", "awariobot", "backlinksextendedbot", "baiduspider", "bingbot", "bingpreview", "chrome-lighthouse", "dataforseobot", "deepscan", "duckduckbot", "facebookexternal", "facebookcatalog", "http://yandex.com/bots", "hubspot", "ia_archiver", "leikibot", "linkedinbot", "meta-externalagent", "mj12bot", "msnbot", "nessus", "petalbot", "pinterest", "prerender", "rogerbot", "screaming frog", "sebot-wa", "sitebulb", "slackbot", "slurp", "trendictionbot", "turnitin", "twitterbot", "vercel-screenshot", "vercelbot", "yahoo! slurp", "yandexbot", "zoombot", "bot.htm", "bot.php", "(bot;", "bot/", "crawler", "ahrefsbot", "ahrefssiteaudit", "semrushbot", "siteauditbot", "splitsignalbot", "gptbot", "oai-searchbot", "chatgpt-user", "perplexitybot", "better uptime bot", "sentryuptimebot", "uptimerobot", "headlesschrome", "cypress", "google-hoteladsverifier", "adsbot-google", "apis-google", "duplexweb-google", "feedfetcher-google", "google favicon", "google web preview", "google-read-aloud", "googlebot", "googleother", "google-cloudvertexbot", "googleweblight", "mediapartners-google", "storebot-google", "google-inspectiontool", "bytespider"];
  var Ve = function(e2, t2) {
    if (void 0 === t2 && (t2 = []), !e2) return false;
    var i2 = e2.toLowerCase();
    return je.concat(t2).some(((e3) => {
      var t3 = e3.toLowerCase();
      return -1 !== i2.indexOf(t3);
    }));
  };
  function We(e2, t2) {
    return -1 !== e2.indexOf(t2);
  }
  var Ge = function(e2) {
    return e2.trim();
  };
  var Qe = function(e2) {
    return e2.replace(/^\$/, "");
  };
  function Ke(e2) {
    var t2, i2 = [];
    return null !== (t2 = JSON.stringify(e2, (function(e3, t3) {
      if ("bigint" == typeof t3) return t3.toString();
      if ("function" != typeof t3 && "symbol" != typeof t3) {
        if (t3 instanceof Error) return { name: t3.name, message: t3.message, stack: t3.stack };
        if (t3 && "object" == typeof t3) {
          for (; i2.length > 0 && i2[i2.length - 1] !== this; ) i2.pop();
          if (i2.includes(t3)) return "[Circular]";
          i2.push(t3);
        }
        return t3;
      }
    }))) && void 0 !== t2 ? t2 : "null";
  }
  var Ye = Object.prototype;
  var Je = Ye.hasOwnProperty;
  var Ze = Ye.toString;
  var Xe = Array.isArray || function(e2) {
    return "[object Array]" === Ze.call(e2);
  };
  var et = (e2) => "function" == typeof e2;
  var tt = (e2) => e2 === Object(e2) && !Xe(e2);
  var it = (e2) => {
    if (tt(e2)) {
      for (var t2 in e2) if (Je.call(e2, t2)) return false;
      return true;
    }
    return false;
  };
  var rt = (e2) => void 0 === e2;
  var st = (e2) => "[object String]" == Ze.call(e2);
  var nt = (e2) => st(e2) && 0 === e2.trim().length;
  var ot = (e2) => null === e2;
  var at = (e2) => rt(e2) || ot(e2);
  var lt = (e2) => "[object Number]" == Ze.call(e2) && e2 == e2;
  var ut = (e2) => lt(e2) && e2 > 0;
  var ct = (e2) => "[object Boolean]" === Ze.call(e2);
  var dt = (e2) => e2 instanceof FormData;
  var _t = (e2) => We(Oe, e2);
  var ht = (e2) => We($e, e2);
  function pt(e2) {
    return null === e2 || "object" != typeof e2;
  }
  function gt(e2, t2) {
    return {}.toString.call(e2) === "[object " + t2 + "]";
  }
  function vt(e2) {
    return "undefined" != typeof Event && (function(e3, t2) {
      try {
        return e3 instanceof t2;
      } catch (e4) {
        return false;
      }
    })(e2, Event);
  }
  var ft = [true, "true", 1, "1", "yes"];
  var mt = (e2) => We(ft, e2);
  var yt = [false, "false", 0, "0", "no"];
  function bt(e2, t2, i2, r2, s2) {
    return t2 > i2 && (r2.warn("min cannot be greater than max."), t2 = i2), lt(e2) ? e2 > i2 ? (r2.warn(" cannot be  greater than max: " + i2 + ". Using max value instead."), i2) : t2 > e2 ? (r2.warn(" cannot be less than min: " + t2 + ". Using min value instead."), t2) : e2 : (r2.warn(" must be a number. using max or fallback. max: " + i2 + ", fallback: " + s2), bt(s2 || i2, t2, i2, r2));
  }
  var wt = class {
    constructor(e2) {
      this._buckets = {}, this._onBucketRateLimited = e2._onBucketRateLimited, this._bucketSize = bt(e2.bucketSize, 0, 100, e2._logger), this._refillRate = bt(e2.refillRate, 0, this._bucketSize, e2._logger), this._refillInterval = bt(e2.refillInterval, 0, 864e5, e2._logger);
    }
    _applyRefill(e2, t2) {
      var i2 = Math.floor((t2 - e2.lastAccess) / this._refillInterval);
      i2 > 0 && (e2.tokens = Math.min(e2.tokens + i2 * this._refillRate, this._bucketSize), e2.lastAccess = e2.lastAccess + i2 * this._refillInterval);
    }
    consumeRateLimit(e2) {
      var t2, i2 = Date.now(), r2 = String(e2), s2 = this._buckets[r2];
      return s2 ? this._applyRefill(s2, i2) : this._buckets[r2] = s2 = { tokens: this._bucketSize, lastAccess: i2 }, 0 === s2.tokens || (s2.tokens--, 0 === s2.tokens && (null == (t2 = this._onBucketRateLimited) || t2.call(this, e2)), 0 === s2.tokens);
    }
    stop() {
      this._buckets = {};
    }
  };
  var St = "Mobile";
  var Et = "iOS";
  var xt = "Android";
  var kt = "Tablet";
  var Pt = xt + " " + kt;
  var It = "iPad";
  var Ct = "Apple";
  var Tt = Ct + " Watch";
  var Ft = "Safari";
  var Rt = "BlackBerry";
  var Lt = "Samsung";
  var Mt = Lt + "Browser";
  var At = Lt + " Internet";
  var Ot = "Chrome";
  var $t = Ot + " OS";
  var Dt = Ot + " " + Et;
  var Nt = "Internet Explorer";
  var Bt = Nt + " " + St;
  var Ut = "Opera";
  var qt = Ut + " Mini";
  var Ht = "Edge";
  var zt = "Microsoft " + Ht;
  var jt = "Firefox";
  var Vt = jt + " " + Et;
  var Wt = "Nintendo";
  var Gt = "PlayStation";
  var Qt = "Xbox";
  var Kt = xt + " " + St;
  var Yt = St + " " + Ft;
  var Jt = "Windows";
  var Zt = Jt + " Phone";
  var Xt = "Nokia";
  var ei = "Ouya";
  var ti = "Generic";
  var ii = ti + " " + St.toLowerCase();
  var ri = ti + " " + kt.toLowerCase();
  var si = "Konqueror";
  var ni = "Oculus Browser";
  var oi = "Vivaldi";
  var ai = "Yandex";
  var li = "Whale";
  var ui = "DuckDuckGo";
  var ci = "Pale Moon";
  var di = "Waterfox";
  var _i = "Brave";
  var hi = "Google Search App";
  var pi = "(\\d+(\\.\\d+)?)";
  var gi = new RegExp("Version/" + pi);
  var vi = new RegExp(Qt, "i");
  var fi = new RegExp(Gt + " \\w+", "i");
  var mi = new RegExp(Wt + " \\w+", "i");
  var yi = new RegExp(Rt + "|PlayBook|BB10", "i");
  var bi = { "NT3.51": "NT 3.11", "NT4.0": "NT 4.0", "5.0": "2000", 5.1: "XP", 5.2: "XP", "6.0": "Vista", 6.1: "7", 6.2: "8", 6.3: "8.1", 6.4: "10", "10.0": "10" };
  var wi = function(e2, t2, i2, r2) {
    t2 = t2 || "";
    var s2 = (function(e3) {
      return null != e3 && e3.brave ? _i : null;
    })(i2);
    return s2 || (null != r2 && r2.detectGoogleSearchApp && We(e2, "GSA/") ? hi : We(e2, " OPR/") && We(e2, "Mini") ? qt : We(e2, " OPR/") ? Ut : yi.test(e2) ? Rt : We(e2, "IE" + St) || We(e2, "WPDesktop") ? Bt : We(e2, "OculusBrowser") ? ni : We(e2, Mt) ? At : We(e2, Ht) || We(e2, "Edg/") ? zt : We(e2, oi + "/") ? oi : We(e2, "YaBrowser/") ? ai : We(e2, li + "/") ? li : We(e2, ui + "/") || We(e2, "Ddg/") ? ui : We(e2, "FBIOS") ? "Facebook " + St : We(e2, "UCWEB") || We(e2, "UCBrowser") ? "UC Browser" : We(e2, "CriOS") ? Dt : We(e2, "CrMo") || We(e2, Ot) ? Ot : We(e2, xt) && We(e2, Ft) ? Kt : We(e2, "FxiOS") ? Vt : We(e2.toLowerCase(), si.toLowerCase()) ? si : We(e2, _i + "/") ? _i : ((e3, t3) => t3 && We(t3, Ct) || (function(e4) {
      return We(e4, Ft) && !We(e4, Ot) && !We(e4, xt);
    })(e3))(e2, t2) ? We(e2, St) ? Yt : Ft : We(e2, "PaleMoon/") ? ci : We(e2, di + "/") ? di : We(e2, jt) ? jt : We(e2, "MSIE") || We(e2, "Trident/") ? Nt : We(e2, "Gecko") ? jt : "");
  };
  var Si = { [Bt]: [new RegExp("rv:" + pi)], [zt]: [new RegExp(Ht + "?\\/" + pi)], [Ot]: [new RegExp("(" + Ot + "|CrMo)\\/" + pi)], [Dt]: [new RegExp("CriOS\\/" + pi)], "UC Browser": [new RegExp("(UCBrowser|UCWEB)\\/" + pi)], [Ft]: [gi], [Yt]: [gi], [Ut]: [new RegExp("(Opera|OPR)\\/" + pi)], [jt]: [new RegExp(jt + "\\/" + pi)], [Vt]: [new RegExp("FxiOS\\/" + pi)], [si]: [new RegExp("Konqueror[:/]?" + pi, "i")], [Rt]: [new RegExp(Rt + " " + pi), gi], [Kt]: [new RegExp("android\\s" + pi, "i")], [At]: [new RegExp(Mt + "\\/" + pi)], [ni]: [new RegExp("OculusBrowser\\/" + pi)], [oi]: [new RegExp(oi + "\\/" + pi)], [ai]: [new RegExp("YaBrowser\\/" + pi)], [li]: [new RegExp(li + "\\/" + pi)], [_i]: [new RegExp(_i + "\\/" + pi)], [ui]: [new RegExp("(DuckDuckGo|Ddg)\\/" + pi)], [ci]: [new RegExp("PaleMoon\\/" + pi)], [di]: [new RegExp(di + "\\/" + pi)], [hi]: [new RegExp("GSA\\/" + pi)], [Nt]: [new RegExp("(rv:|MSIE )" + pi)], Mozilla: [new RegExp("rv:" + pi)] };
  var Ei = function(e2, t2, i2, r2) {
    var s2 = wi(e2, t2, i2, r2), n2 = Si[s2];
    if (rt(n2)) return null;
    for (var o2 = 0; n2.length > o2; o2++) {
      var a2 = e2.match(n2[o2]);
      if (a2) return parseFloat(a2[a2.length - 2]);
    }
    return null;
  };
  var xi = [[new RegExp(Qt + "; " + Qt + " (.*?)[);]", "i"), (e2) => [Qt, e2 && e2[1] || ""]], [new RegExp(Wt, "i"), [Wt, ""]], [new RegExp(Gt, "i"), [Gt, ""]], [yi, [Rt, ""]], [new RegExp(Jt, "i"), (e2, t2) => {
    if (/Phone/.test(t2) || /WPDesktop/.test(t2)) return [Zt, ""];
    if (new RegExp(St).test(t2) && !/IEMobile\b/.test(t2)) return [Jt + " " + St, ""];
    var i2 = /Windows NT ([0-9.]+)/i.exec(t2);
    if (i2 && i2[1]) {
      var r2 = bi[i2[1]] || "";
      return /arm/i.test(t2) && (r2 = "RT"), [Jt, r2];
    }
    return [Jt, ""];
  }], [/((iPhone|iPad|iPod).*?OS (\d+)_(\d+)_?(\d+)?|iPhone)/, (e2) => e2 && e2[3] ? [Et, [e2[3], e2[4], e2[5] || "0"].join(".")] : [Et, ""]], [/(watch.*\/(\d+\.\d+\.\d+)|watch os,(\d+\.\d+),)/i, (e2) => {
    var t2 = "";
    return e2 && e2.length >= 3 && (t2 = rt(e2[2]) ? e2[3] : e2[2]), ["watchOS", t2];
  }], [new RegExp("(" + xt + " (\\d+)\\.(\\d+)\\.?(\\d+)?|" + xt + ")", "i"), (e2) => e2 && e2[2] ? [xt, [e2[2], e2[3], e2[4] || "0"].join(".")] : [xt, ""]], [/Mac OS X (\d+)[_.](\d+)[_.]?(\d+)?/i, (e2) => {
    var t2 = ["Mac OS X", ""];
    return e2 && e2[1] && (t2[1] = [e2[1], e2[2], e2[3] || "0"].join(".")), t2;
  }], [/Mac/i, ["Mac OS X", ""]], [/CrOS/, [$t, ""]], [/Linux|debian/i, ["Linux", ""]]];
  var ki = function(e2) {
    return mi.test(e2) ? Wt : fi.test(e2) ? Gt : vi.test(e2) ? Qt : new RegExp(ei, "i").test(e2) ? ei : new RegExp("(" + Zt + "|WPDesktop)", "i").test(e2) ? Zt : /iPad/.test(e2) ? It : /iPod/.test(e2) ? "iPod Touch" : /iPhone/.test(e2) ? "iPhone" : /(watch)(?: ?os[,/]|\d,\d\/)[\d.]+/i.test(e2) ? Tt : yi.test(e2) ? Rt : /(kobo)\s(ereader|touch)/i.test(e2) ? "Kobo" : new RegExp(Xt, "i").test(e2) ? Xt : /(kf[a-z]{2}wi|aeo[c-r]{2})( bui|\))/i.test(e2) || /(kf[a-z]+)( bui|\)).+silk\//i.test(e2) ? "Kindle Fire" : /(Android|ZTE)/i.test(e2) ? new RegExp(St).test(e2) && !/(9138B|TB782B|Nexus [97]|pixel c|HUAWEISHT|BTV|noble nook|smart ultra 6)/i.test(e2) || /pixel[\daxl ]{1,6}/i.test(e2) && !/pixel c/i.test(e2) || /(huaweimed-al00|tah-|APA|SM-G92|i980|zte|U304AA)/i.test(e2) || /lmy47v/i.test(e2) && !/QTAQZ3/i.test(e2) ? xt : Pt : new RegExp("(pda|" + St + ")", "i").test(e2) ? ii : new RegExp(kt, "i").test(e2) && !new RegExp(kt + " pc", "i").test(e2) ? ri : "";
  };
  var Pi = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function Ii(e2, t2) {
    return "string" == typeof (i2 = e2) && Pi.test(i2) ? e2 : t2();
    var i2;
  }
  function Ci(e2) {
    return e2 ? e2.split("#")[0] : e2;
  }
  function Ti(e2, t2) {
    var i2 = setTimeout(e2, t2);
    return (null == i2 ? void 0 : i2.unref) && (null == i2 || i2.unref()), i2;
  }
  var Fi = (e2) => e2 instanceof Error;
  var Ri = { trace: { text: "TRACE", number: 1 }, debug: { text: "DEBUG", number: 5 }, info: { text: "INFO", number: 9 }, warn: { text: "WARN", number: 13 }, error: { text: "ERROR", number: 17 }, fatal: { text: "FATAL", number: 21 } };
  var Li = Ri.info;
  function Mi(e2) {
    if (ct(e2)) return { boolValue: e2 };
    if ("number" == typeof e2) return Number.isFinite(e2) ? Number.isInteger(e2) ? { intValue: e2 } : { doubleValue: e2 } : { stringValue: String(e2) };
    if ("string" == typeof e2) return { stringValue: e2 };
    if (Xe(e2)) return { arrayValue: { values: e2.map(((e3) => Mi(e3))) } };
    try {
      return { stringValue: JSON.stringify(e2) };
    } catch (t2) {
      return { stringValue: String(e2) };
    }
  }
  function Ai(e2) {
    var t2 = [];
    for (var i2 in e2) {
      var r2 = e2[i2];
      ot(r2) || rt(r2) || t2.push({ key: i2, value: Mi(r2) });
    }
    return t2;
  }
  function Oi(e2, t2) {
    var r2 = Ri[e2.level || "info"] || Li, s2 = r2.text, n2 = r2.number, o2 = String(Date.now()) + "000000", a2 = {};
    t2.distinctId && (a2.posthogDistinctId = t2.distinctId), t2.sessionId && (a2.sessionId = t2.sessionId), t2.windowId && (a2["window.id"] = t2.windowId), at(t2.sessionStartTimestamp) || (a2.sessionStartTimestamp = String(t2.sessionStartTimestamp)), at(t2.lastActivityTimestamp) || (a2.lastActivityTimestamp = String(t2.lastActivityTimestamp)), t2.currentUrl && (a2["url.full"] = t2.currentUrl), t2.screenName && (a2["screen.name"] = t2.screenName), t2.appState && (a2["app.state"] = t2.appState), t2.activeFeatureFlags && t2.activeFeatureFlags.length > 0 && (a2.feature_flags = t2.activeFeatureFlags);
    var l2 = i({}, a2, e2.attributes || {}), u2 = { timeUnixNano: o2, observedTimeUnixNano: o2, severityNumber: n2, severityText: s2, body: { stringValue: e2.body }, attributes: Ai(l2) };
    return e2.trace_id && (u2.traceId = e2.trace_id), e2.span_id && (u2.spanId = e2.span_id), rt(e2.trace_flags) || (u2.flags = e2.trace_flags), u2;
  }
  function $i(e2, t2, r2) {
    return i({}, e2.resourceAttributes, { "service.name": e2.serviceName || "unknown_service" }, e2.environment && { "deployment.environment": e2.environment }, e2.serviceVersion && { "service.version": e2.serviceVersion }, { "telemetry.sdk.name": t2, "telemetry.sdk.version": r2 });
  }
  function Di(e2, t2, i2, r2) {
    return { resourceLogs: [{ resource: { attributes: Ai(t2) }, scopeLogs: [{ scope: { name: i2, version: r2 }, logRecords: e2 }] }] };
  }
  var Ni = class {
    constructor(e2, t2, i2, r2, s2, n2, o2) {
      var a2;
      void 0 === n2 && (n2 = () => Promise.resolve()), this._instance = e2, this._config = t2, this._logger = i2, this._getContext = r2, this._onReady = s2, this._waitForStoragePersist = n2, this._scopeName = o2, this._flushPromise = null, this._evictedSinceAdvance = 0, this._consecutiveFlushFailures = 0, this._intervalWindowStart = 0, this._intervalLogCount = 0, this._droppedWarned = false, this._maxBufferSize = t2.maxBufferSize, this._maxQueueSize = Math.max(null !== (a2 = t2.maxQueueSize) && void 0 !== a2 ? a2 : t2.maxBufferSize, t2.maxBufferSize), this._flushIntervalMs = t2.flushIntervalMs, this._maxBatchRecordsPerPost = t2.maxBatchRecordsPerPost, this._rateCapWindowMs = t2.rateCapWindowMs, this._maxLogsPerInterval = t2.maxLogsPerInterval;
    }
    reset() {
      this._clearFlushTimer(), this._flushPromise = null, this._intervalWindowStart = 0, this._intervalLogCount = 0, this._droppedWarned = false, this._evictedSinceAdvance = 0, this._consecutiveFlushFailures = 0, this._maxBatchRecordsPerPost = this._config.maxBatchRecordsPerPost;
    }
    onReconnect() {
      this._consecutiveFlushFailures = 0, this._flushInBackground();
    }
    captureLog(e2) {
      if (!this._instance.isDisabled && !this._instance.optedOut && null != e2 && e2.body) {
        var t2 = this._runBeforeSend(e2);
        if (null !== t2) if (t2.body) {
          if (this._checkRateLimit()) {
            var i2 = { record: Oi(t2, this._getContext()) };
            this._onReady((() => this._enqueue(i2)));
          }
        } else this._logger.info("Log was rejected in beforeSend function");
      }
    }
    _runBeforeSend(e2) {
      var t2 = this._config.beforeSend;
      if (!t2) return e2;
      var i2 = Xe(t2) ? t2 : [t2], r2 = e2;
      for (var s2 of i2) try {
        var n2 = s2(r2);
        if (!n2) return this._logger.info("Log was rejected in beforeSend function"), null;
        r2 = n2;
      } catch (e3) {
        return this._logger.error("Error in beforeSend function for log:", e3), null;
      }
      return r2;
    }
    _checkRateLimit() {
      if (void 0 === this._maxLogsPerInterval) return true;
      var e2 = Date.now(), t2 = e2 - this._intervalWindowStart;
      return this._rateCapWindowMs > t2 && t2 >= 0 || (this._intervalWindowStart = e2, this._intervalLogCount = 0, this._droppedWarned = false), this._maxLogsPerInterval > this._intervalLogCount ? (this._intervalLogCount++, true) : (this._droppedWarned || (this._logger.warn("captureLog dropping logs: exceeded " + this._maxLogsPerInterval + " logs per " + this._rateCapWindowMs + "ms"), this._droppedWarned = true), false);
    }
    flush() {
      var e2 = this;
      return t((function* () {
        if (!e2._instance.isDisabled) return e2._flushPromise || (e2._flushPromise = e2._flushInner().finally((() => {
          e2._flushPromise = null;
        }))), e2._flushPromise;
      }))();
    }
    _flushInner() {
      var e2 = this;
      return t((function* () {
        var t2;
        e2._clearFlushTimer();
        var i2 = null !== (t2 = e2._instance.getPersistedProperty(Me.LogsQueue)) && void 0 !== t2 ? t2 : [];
        if (0 !== i2.length) for (var r2 = i2.length, s2 = 0; i2.length > 0 && r2 > s2; ) {
          var n2, o2;
          e2._evictedSinceAdvance = 0;
          var a2 = Math.min(i2.length, e2._maxBatchRecordsPerPost), l2 = i2.slice(0, a2), u2 = Di(l2.map(((e3) => e3.record)), e2._buildResourceAttributes(), null !== (n2 = e2._scopeName) && void 0 !== n2 ? n2 : e2._instance.getLibraryId(), e2._instance.getLibraryVersion()), c2 = yield e2._instance._sendLogsBatch(u2);
          if ("too-large" === c2.kind && l2.length > 1) e2._maxBatchRecordsPerPost = Math.max(1, Math.floor(l2.length / 2)), e2._logger.warn("Received 413 when sending logs batch of size " + l2.length + ", reducing batch size to " + e2._maxBatchRecordsPerPost);
          else {
            if ("retry-later" === c2.kind) throw c2.error;
            if ("too-large" === c2.kind ? e2._logger.warn("Dropping a single log record after 413 with batch size 1 \u2014 the record is larger than the server cap and cannot be split further.") : "ok" === c2.kind && e2._config.maxBatchRecordsPerPost > e2._maxBatchRecordsPerPost && (e2._maxBatchRecordsPerPost = Math.min(e2._config.maxBatchRecordsPerPost, e2._maxBatchRecordsPerPost + 1)), yield e2._persistQueueAdvance(l2.length), i2 = null !== (o2 = e2._instance.getPersistedProperty(Me.LogsQueue)) && void 0 !== o2 ? o2 : [], s2 += l2.length, "fatal" === c2.kind) throw c2.error;
          }
        }
      }))();
    }
    _persistQueueAdvance(e2) {
      var i2 = this;
      return t((function* () {
        var t2, r2 = Math.max(0, e2 - i2._evictedSinceAdvance), s2 = null !== (t2 = i2._instance.getPersistedProperty(Me.LogsQueue)) && void 0 !== t2 ? t2 : [];
        i2._instance.setPersistedProperty(Me.LogsQueue, s2.slice(r2)), yield i2._waitForStoragePersist();
      }))();
    }
    _buildResourceAttributes() {
      return $i(this._config, this._instance.getLibraryId(), this._instance.getLibraryVersion());
    }
    _enqueue(e2) {
      var t2;
      if (!this._instance.optedOut) {
        var i2 = null !== (t2 = this._instance.getPersistedProperty(Me.LogsQueue)) && void 0 !== t2 ? t2 : [];
        this._maxQueueSize > i2.length || (i2.shift(), this._evictedSinceAdvance++, this._logger.info("Logs queue is full, dropping oldest record.")), i2.push(e2), this._instance.setPersistedProperty(Me.LogsQueue, i2), this._maxBufferSize > i2.length ? this._armFlushTimer() : this._flushInBackground();
      }
    }
    _armFlushTimer(e2) {
      void 0 === e2 && (e2 = this._flushIntervalMs), this._flushTimer || (this._flushTimer = Ti((() => {
        this._flushTimer = void 0, this._flushInBackground();
      }), e2));
    }
    _nextFlushDelay() {
      var e2 = Math.min(Math.max(0, this._consecutiveFlushFailures - 1), 6);
      return this._flushIntervalMs * Math.pow(2, e2);
    }
    _hasQueuedRecords() {
      var e2 = this._instance.getPersistedProperty(Me.LogsQueue);
      return !!e2 && e2.length > 0;
    }
    shutdown(e2) {
      var i2 = this;
      return t((function* () {
        i2._clearFlushTimer();
        var t2 = i2.flush().catch((() => {
        }));
        void 0 !== e2 ? yield Promise.race([t2, new Promise(((t3) => Ti(t3, e2)))]) : yield t2;
      }))();
    }
    flushWithTimeout(e2) {
      var i2 = this;
      return t((function* () {
        var t2 = false, r2 = i2.flush(), s2 = new Promise(((i3) => Ti((() => {
          t2 = true, i3();
        }), e2)));
        try {
          yield Promise.race([r2, s2]);
        } finally {
          t2 && r2.catch((() => {
          }));
        }
      }))();
    }
    _flushInBackground() {
      this.flush().then((() => {
        this._consecutiveFlushFailures = 0;
      }), ((e2) => {
        this._consecutiveFlushFailures++, this._logger.error("PostHog logs flush failed:", e2);
      })).finally((() => {
        !this._instance.isDisabled && this._hasQueuedRecords() && this._armFlushTimer(this._nextFlushDelay());
      }));
    }
    _clearFlushTimer() {
      this._flushTimer && (clearTimeout(this._flushTimer), this._flushTimer = void 0);
    }
  };
  var Bi = [0, 5, 10, 25, 50, 75, 100, 250, 500, 750, 1e3, 2500, 5e3, 7500, 1e4];
  function Ui(e2) {
    return String(e2) + "000000";
  }
  function qi(e2, t2, i2, r2) {
    var s2 = "";
    return r2 && (s2 = Object.keys(r2).sort().map(((e3) => JSON.stringify(e3) + ":" + JSON.stringify(r2[e3]))).join(",")), e2 + "\0" + t2 + "\0" + (null != i2 ? i2 : "") + "\0" + s2;
  }
  var Hi = class {
    constructor(e2, t2, i2) {
      this._instance = e2, this._config = t2, this._logger = i2, this._series = /* @__PURE__ */ new Map(), this._flushPromise = null, this._seriesCapWarned = false, this._typeByName = /* @__PURE__ */ new Map(), this._typeCollisionWarned = /* @__PURE__ */ new Set(), this._generation = 0;
    }
    count(e2, t2, i2) {
      void 0 === t2 && (t2 = 1), this._capture({ name: e2, type: "count", value: t2, unit: null == i2 ? void 0 : i2.unit, attributes: null == i2 ? void 0 : i2.attributes });
    }
    gauge(e2, t2, i2) {
      this._capture({ name: e2, type: "gauge", value: t2, unit: null == i2 ? void 0 : i2.unit, attributes: null == i2 ? void 0 : i2.attributes });
    }
    histogram(e2, t2, i2) {
      this._capture({ name: e2, type: "histogram", value: t2, unit: null == i2 ? void 0 : i2.unit, attributes: null == i2 ? void 0 : i2.attributes });
    }
    flush() {
      var e2 = this, i2 = this._flushPromise, r2 = (function() {
        var r3 = t((function* () {
          i2 && (yield i2.catch((() => {
          }))), yield e2._doFlush();
        }));
        return function() {
          return r3.apply(this, arguments);
        };
      })(), s2 = r2().finally((() => {
        this._flushPromise === s2 && (this._flushPromise = null);
      }));
      return this._flushPromise = s2, s2;
    }
    drainWindow() {
      if (0 === this._series.size) return null;
      var e2 = this._series;
      return this._series = /* @__PURE__ */ new Map(), this._seriesCapWarned = false, this._typeByName = /* @__PURE__ */ new Map(), this._typeCollisionWarned = /* @__PURE__ */ new Set(), this._buildPayload(e2);
    }
    reset() {
      this._generation++, this._clearFlushTimer(), this._series = /* @__PURE__ */ new Map(), this._flushPromise = null, this._seriesCapWarned = false, this._typeByName = /* @__PURE__ */ new Map(), this._typeCollisionWarned = /* @__PURE__ */ new Set();
    }
    _capture(e2) {
      if (!this._instance.isDisabled && !this._instance.optedOut) {
        var t2 = this._runBeforeSend(e2);
        if (null !== t2) if (t2.name && "string" == typeof t2.name) if ("number" == typeof t2.value && Number.isFinite(t2.value)) if ("count" === t2.type && 0 > t2.value) this._logger.warn("Dropping count '" + t2.name + "': counters are monotonic, value must be >= 0");
        else {
          var r2, s2;
          try {
            r2 = t2.attributes ? i({}, t2.attributes) : void 0, s2 = qi(t2.type, t2.name, t2.unit, r2);
          } catch (e3) {
            return void this._logger.warn("Dropping metric '" + t2.name + "': attributes could not be serialized", e3);
          }
          var n2 = this._series.get(s2);
          if (!n2) {
            if (!this._admitNewSeries()) return;
            n2 = { name: t2.name, type: t2.type, unit: t2.unit, attributes: r2, windowStartMs: Date.now() }, this._series.set(s2, n2);
          }
          var o2 = this._typeByName.get(t2.name);
          void 0 === o2 ? this._typeByName.set(t2.name, t2.type) : o2 === t2.type || this._typeCollisionWarned.has(t2.name) || (this._typeCollisionWarned.add(t2.name), this._logger.warn("Metric name '" + t2.name + "' is already used as a " + o2 + "; recording it as a " + t2.type + " too will blend both series in charts. Use a distinct name.")), this._fold(n2, t2.value), this._armFlushTimer();
        }
        else this._logger.warn("Dropping metric '" + t2.name + "': value must be a finite number");
        else this._logger.warn("Dropping metric with empty name");
      }
    }
    _admitNewSeries() {
      return this._config.maxSeriesPerFlush > this._series.size || (this._seriesCapWarned || (this._seriesCapWarned = true, this._logger.warn("Metric series cap reached (" + this._config.maxSeriesPerFlush + " per flush window); dropping new series until the next flush. Reduce attribute cardinality.")), false);
    }
    _fold(e2, t2) {
      var i2;
      switch (e2.type) {
        case "count":
          e2.total = (null !== (i2 = e2.total) && void 0 !== i2 ? i2 : 0) + t2;
          break;
        case "gauge":
          e2.last = t2;
          break;
        case "histogram":
          e2.hist || (e2.hist = { count: 0, sum: 0, min: t2, max: t2, bucketCounts: new Array(Bi.length + 1).fill(0) });
          var r2 = e2.hist;
          r2.count += 1, r2.sum += t2, r2.min = Math.min(r2.min, t2), r2.max = Math.max(r2.max, t2), r2.bucketCounts[(function(e3, t3) {
            for (var i3 = 0; t3.length > i3; i3++) if (t3[i3] >= e3) return i3;
            return t3.length;
          })(t2, Bi)] += 1;
      }
    }
    _runBeforeSend(e2) {
      var t2 = this._config.beforeSend;
      if (!t2) return e2;
      var i2 = Xe(t2) ? t2 : [t2], r2 = e2;
      for (var s2 of i2) try {
        var n2 = s2(r2);
        if (!n2) return this._logger.info("Metric was rejected in beforeSend function"), null;
        r2 = n2;
      } catch (e3) {
        return this._logger.error("Error in beforeSend function for metric:", e3), null;
      }
      return r2;
    }
    _armFlushTimer() {
      this._flushTimer || (this._flushTimer = Ti((() => {
        this._flushTimer = void 0, this.flush().catch(((e2) => {
          this._logger.error("Metrics flush failed:", e2);
        }));
      }), this._config.flushIntervalMs));
    }
    _clearFlushTimer() {
      this._flushTimer && (clearTimeout(this._flushTimer), this._flushTimer = void 0);
    }
    _doFlush() {
      var e2 = this;
      return t((function* () {
        if (0 !== e2._series.size) {
          var t2 = e2._series;
          e2._series = /* @__PURE__ */ new Map(), e2._seriesCapWarned = false, e2._typeByName = /* @__PURE__ */ new Map(), e2._typeCollisionWarned = /* @__PURE__ */ new Set();
          var i2 = e2._generation, r2 = yield e2._instance._sendMetricsBatch(e2._buildPayload(t2));
          if (i2 === e2._generation) switch (r2.kind) {
            case "ok":
              return;
            case "retry-later":
              return e2._mergeWindowBack(t2), void e2._armFlushTimer();
            case "too-large":
              return void e2._logger.warn("Metrics batch exceeded the server size limit and was dropped");
            case "fatal":
              return void e2._logger.error("Failed to send metrics batch:", r2.error);
          }
        }
      }))();
    }
    _buildPayload(e2) {
      return (function(e3, t3, i2, r3) {
        return { resourceMetrics: [{ resource: { attributes: Ai(t3) }, scopeMetrics: [{ scope: { name: i2, version: r3 }, metrics: e3 }] }] };
      })(this._buildMetrics(e2), (t2 = this._config, r2 = this._instance.getLibraryId(), s2 = this._instance.getLibraryVersion(), i({}, t2.resourceAttributes, { "service.name": t2.serviceName || "unknown_service" }, t2.environment && { "deployment.environment": t2.environment }, t2.serviceVersion && { "service.version": t2.serviceVersion }, { "telemetry.sdk.name": r2, "telemetry.sdk.version": s2 })), this._instance.getLibraryId(), this._instance.getLibraryVersion());
      var t2, r2, s2;
    }
    _buildMetrics(e2) {
      var t2 = Ui(Date.now()), r2 = /* @__PURE__ */ new Map();
      for (var s2 of e2.values()) {
        var n2, o2 = qi(s2.type, s2.name, s2.unit, void 0), a2 = r2.get(o2);
        a2 || (a2 = i({ name: s2.name }, s2.unit && { unit: s2.unit }), "count" === s2.type ? a2.sum = { aggregationTemporality: 1, isMonotonic: true, dataPoints: [] } : "gauge" === s2.type ? a2.gauge = { dataPoints: [] } : a2.histogram = { aggregationTemporality: 1, dataPoints: [] }, r2.set(o2, a2));
        var l2 = Ai(null !== (n2 = s2.attributes) && void 0 !== n2 ? n2 : {}), u2 = Ui(s2.windowStartMs);
        if ("count" === s2.type) {
          var c2, d2 = { attributes: l2, startTimeUnixNano: u2, timeUnixNano: t2, asDouble: null !== (c2 = s2.total) && void 0 !== c2 ? c2 : 0 };
          a2.sum.dataPoints.push(d2);
        } else if ("gauge" === s2.type) {
          var _2, h2 = { attributes: l2, timeUnixNano: t2, asDouble: null !== (_2 = s2.last) && void 0 !== _2 ? _2 : 0 };
          a2.gauge.dataPoints.push(h2);
        } else s2.hist && a2.histogram.dataPoints.push({ attributes: l2, startTimeUnixNano: u2, timeUnixNano: t2, count: s2.hist.count, sum: s2.hist.sum, min: s2.hist.min, max: s2.hist.max, bucketCounts: s2.hist.bucketCounts, explicitBounds: Bi });
      }
      return Array.from(r2.values());
    }
    _mergeWindowBack(e2) {
      var t2, i2;
      for (var r2 of e2) {
        var s2 = r2[0], n2 = r2[1], o2 = this._series.get(s2);
        if (o2) switch (o2.windowStartMs = Math.min(o2.windowStartMs, n2.windowStartMs), o2.type) {
          case "count":
            o2.total = (null !== (t2 = o2.total) && void 0 !== t2 ? t2 : 0) + (null !== (i2 = n2.total) && void 0 !== i2 ? i2 : 0);
            break;
          case "gauge":
            break;
          case "histogram":
            if (n2.hist) if (o2.hist) {
              o2.hist.count += n2.hist.count, o2.hist.sum += n2.hist.sum, o2.hist.min = Math.min(o2.hist.min, n2.hist.min), o2.hist.max = Math.max(o2.hist.max, n2.hist.max);
              for (var a2 = 0; o2.hist.bucketCounts.length > a2; a2++) o2.hist.bucketCounts[a2] += n2.hist.bucketCounts[a2];
            } else o2.hist = n2.hist;
        }
        else this._admitNewSeries() && this._series.set(s2, n2);
      }
    }
  };
  var zi;
  var ji;
  var Vi;
  function Wi(e2) {
    var t2 = globalThis._posthogChunkIds;
    if (t2) {
      var i2 = Object.keys(t2);
      return Vi && i2.length === ji || (ji = i2.length, Vi = i2.reduce(((i3, r2) => {
        zi || (zi = {});
        var s2 = zi[r2];
        if (s2) i3[s2[0]] = s2[1];
        else for (var n2 = e2(r2), o2 = n2.length - 1; o2 >= 0; o2--) {
          var a2 = n2[o2], l2 = null == a2 ? void 0 : a2.filename, u2 = t2[r2];
          if (l2 && u2) {
            i3[l2] = u2, zi[r2] = [l2, u2];
            break;
          }
        }
        return i3;
      }), {})), Vi;
    }
  }
  var Gi = class {
    constructor(e2, t2, i2) {
      void 0 === i2 && (i2 = []), this.coercers = e2, this.stackParser = t2, this.modifiers = i2;
    }
    buildFromUnknown(e2, t2) {
      void 0 === t2 && (t2 = {});
      var i2 = t2 && t2.mechanism || { handled: true, type: "generic" }, r2 = this.buildCoercingContext(i2, t2, 0).apply(e2), s2 = this.buildParsingContext(t2), n2 = this.parseStacktrace(r2, s2);
      return { $exception_list: this.convertToExceptionList(n2, i2), $exception_level: "error" };
    }
    modifyFrames(e2) {
      var i2 = this;
      return t((function* () {
        for (var t2 of e2) t2.stacktrace && t2.stacktrace.frames && Xe(t2.stacktrace.frames) && (t2.stacktrace.frames = yield i2.applyModifiers(t2.stacktrace.frames));
        return e2;
      }))();
    }
    coerceFallback(e2) {
      var t2;
      return { type: "Error", value: "Unknown error", stack: null == (t2 = e2.syntheticException) ? void 0 : t2.stack, synthetic: true };
    }
    parseStacktrace(e2, t2) {
      var r2, s2;
      return null != e2.cause && (r2 = this.parseStacktrace(e2.cause, t2)), "" != e2.stack && null != e2.stack && (s2 = this.applyChunkIds(this.stackParser(e2.stack, e2.synthetic ? t2.skipFirstLines : 0), t2.chunkIdMap)), i({}, e2, { cause: r2, stack: s2 });
    }
    applyChunkIds(e2, t2) {
      return e2.map(((e3) => (e3.filename && t2 && (e3.chunk_id = t2[e3.filename]), e3)));
    }
    applyCoercers(e2, t2) {
      for (var i2 of this.coercers) if (i2.match(e2)) return i2.coerce(e2, t2);
      return this.coerceFallback(t2);
    }
    applyModifiers(e2) {
      var i2 = this;
      return t((function* () {
        var t2 = e2;
        for (var r2 of i2.modifiers) t2 = yield r2(t2);
        return t2;
      }))();
    }
    convertToExceptionList(e2, t2) {
      var r2, s2, n2, o2 = { type: e2.type, value: e2.value, mechanism: { type: null !== (r2 = t2.type) && void 0 !== r2 ? r2 : "generic", handled: null === (s2 = t2.handled) || void 0 === s2 || s2, synthetic: null !== (n2 = e2.synthetic) && void 0 !== n2 && n2 } };
      e2.stack && (o2.stacktrace = { type: "raw", frames: e2.stack });
      var a2 = [o2];
      return null != e2.cause && a2.push(...this.convertToExceptionList(e2.cause, i({}, t2, { handled: true }))), a2;
    }
    buildParsingContext(e2) {
      var t2;
      return { chunkIdMap: Wi(this.stackParser), skipFirstLines: null !== (t2 = e2.skipFirstLines) && void 0 !== t2 ? t2 : 1 };
    }
    buildCoercingContext(e2, t2, r2) {
      void 0 === r2 && (r2 = 0);
      var s2 = (i2, r3) => {
        if (4 >= r3) {
          var s3 = this.buildCoercingContext(e2, t2, r3);
          return this.applyCoercers(i2, s3);
        }
      };
      return i({}, t2, { syntheticException: 0 == r2 ? t2.syntheticException : void 0, mechanism: e2, apply: (e3) => s2(e3, r2), next: (e3) => s2(e3, r2 + 1) });
    }
  };
  var Qi = "?";
  function Ki(e2, t2, i2, r2, s2) {
    var n2 = { platform: e2, filename: t2, function: "<anonymous>" === i2 ? Qi : i2, in_app: true };
    return rt(r2) || (n2.lineno = r2), rt(s2) || (n2.colno = s2), n2;
  }
  var Yi = (e2, t2) => {
    var i2 = -1 !== e2.indexOf("safari-extension"), r2 = -1 !== e2.indexOf("safari-web-extension");
    return i2 || r2 ? [-1 !== e2.indexOf("@") ? e2.split("@")[0] : Qi, i2 ? "safari-extension:" + t2 : "safari-web-extension:" + t2] : [e2, t2];
  };
  var Ji = /^\s*at (\S+?)(?::(\d+))(?::(\d+))\s*$/i;
  var Zi = /^\s*at (?:(.+?\)(?: \[.+\])?|.*?) ?\((?:address at )?)?(?:async )?((?:<anonymous>|[-a-z]+:|.*bundle|\/)?.*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
  var Xi = /\((\S*)(?::(\d+))(?::(\d+))\)/;
  var er = (e2, t2) => {
    var i2 = Ji.exec(e2);
    if (i2) return Ki(t2, i2[1], Qi, +i2[2], +i2[3]);
    var r2 = Zi.exec(e2);
    if (r2) {
      if (r2[2] && 0 === r2[2].indexOf("eval")) {
        var s2 = Xi.exec(r2[2]);
        s2 && (r2[2] = s2[1], r2[3] = s2[2], r2[4] = s2[3]);
      }
      var n2 = Yi(r2[1] || Qi, r2[2]);
      return Ki(t2, n2[1], n2[0], r2[3] ? +r2[3] : void 0, r2[4] ? +r2[4] : void 0);
    }
  };
  var tr = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)?((?:[-a-z]+)?:\/.*?|\[native code\]|[^@]*(?:bundle|\d+\.js)|\/[\w\-. /=]+)(?::(\d+))?(?::(\d+))?\s*$/i;
  var ir = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
  var rr = (e2, t2) => {
    var i2 = tr.exec(e2);
    if (i2) {
      if (i2[3] && i2[3].indexOf(" > eval") > -1) {
        var r2 = ir.exec(i2[3]);
        r2 && (i2[1] = i2[1] || "eval", i2[3] = r2[1], i2[4] = r2[2], i2[5] = "");
      }
      var s2 = i2[3], n2 = i2[1] || Qi, o2 = Yi(n2, s2);
      return Ki(t2, s2 = o2[1], n2 = o2[0], i2[4] ? +i2[4] : void 0, i2[5] ? +i2[5] : void 0);
    }
  };
  var sr = /\(error: (.*)\)/;
  var nr = class {
    match(e2) {
      return this.isDOMException(e2) || this.isDOMError(e2);
    }
    coerce(e2, t2) {
      var i2 = st(e2.stack);
      return { type: this.getType(e2), value: this.getValue(e2), stack: i2 ? e2.stack : void 0, cause: e2.cause ? t2.next(e2.cause) : void 0, synthetic: false };
    }
    getType(e2) {
      return this.isDOMError(e2) ? "DOMError" : "DOMException";
    }
    getValue(e2) {
      var t2 = e2.name || (this.isDOMError(e2) ? "DOMError" : "DOMException");
      return e2.message ? t2 + ": " + e2.message : t2;
    }
    isDOMException(e2) {
      return gt(e2, "DOMException");
    }
    isDOMError(e2) {
      return gt(e2, "DOMError");
    }
  };
  var or = class {
    match(e2) {
      return ((e3) => e3 instanceof Error)(e2);
    }
    coerce(e2, t2) {
      return { type: this.getType(e2), value: this.getMessage(e2, t2), stack: this.getStack(e2), cause: e2.cause ? t2.next(e2.cause) : void 0, synthetic: false };
    }
    getType(e2) {
      return e2.name || e2.constructor.name;
    }
    getMessage(e2, t2) {
      var i2 = e2.message;
      return String(i2.error && "string" == typeof i2.error.message ? i2.error.message : i2);
    }
    getStack(e2) {
      return e2.stacktrace || e2.stack || void 0;
    }
  };
  var ar = class {
    constructor() {
    }
    match(e2) {
      return gt(e2, "ErrorEvent") && null != e2.error;
    }
    coerce(e2, t2) {
      var i2;
      return t2.apply(e2.error) || { type: "ErrorEvent", value: e2.message, stack: null == (i2 = t2.syntheticException) ? void 0 : i2.stack, synthetic: true };
    }
  };
  var lr = /^(?:[Uu]ncaught (?:exception: )?)?(?:((?:Eval|Internal|Range|Reference|Syntax|Type|URI|)Error): )?(.*)$/i;
  var ur = class {
    match(e2) {
      return "string" == typeof e2;
    }
    coerce(e2, t2) {
      var i2, r2 = this.getInfos(e2), s2 = r2[0], n2 = r2[1];
      return { type: null != s2 ? s2 : "Error", value: null != n2 ? n2 : e2, stack: null == (i2 = t2.syntheticException) ? void 0 : i2.stack, synthetic: true };
    }
    getInfos(e2) {
      var t2 = "Error", i2 = e2, r2 = e2.match(lr);
      return r2 && (t2 = r2[1], i2 = r2[2]), [t2, i2];
    }
  };
  var cr = ["fatal", "error", "warning", "log", "info", "debug"];
  function dr(e2, t2) {
    void 0 === t2 && (t2 = 40);
    var i2 = Object.keys(e2);
    if (i2.sort(), !i2.length) return "[object has no keys]";
    for (var r2 = i2.length; r2 > 0; r2--) {
      var s2 = i2.slice(0, r2).join(", ");
      if (t2 >= s2.length) return r2 === i2.length ? s2 : s2.length > t2 ? s2.slice(0, t2) + "..." : s2;
    }
    return "";
  }
  var _r = class {
    match(e2) {
      return "object" == typeof e2 && null !== e2;
    }
    coerce(e2, t2) {
      var i2, r2 = this.getErrorPropertyFromObject(e2);
      return r2 ? t2.apply(r2) : { type: this.getType(e2), value: this.getValue(e2), stack: null == (i2 = t2.syntheticException) ? void 0 : i2.stack, level: this.isSeverityLevel(e2.level) ? e2.level : "error", synthetic: true };
    }
    getType(e2) {
      return vt(e2) ? e2.constructor.name : "Error";
    }
    getValue(e2) {
      if ("name" in e2 && "string" == typeof e2.name) {
        var t2 = "'" + e2.name + "' captured as exception";
        return "message" in e2 && "string" == typeof e2.message && (t2 += " with message: '" + e2.message + "'"), t2;
      }
      if ("message" in e2 && "string" == typeof e2.message) return e2.message;
      var i2 = this.getObjectClassName(e2);
      return (i2 && "Object" !== i2 ? "'" + i2 + "'" : "Object") + " captured as exception with keys: " + dr(e2);
    }
    isSeverityLevel(e2) {
      return st(e2) && !nt(e2) && cr.indexOf(e2) >= 0;
    }
    getErrorPropertyFromObject(e2) {
      for (var t2 in e2) if ({}.hasOwnProperty.call(e2, t2)) {
        var i2 = e2[t2];
        if (Fi(i2)) return i2;
      }
    }
    getObjectClassName(e2) {
      try {
        var t2 = Object.getPrototypeOf(e2);
        return t2 ? t2.constructor.name : void 0;
      } catch (e3) {
        return;
      }
    }
  };
  var hr = class {
    match(e2) {
      return vt(e2);
    }
    coerce(e2, t2) {
      var i2, r2 = e2.constructor.name;
      return { type: r2, value: r2 + " captured as exception with keys: " + dr(e2), stack: null == (i2 = t2.syntheticException) ? void 0 : i2.stack, synthetic: true };
    }
  };
  var pr = class {
    match(e2) {
      return pt(e2);
    }
    coerce(e2, t2) {
      var i2;
      return { type: "Error", value: "Primitive value captured as exception: " + String(e2), stack: null == (i2 = t2.syntheticException) ? void 0 : i2.stack, synthetic: true };
    }
  };
  var gr = class {
    match(e2) {
      return gt(e2, "PromiseRejectionEvent") || this.isCustomEventWrappingRejection(e2);
    }
    isCustomEventWrappingRejection(e2) {
      if (!vt(e2)) return false;
      try {
        var t2 = e2.detail;
        return null != t2 && "object" == typeof t2 && "reason" in t2;
      } catch (e3) {
        return false;
      }
    }
    coerce(e2, t2) {
      var i2, r2 = this.getUnhandledRejectionReason(e2);
      return pt(r2) ? { type: "UnhandledRejection", value: "Non-Error promise rejection captured with value: " + String(r2), stack: null == (i2 = t2.syntheticException) ? void 0 : i2.stack, synthetic: true } : t2.apply(r2);
    }
    getUnhandledRejectionReason(e2) {
      try {
        if ("reason" in e2) return e2.reason;
        if ("detail" in e2 && null != e2.detail && "object" == typeof e2.detail && "reason" in e2.detail) return e2.detail.reason;
      } catch (e3) {
      }
      return e2;
    }
  };
  var vr = "$message";
  var fr = "$timestamp";
  var mr = /* @__PURE__ */ new Set([vr, fr]);
  var yr = { enabled: true, max_bytes: 32768 };
  function br(e2) {
    var t2;
    return e2 ? { enabled: null !== (t2 = e2.enabled) && void 0 !== t2 ? t2 : yr.enabled, max_bytes: Sr(e2.max_bytes, yr.max_bytes) } : i({}, yr);
  }
  var wr = class {
    constructor(e2) {
      this._entries = [], this._totalBytes = 0, this._config = br(e2);
    }
    setConfig(e2) {
      this._config = br(e2), this._trimToMaxBytes();
    }
    add(e2) {
      var t2 = (function(e3) {
        var t3;
        try {
          t3 = Ke(e3);
        } catch (e4) {
          return;
        }
        try {
          var i3 = JSON.parse(t3);
          if (!tt(i3)) return;
          var r2 = i3, s2 = r2[vr], n2 = r2[fr];
          if (!st(s2) || 0 === s2.trim().length) return;
          if (!st(n2) && !lt(n2)) return;
          return { step: r2, json: t3 };
        } catch (e4) {
          return;
        }
      })(e2);
      if (t2) {
        var i2 = (function(e3) {
          if ("undefined" != typeof TextEncoder) return new TextEncoder().encode(e3).length;
          for (var t3 = encodeURIComponent(e3), i3 = 0, r2 = 0; t3.length > r2; r2++) "%" === t3[r2] ? (i3 += 1, r2 += 2) : i3 += 1;
          return i3;
        })(t2.json);
        i2 > this._config.max_bytes || (this._entries.push({ step: t2.step, bytes: i2 }), this._totalBytes += i2, this._trimToMaxBytes());
      }
    }
    getAttachable() {
      return this._entries.map(((e2) => e2.step));
    }
    clear() {
      this._entries = [], this._totalBytes = 0;
    }
    size() {
      return this._entries.length;
    }
    _trimToMaxBytes() {
      for (; this._totalBytes > this._config.max_bytes && this._entries.length > 0; ) {
        var e2 = this._entries.shift();
        e2 && (this._totalBytes -= e2.bytes);
      }
    }
  };
  function Sr(e2, t2) {
    if (!lt(e2) || e2 === 1 / 0 || e2 === -1 / 0) return t2;
    var i2 = Math.floor(e2);
    return 0 > i2 ? t2 : i2;
  }
  var Er = function(e2, t2) {
    var i2 = (void 0 === t2 ? {} : t2).debugEnabled, r2 = { _log(t3) {
      if (fe && (n.DEBUG || Ie.POSTHOG_DEBUG || i2) && !rt(fe.console) && fe.console) {
        for (var r3 = ("__rrweb_original__" in fe.console[t3]) ? fe.console[t3].__rrweb_original__ : fe.console[t3], s2 = arguments.length, o2 = new Array(s2 > 1 ? s2 - 1 : 0), a2 = 1; s2 > a2; a2++) o2[a2 - 1] = arguments[a2];
        r3(e2, ...o2);
      }
    }, debug() {
      for (var e3 = arguments.length, t3 = new Array(e3), i3 = 0; e3 > i3; i3++) t3[i3] = arguments[i3];
      r2._log("debug", ...t3);
    }, info() {
      for (var e3 = arguments.length, t3 = new Array(e3), i3 = 0; e3 > i3; i3++) t3[i3] = arguments[i3];
      r2._log("log", ...t3);
    }, warn() {
      for (var e3 = arguments.length, t3 = new Array(e3), i3 = 0; e3 > i3; i3++) t3[i3] = arguments[i3];
      r2._log("warn", ...t3);
    }, error() {
      for (var e3 = arguments.length, t3 = new Array(e3), i3 = 0; e3 > i3; i3++) t3[i3] = arguments[i3];
      r2._log("error", ...t3);
    }, critical() {
      for (var t3 = arguments.length, i3 = new Array(t3), r3 = 0; t3 > r3; r3++) i3[r3] = arguments[r3];
      console.error(e2, ...i3);
    }, uninitializedWarning(e3) {
      r2.error("You must initialize PostHog before calling " + e3);
    }, createLogger: (t3, i3) => Er(e2 + " " + t3, i3) };
    return r2;
  };
  var xr = Er("[PostHog.js]");
  var kr = xr.createLogger;
  function Pr(e2, t2) {
    Xe(e2) && e2.forEach(t2);
  }
  function Ir(e2, t2) {
    if (!at(e2)) if (Xe(e2)) e2.forEach(t2);
    else if (dt(e2)) e2.forEach(((e3, i3) => t2(e3, i3)));
    else for (var i2 in e2) Je.call(e2, i2) && t2(e2[i2], i2);
  }
  var Cr = function(e2) {
    for (var t2 = arguments.length, i2 = new Array(t2 > 1 ? t2 - 1 : 0), r2 = 1; t2 > r2; r2++) i2[r2 - 1] = arguments[r2];
    for (var s2 of i2) for (var n2 in s2) void 0 !== s2[n2] && (e2[n2] = s2[n2]);
    return e2;
  };
  function Tr(e2) {
    for (var t2 = Object.keys(e2), i2 = t2.length, r2 = new Array(i2); i2--; ) r2[i2] = [t2[i2], e2[t2[i2]]];
    return r2;
  }
  var Fr = function(e2) {
    try {
      return e2();
    } catch (e3) {
      return;
    }
  };
  var Rr = function(e2) {
    return function() {
      try {
        for (var t2 = arguments.length, i2 = new Array(t2), r2 = 0; t2 > r2; r2++) i2[r2] = arguments[r2];
        return e2.apply(this, i2);
      } catch (e3) {
        xr.critical("Implementation error. Please turn on debug mode and open a ticket on https://app.posthog.com/home#panel=support%3Asupport%3A."), xr.critical(e3);
      }
    };
  };
  var Lr = function(e2) {
    var t2 = {};
    return Ir(e2, (function(e3, i2) {
      (st(e3) && e3.length > 0 || lt(e3)) && (t2[i2] = e3);
    })), t2;
  };
  var Mr = ["herokuapp.com", "vercel.app", "netlify.app"];
  function Ar(e2) {
    var t2 = null == e2 ? void 0 : e2.hostname;
    if (!st(t2)) return false;
    var i2 = t2.split(".").slice(-2).join(".");
    for (var r2 of Mr) if (i2 === r2) return false;
    return true;
  }
  function Or(e2, t2, i2, r2) {
    var s2 = null != r2 ? r2 : {}, n2 = s2.capture, o2 = s2.passive;
    null == e2 || e2.addEventListener(t2, i2, { capture: void 0 !== n2 && n2, passive: void 0 === o2 || o2 });
  }
  function $r(e2) {
    return "ph_toolbar_internal" === e2.name;
  }
  Math.trunc || (Math.trunc = function(e2) {
    return 0 > e2 ? Math.ceil(e2) : Math.floor(e2);
  }), Number.isInteger || (Number.isInteger = function(e2) {
    return lt(e2) && isFinite(e2) && Math.floor(e2) === e2;
  });
  var Dr = class _Dr {
    constructor(e2) {
      if (this.bytes = e2, 16 !== e2.length) throw new TypeError("not 128-bit length");
    }
    static fromFieldsV7(e2, t2, i2, r2) {
      if (!Number.isInteger(e2) || !Number.isInteger(t2) || !Number.isInteger(i2) || !Number.isInteger(r2) || 0 > e2 || 0 > t2 || 0 > i2 || 0 > r2 || e2 > 281474976710655 || t2 > 4095 || i2 > 1073741823 || r2 > 4294967295) throw new RangeError("invalid field value");
      var s2 = new Uint8Array(16);
      return s2[0] = e2 / Math.pow(2, 40), s2[1] = e2 / Math.pow(2, 32), s2[2] = e2 / Math.pow(2, 24), s2[3] = e2 / Math.pow(2, 16), s2[4] = e2 / Math.pow(2, 8), s2[5] = e2, s2[6] = 112 | t2 >>> 8, s2[7] = t2, s2[8] = 128 | i2 >>> 24, s2[9] = i2 >>> 16, s2[10] = i2 >>> 8, s2[11] = i2, s2[12] = r2 >>> 24, s2[13] = r2 >>> 16, s2[14] = r2 >>> 8, s2[15] = r2, new _Dr(s2);
    }
    toString() {
      for (var e2 = "", t2 = 0; this.bytes.length > t2; t2++) e2 = e2 + (this.bytes[t2] >>> 4).toString(16) + (15 & this.bytes[t2]).toString(16), 3 !== t2 && 5 !== t2 && 7 !== t2 && 9 !== t2 || (e2 += "-");
      if (36 !== e2.length) throw new Error("Invalid UUIDv7 was generated");
      return e2;
    }
    clone() {
      return new _Dr(this.bytes.slice(0));
    }
    equals(e2) {
      return 0 === this.compareTo(e2);
    }
    compareTo(e2) {
      for (var t2 = 0; 16 > t2; t2++) {
        var i2 = this.bytes[t2] - e2.bytes[t2];
        if (0 !== i2) return Math.sign(i2);
      }
      return 0;
    }
  };
  var Nr = class {
    constructor() {
      this._timestamp = 0, this._counter = 0, this._random = new qr();
    }
    generate() {
      var e2 = this.generateOrAbort();
      if (rt(e2)) {
        this._timestamp = 0;
        var t2 = this.generateOrAbort();
        if (rt(t2)) throw new Error("Could not generate UUID after timestamp reset");
        return t2;
      }
      return e2;
    }
    generateOrAbort() {
      var e2 = Date.now();
      if (e2 > this._timestamp) this._timestamp = e2, this._resetCounter();
      else {
        if (this._timestamp >= e2 + 1e4) return;
        this._counter++, this._counter > 4398046511103 && (this._timestamp++, this._resetCounter());
      }
      return Dr.fromFieldsV7(this._timestamp, Math.trunc(this._counter / Math.pow(2, 30)), this._counter & Math.pow(2, 30) - 1, this._random.nextUint32());
    }
    _resetCounter() {
      this._counter = 1024 * this._random.nextUint32() + (1023 & this._random.nextUint32());
    }
  };
  var Br;
  var Ur = (e2) => {
    if ("undefined" != typeof UUIDV7_DENY_WEAK_RNG && UUIDV7_DENY_WEAK_RNG) throw new Error("no cryptographically strong RNG available");
    for (var t2 = 0; e2.length > t2; t2++) e2[t2] = 65536 * Math.trunc(65536 * Math.random()) + Math.trunc(65536 * Math.random());
    return e2;
  };
  fe && !rt(fe.crypto) && crypto.getRandomValues && (Ur = (e2) => crypto.getRandomValues(e2));
  var qr = class {
    constructor() {
      this._buffer = new Uint32Array(8), this._cursor = 1 / 0;
    }
    nextUint32() {
      return this._buffer.length > this._cursor || (Ur(this._buffer), this._cursor = 0), this._buffer[this._cursor++];
    }
  };
  var Hr = () => zr().toString();
  var zr = () => (Br || (Br = new Nr())).generate();
  var jr = "";
  var Vr = /[a-z0-9][a-z0-9-]+\.[a-z]{2,}$/i;
  var Wr = { _is_supported: () => !!be, _error(e2) {
    xr.error("cookieStore error: " + e2);
  }, _get(e2) {
    if (be) {
      try {
        for (var t2 = e2 + "=", i2 = be.cookie.split(";").filter(((e3) => e3.length)), r2 = 0; i2.length > r2; r2++) {
          for (var s2 = i2[r2]; " " == s2.charAt(0); ) s2 = s2.substring(1, s2.length);
          if (0 === s2.indexOf(t2)) return decodeURIComponent(s2.substring(t2.length, s2.length));
        }
      } catch (e3) {
      }
      return null;
    }
  }, _parse(e2) {
    var t2;
    try {
      t2 = JSON.parse(Wr._get(e2)) || {};
    } catch (e3) {
    }
    return t2;
  }, _set(e2, t2, i2, r2, s2) {
    if (!be) return false;
    try {
      var n2 = "", o2 = "", a2 = (function(e3, t3) {
        if (t3) {
          var i3 = (function(e4, t4) {
            if (void 0 === t4 && (t4 = be), jr) return jr;
            if (!t4) return "";
            if (["localhost", "127.0.0.1"].includes(e4)) return "";
            for (var i4 = e4.split("."), r4 = Math.min(i4.length, 8), s3 = "dmn_chk_" + Hr(); !jr && r4--; ) {
              var n3 = i4.slice(r4).join("."), o3 = s3 + "=1;domain=." + n3 + ";path=/";
              t4.cookie = o3 + ";max-age=3", t4.cookie.includes(s3) && (t4.cookie = o3 + ";max-age=0", jr = n3);
            }
            return jr;
          })(e3);
          if (!i3) {
            var r3 = ((e4) => {
              var t4 = e4.match(Vr);
              return t4 ? t4[0] : "";
            })(e3);
            r3 !== i3 && xr.info("Warning: cookie subdomain discovery mismatch", r3, i3), i3 = r3;
          }
          return i3 ? "; domain=." + i3 : "";
        }
        return "";
      })(be.location.hostname, r2);
      if (i2) {
        var l2 = /* @__PURE__ */ new Date();
        l2.setTime(l2.getTime() + 864e5 * i2), n2 = "; expires=" + l2.toUTCString();
      }
      s2 && (o2 = "; secure");
      var u2 = e2 + "=" + encodeURIComponent(JSON.stringify(t2)) + n2 + "; SameSite=Lax; path=/" + a2 + o2;
      return u2.length > 3686.4 && xr.warn("cookieStore warning: large cookie, len=" + u2.length), be.cookie = u2, true;
    } catch (e3) {
      return false;
    }
  }, _remove(e2, t2) {
    if (null != be && be.cookie) try {
      Wr._set(e2, "", -1, t2);
    } catch (e3) {
      return;
    }
  } };
  var Gr = null;
  var Qr = { _is_supported() {
    if (!ot(Gr)) return Gr;
    var e2 = true;
    if (rt(fe)) e2 = false;
    else try {
      var t2 = "__mplssupport__";
      Qr._set(t2, "xyz"), '"xyz"' !== Qr._get(t2) && (e2 = false), Qr._remove(t2);
    } catch (t3) {
      e2 = false;
    }
    return e2 || xr.error("localStorage unsupported; falling back to cookie store"), Gr = e2, e2;
  }, _error(e2) {
    xr.error("localStorage error: " + e2);
  }, _get(e2) {
    try {
      return null == fe ? void 0 : fe.localStorage.getItem(e2);
    } catch (e3) {
      Qr._error(e3);
    }
    return null;
  }, _parse(e2) {
    try {
      return JSON.parse(Qr._get(e2)) || {};
    } catch (e3) {
    }
    return null;
  }, _set(e2, t2) {
    try {
      return null == fe || fe.localStorage.setItem(e2, JSON.stringify(t2)), true;
    } catch (e3) {
      Qr._error(e3);
    }
    return false;
  }, _remove(e2) {
    try {
      null == fe || fe.localStorage.removeItem(e2);
    } catch (e3) {
      Qr._error(e3);
    }
  } };
  var Kr = [a, "distinct_id", P, I, X, Z, G];
  var Yr = {};
  var Jr = { _is_supported: () => true, _error(e2) {
    xr.error("memoryStorage error: " + e2);
  }, _get: (e2) => Yr[e2] || null, _parse: (e2) => Yr[e2] || null, _set: (e2, t2) => (Yr[e2] = t2, true), _remove(e2) {
    delete Yr[e2];
  } };
  var Zr = null;
  var Xr = { _is_supported() {
    if (!ot(Zr)) return Zr;
    if (Zr = true, rt(fe)) Zr = false;
    else try {
      var e2 = "__support__";
      Xr._set(e2, "xyz"), '"xyz"' !== Xr._get(e2) && (Zr = false), Xr._remove(e2);
    } catch (e3) {
      Zr = false;
    }
    return Zr;
  }, _error(e2) {
    xr.error("sessionStorage error: ", e2);
  }, _get(e2) {
    try {
      return null == fe ? void 0 : fe.sessionStorage.getItem(e2);
    } catch (e3) {
      Xr._error(e3);
    }
    return null;
  }, _parse(e2) {
    try {
      return JSON.parse(Xr._get(e2)) || null;
    } catch (e3) {
    }
    return null;
  }, _set(e2, t2) {
    try {
      return null == fe || fe.sessionStorage.setItem(e2, JSON.stringify(t2)), true;
    } catch (e3) {
      Xr._error(e3);
    }
    return false;
  }, _remove(e2) {
    try {
      null == fe || fe.sessionStorage.removeItem(e2);
    } catch (e3) {
      Xr._error(e3);
    }
  } };
  var es = class {
    constructor(e2) {
      this._instance = e2;
    }
    get _config() {
      return this._instance.config;
    }
    get consent() {
      return this._getDnt() ? 0 : this._storedConsent;
    }
    isOptedOut() {
      return this._config.cookieless_mode === ae || this.isRejected() || -1 === this.consent && this._config.cookieless_mode === oe;
    }
    isOptedIn() {
      return !this.isOptedOut();
    }
    isExplicitlyOptedOut() {
      return 0 === this.consent;
    }
    isRejected() {
      return 0 === this.consent || -1 === this.consent && this._config.opt_out_capturing_by_default;
    }
    optInOut(e2) {
      this._storage._set(this._storageKey, e2 ? 1 : 0, this._config.cookie_expiration, this._config.cross_subdomain_cookie, this._config.secure_cookie);
    }
    reset() {
      this._storage._remove(this._storageKey, this._config.cross_subdomain_cookie);
    }
    get _storageKey() {
      var e2 = this._instance.config, t2 = e2.token, i2 = e2.opt_out_capturing_cookie_prefix;
      return e2.consent_persistence_name || (i2 ? i2 + t2 : "__ph_opt_in_out_" + t2);
    }
    get _storedConsent() {
      var e2 = this._storage._get(this._storageKey);
      return mt(e2) ? 1 : We(yt, e2) ? 0 : -1;
    }
    get _storage() {
      var e2 = this._config.opt_out_capturing_persistence_type, t2 = "localStorage" === e2 ? Qr : Wr;
      if (!this._persistentStore || this._persistentStore !== t2) {
        this._persistentStore = t2;
        var i2 = "localStorage" === e2 ? Wr : Qr;
        i2._get(this._storageKey) && (this._persistentStore._get(this._storageKey) || this.optInOut(mt(i2._get(this._storageKey))), i2._remove(this._storageKey, this._config.cross_subdomain_cookie));
      }
      return this._persistentStore;
    }
    _getDnt() {
      return !!this._config.respect_dnt && [null == ye ? void 0 : ye.doNotTrack, null == ye ? void 0 : ye.msDoNotTrack, Ie.doNotTrack].some(((e2) => mt(e2)));
    }
  };
  function ts(e2, t2) {
    var i2, r2 = null == e2 || null == (i2 = e2.config) ? void 0 : i2.get_current_url;
    if (!et(r2)) return t2;
    try {
      var s2 = r2(t2);
      return st(s2) && s2 ? s2 : t2;
    } catch (e3) {
      return xr.error("Error in get_current_url, falling back to window.location.href", e3), t2;
    }
  }
  var is = 1;
  var rs = 3;
  var ss = 11;
  function ns(e2) {
    return e2 instanceof Element && (e2.id === ee || !(null == e2.closest || !e2.closest(".toolbar-global-fade-container")));
  }
  function os(e2) {
    return !!e2 && e2.nodeType === is;
  }
  function as(e2, t2) {
    return !!e2 && !!e2.tagName && e2.tagName.toLowerCase() === t2.toLowerCase();
  }
  function ls(e2) {
    return !!e2 && e2.nodeType === rs;
  }
  function us(e2) {
    return !!e2 && e2.nodeType === ss && os(e2.host);
  }
  var cs = 1e3;
  function ds(e2) {
    return e2 ? Ge(e2).split(/\s+/) : [];
  }
  function _s(e2, t2) {
    var i2 = (function(e3) {
      var t3, i3 = null == fe || null == (t3 = fe.location) ? void 0 : t3.href;
      return rt(i3) ? void 0 : ts(e3, i3);
    })(t2);
    return !!(i2 && e2 && e2.some(((e3) => i2.match(e3))));
  }
  function hs(e2) {
    var t2 = "";
    switch (typeof e2.className) {
      case "string":
        t2 = e2.className;
        break;
      case "object":
        t2 = (e2.className && "baseVal" in e2.className ? e2.className.baseVal : null) || e2.getAttribute("class") || "";
        break;
      default:
        t2 = "";
    }
    return ds(t2);
  }
  function ps(e2) {
    return at(e2) ? null : Ge(e2).split(/(\s+)/).filter(((e3) => Ds(e3))).join("").replace(/[\r\n]/g, " ").replace(/[ ]+/g, " ").substring(0, 255);
  }
  function gs(e2) {
    var t2 = "";
    return Ts(e2) && !Fs(e2) && e2.childNodes && e2.childNodes.length && Ir(e2.childNodes, (function(e3) {
      var i2;
      ls(e3) && e3.textContent && (t2 += null !== (i2 = ps(e3.textContent)) && void 0 !== i2 ? i2 : "");
    })), Ge(t2);
  }
  function vs(e2) {
    return rt(e2.target) ? e2.srcElement || null : null != (t2 = e2.target) && t2.shadowRoot ? e2.composedPath()[0] || null : e2.target || null;
    var t2;
  }
  var fs = ["a", "button", "form", "input", "select", "textarea", "label"];
  function ms(e2, t2) {
    if (rt(t2)) return true;
    var i2, r2 = function(e3) {
      if (t2.some(((t3) => (function(e4, t4) {
        var i3 = e4.matches || e4.matchesSelector || e4.msMatchesSelector || e4.mozMatchesSelector || e4.webkitMatchesSelector || e4.oMatchesSelector;
        try {
          return !!i3 && i3.call(e4, t4);
        } catch (e5) {
          return false;
        }
      })(e3, t3)))) return { v: true };
    };
    for (var s2 of e2) if (i2 = r2(s2)) return i2.v;
    return false;
  }
  function ys(e2) {
    var t2 = e2.parentNode;
    return !(!t2 || !os(t2)) && t2;
  }
  var bs = [".ph-no-autocapture", "[data-ph-no-autocapture]"];
  var ws = ["next", "previous", "prev", ">", "<"];
  var Ss = [...ws, "+", "-", "\u2212", "\u2013"];
  var Es = (e2, t2) => /[a-z0-9]/i.test(t2) ? e2.includes(t2) : e2 === t2;
  var xs = [".ph-no-rageclick", ".ph-no-capture"];
  var ks = ["", "text", "search", "email", "password", "url", "tel", "number"];
  function Ps(e2, t2) {
    if (!fe || Is(e2)) return false;
    var i2, r2, s2, n2, o2;
    if (ct(t2) ? (i2 = !!t2 && xs, r2 = void 0, s2 = false) : (i2 = null !== (n2 = null == t2 ? void 0 : t2.css_selector_ignorelist) && void 0 !== n2 ? n2 : xs, r2 = null == t2 ? void 0 : t2.content_ignorelist, s2 = null !== (o2 = null == t2 ? void 0 : t2.ignore_text_selection) && void 0 !== o2 && o2), false === i2) return false;
    if (s2 && (function(e3) {
      return !(!e3 || !os(e3)) && (!!as(e3, "textarea") || (as(e3, "input") ? We(ks, (e3.getAttribute("type") || "").toLowerCase()) : (function(e4) {
        if (e4.isContentEditable) return true;
        var t3 = null == e4.getAttribute ? void 0 : e4.getAttribute("contenteditable");
        return "true" === t3 || "" === t3;
      })(e3)));
    })(e2)) return false;
    var a2 = Cs(e2, false).targetElementList;
    return !(function(e3, t3) {
      if (false === e3 || rt(e3)) return false;
      var i3;
      if (true === e3) i3 = ws;
      else {
        if (!Xe(e3)) return false;
        if (e3.length > 10) return xr.error("[PostHog] content_ignorelist array cannot exceed 10 items. Use css_selector_ignorelist for more complex matching."), false;
        i3 = e3.map(((e4) => e4.toLowerCase()));
      }
      return t3.some(((e4) => {
        var t4 = e4.safeText, r3 = e4.ariaLabel;
        return i3.some(((e5) => Es(t4, e5) || Es(r3, e5)));
      }));
    })(r2, a2.map(((e3) => {
      var t3;
      return { safeText: gs(e3).toLowerCase(), ariaLabel: (null == (t3 = e3.getAttribute("aria-label")) ? void 0 : t3.toLowerCase().trim()) || "" };
    }))) && !ms(a2, i2);
  }
  var Is = (e2) => !e2 || as(e2, "html") || !os(e2);
  var Cs = (e2, t2) => {
    if (!fe || Is(e2)) return { parentIsUsefulElement: false, targetElementList: [] };
    for (var i2 = false, r2 = [e2], s2 = e2; s2.parentNode && !as(s2, "body"); ) if (us(s2.parentNode)) r2.push(s2.parentNode.host), s2 = s2.parentNode.host;
    else {
      var n2 = ys(s2);
      if (!n2) break;
      if (t2 || fs.indexOf(n2.tagName.toLowerCase()) > -1) i2 = true;
      else try {
        var o2 = fe.getComputedStyle(n2);
        o2 && "pointer" === o2.getPropertyValue("cursor") && (i2 = true);
      } catch (e3) {
      }
      r2.push(n2), s2 = n2;
    }
    return { parentIsUsefulElement: i2, targetElementList: r2 };
  };
  function Ts(e2) {
    for (var t2 = /* @__PURE__ */ new Set(), i2 = 0, r2 = e2; r2.parentNode && !as(r2, "body"); r2 = r2.parentNode) {
      if (i2++ >= cs || t2.has(r2)) return false;
      t2.add(r2);
      var s2 = hs(r2);
      if (We(s2, "ph-sensitive") || We(s2, "ph-no-capture")) return false;
    }
    if (We(hs(e2), "ph-include")) return true;
    var n2 = e2.type || "";
    if (st(n2)) switch (n2.toLowerCase()) {
      case "hidden":
      case "password":
        return false;
    }
    var o2 = e2.name || e2.id || "";
    return !st(o2) || !/^cc|cardnum|ccnum|creditcard|csc|cvc|cvv|exp|pass|pwd|routing|seccode|securitycode|securitynum|socialsec|socsec|ssn/i.test(o2.replace(/[^a-zA-Z0-9]/g, ""));
  }
  function Fs(e2) {
    return !!(as(e2, "input") && !["button", "checkbox", "submit", "reset"].includes(e2.type) || as(e2, "select") || as(e2, "textarea") || "true" === e2.getAttribute("contenteditable"));
  }
  var Rs = "(4[0-9]{12}(?:[0-9]{3})?)|(5[1-5][0-9]{14})|(6(?:011|5[0-9]{2})[0-9]{12})|(3[47][0-9]{13})|(3(?:0[0-5]|[68][0-9])[0-9]{11})|((?:2131|1800|35[0-9]{3})[0-9]{11})";
  var Ls = new RegExp("^(?:" + Rs + ")$");
  var Ms = new RegExp(Rs);
  var As = "\\d{3}-?\\d{2}-?\\d{4}";
  var Os = new RegExp("^(" + As + ")$");
  var $s = new RegExp("(" + As + ")");
  function Ds(e2, t2) {
    if (void 0 === t2 && (t2 = true), at(e2)) return false;
    if (st(e2)) {
      if (e2 = Ge(e2), (t2 ? Ls : Ms).test((e2 || "").replace(/[- ]/g, ""))) return false;
      if ((t2 ? Os : $s).test(e2)) return false;
    }
    return true;
  }
  function Ns(e2) {
    var t2 = gs(e2);
    return Ds(t2 = (t2 + " " + Bs(e2)).trim()) ? t2 : "";
  }
  function Bs(e2) {
    var t2 = "";
    return e2 && e2.childNodes && e2.childNodes.length && Ir(e2.childNodes, (function(e3) {
      var i2;
      if (e3 && "span" === (null == (i2 = e3.tagName) ? void 0 : i2.toLowerCase())) try {
        var r2 = gs(e3);
        t2 = (t2 + " " + r2).trim(), e3.childNodes && e3.childNodes.length && (t2 = (t2 + " " + Bs(e3)).trim());
      } catch (e4) {
        xr.error("[AutoCapture]", e4);
      }
    })), t2;
  }
  function Us(e2) {
    return e2.replace(/"|\\"/g, '\\"');
  }
  function qs(e2) {
    var t2 = e2.attr__class;
    return t2 ? Xe(t2) ? t2 : ds(t2) : void 0;
  }
  var Hs = kr("[Dead Clicks]");
  var zs = () => true;
  var js = (e2) => {
    var t2, i2 = !(null == (t2 = e2.instance.persistence) || !t2.get_property(f)), r2 = e2.instance.config.capture_dead_clicks;
    return ct(r2) ? r2 : !!tt(r2) || i2;
  };
  var Vs = class {
    get lazyLoadedDeadClicksAutocapture() {
      return this._lazyLoadedDeadClicksAutocapture;
    }
    constructor(e2, t2, i2) {
      this.instance = e2, this.isEnabled = t2, this.onCapture = i2, this.startIfEnabledOrStop();
    }
    onRemoteConfig(e2) {
      "captureDeadClicks" in e2 && (this.instance.persistence && this.instance.persistence.register({ [f]: e2.captureDeadClicks }), this.startIfEnabledOrStop());
    }
    startIfEnabledOrStop() {
      this.isEnabled(this) ? this._loadScript((() => {
        this._start();
      })) : this.stop();
    }
    _loadScript(e2) {
      var t2, i2;
      null != (t2 = Ie.__PosthogExtensions__) && t2.initDeadClicksAutocapture ? e2() : null == (i2 = Ie.__PosthogExtensions__) || null == i2.loadExternalDependency || i2.loadExternalDependency(this.instance, "dead-clicks-autocapture", ((t3) => {
        t3 ? Hs.error("failed to load script", t3) : e2();
      }));
    }
    _start() {
      var e2;
      if (be) {
        if (!this._lazyLoadedDeadClicksAutocapture && null != (e2 = Ie.__PosthogExtensions__) && e2.initDeadClicksAutocapture) {
          var t2 = tt(this.instance.config.capture_dead_clicks) ? i({}, this.instance.config.capture_dead_clicks) : {};
          t2.__onCapture = this.onCapture, this.onCapture && (t2.capture_dead_swipes = false), this._lazyLoadedDeadClicksAutocapture = Ie.__PosthogExtensions__.initDeadClicksAutocapture(this.instance, t2), this._lazyLoadedDeadClicksAutocapture.start(be), Hs.info("starting...");
        }
      } else Hs.error("`document` not found. Cannot start.");
    }
    stop() {
      this._lazyLoadedDeadClicksAutocapture && (this._lazyLoadedDeadClicksAutocapture.stop(), this._lazyLoadedDeadClicksAutocapture = void 0, Hs.info("stopping..."));
    }
  };
  var Ws = kr("[SegmentIntegration]");
  var Gs = "posthog-js";
  function Qs(e2, t2) {
    var r2 = void 0 === t2 ? {} : t2, s2 = r2.organization, n2 = r2.projectId, o2 = r2.prefix, a2 = r2.severityAllowList, l2 = void 0 === a2 ? ["error"] : a2, u2 = r2.sendExceptionsToPostHog, c2 = void 0 === u2 || u2;
    return (t3) => {
      var r3, a3, u3, d2, _2;
      if ("*" !== l2 && !l2.includes(t3.level) || !e2.__loaded) return t3;
      t3.tags || (t3.tags = {});
      var h2 = e2.requestRouter.endpointFor("ui", "/project/" + e2.config.token + "/person/" + e2.get_distinct_id());
      t3.tags["PostHog Person URL"] = h2, e2.sessionRecordingStarted() && (t3.tags["PostHog Recording URL"] = e2.get_session_replay_url({ withTimestamp: true }));
      var p2, g2 = (null == (r3 = t3.exception) ? void 0 : r3.values) || [], v2 = g2.map(((e3) => i({}, e3, { stacktrace: e3.stacktrace ? i({}, e3.stacktrace, { type: "raw", frames: (e3.stacktrace.frames || []).map(((e4) => i({}, e4, { platform: "web:javascript" }))) }) : void 0 }))), f2 = { $exception_message: (null == (a3 = g2[0]) ? void 0 : a3.value) || t3.message, $exception_type: null == (u3 = g2[0]) ? void 0 : u3.type, $exception_level: t3.level, $exception_list: v2, $sentry_event_id: t3.event_id, $sentry_exception: t3.exception, $sentry_exception_message: (null == (d2 = g2[0]) ? void 0 : d2.value) || t3.message, $sentry_exception_type: null == (_2 = g2[0]) ? void 0 : _2.type, $sentry_tags: t3.tags };
      return s2 && n2 && (f2.$sentry_url = (o2 || "https://sentry.io/organizations/") + s2 + "/issues/?project=" + n2 + "&query=" + t3.event_id), c2 && (null == (p2 = e2.exceptions) || p2.sendExceptionEvent(f2)), t3;
    };
  }
  var Ks = class {
    constructor(e2, t2, i2, r2, s2, n2) {
      this.name = Gs, this.setupOnce = function(o2) {
        o2(Qs(e2, { organization: t2, projectId: i2, prefix: r2, severityAllowList: s2, sendExceptionsToPostHog: null == n2 || n2 }));
      };
    }
  };
  var Ys = class {
    constructor(e2) {
      this._onSessionIdChange = (e3, t2, i2) => {
        i2 && (i2.noSessionId || i2.activityTimeout || i2.sessionPastMaximumLength || i2.crossTabAdoption) && (xr.info("[PageViewManager] Session rotated, clearing pageview state", { sessionId: e3, changeReason: i2 }), this._currentPageview = void 0, this._instance.scrollManager.resetContext());
      }, this._instance = e2, this._setupSessionRotationHandler();
    }
    _setupSessionRotationHandler() {
      var e2;
      this._unsubscribeSessionId = null == (e2 = this._instance.sessionManager) ? void 0 : e2.onSessionId(this._onSessionIdChange);
    }
    destroy() {
      var e2;
      null == (e2 = this._unsubscribeSessionId) || e2.call(this), this._unsubscribeSessionId = void 0;
    }
    doPageView(e2, t2) {
      var i2, r2 = this._previousPageViewProperties(e2, t2);
      return this._currentPageview = { pathname: null !== (i2 = null == fe ? void 0 : fe.location.pathname) && void 0 !== i2 ? i2 : "", pageViewId: t2, timestamp: e2 }, this._instance.scrollManager.resetContext(), r2;
    }
    doPageLeave(e2) {
      var t2;
      return this._previousPageViewProperties(e2, null == (t2 = this._currentPageview) ? void 0 : t2.pageViewId);
    }
    doEvent() {
      var e2;
      return { $pageview_id: null == (e2 = this._currentPageview) ? void 0 : e2.pageViewId };
    }
    _previousPageViewProperties(e2, t2) {
      var i2 = this._currentPageview;
      if (!i2) return { $pageview_id: t2 };
      var r2 = { $pageview_id: t2, $prev_pageview_id: i2.pageViewId }, s2 = this._instance.scrollManager.getContext();
      if (s2 && !this._instance.config.disable_scroll_properties) {
        var n2 = s2.maxScrollHeight, o2 = s2.lastScrollY, a2 = s2.maxScrollY, l2 = s2.maxContentHeight, u2 = s2.lastContentY, c2 = s2.maxContentY;
        if (!(rt(n2) || rt(o2) || rt(a2) || rt(l2) || rt(u2) || rt(c2))) {
          n2 = Math.ceil(n2), o2 = Math.ceil(o2), a2 = Math.ceil(a2), l2 = Math.ceil(l2), u2 = Math.ceil(u2), c2 = Math.ceil(c2);
          var d2 = n2 > 1 ? bt(o2 / n2, 0, 1, xr) : 1, _2 = n2 > 1 ? bt(a2 / n2, 0, 1, xr) : 1, h2 = l2 > 1 ? bt(u2 / l2, 0, 1, xr) : 1, p2 = l2 > 1 ? bt(c2 / l2, 0, 1, xr) : 1;
          r2 = Cr(r2, { $prev_pageview_last_scroll: o2, $prev_pageview_last_scroll_percentage: d2, $prev_pageview_max_scroll: a2, $prev_pageview_max_scroll_percentage: _2, $prev_pageview_last_content: u2, $prev_pageview_last_content_percentage: h2, $prev_pageview_max_content: c2, $prev_pageview_max_content_percentage: p2 });
        }
      }
      return i2.pathname && (r2.$prev_pageview_pathname = i2.pathname), i2.timestamp && (r2.$prev_pageview_duration = (e2.getTime() - i2.timestamp.getTime()) / 1e3), r2;
    }
  };
  var Js = ["flags", "surveys"];
  var Zs = { [o]: { exposure: "hidden" }, [u]: { exposure: "hidden" }, __cmpns: { exposure: "hidden" }, [c]: { exposure: "hidden" }, [d]: { exposure: "event" }, [_]: { exposure: "hidden" }, [h]: { exposure: "event" }, [p]: { exposure: "hidden" }, [g]: { exposure: "event" }, [v]: { exposure: "event" }, [f]: { exposure: "event" }, [m]: { exposure: "hidden" }, [y]: { exposure: "event" }, [b]: { exposure: "hidden" }, $session_recording_enabled_server_side: { exposure: "hidden" }, [P]: { exposure: "hidden" }, [I]: { exposure: "event" }, [w]: { exposure: "event", shouldSkipFromEventProperties: (e2) => ot(e2) }, $session_past_minimum_duration: { exposure: "event" }, $session_recording_url_trigger_activated_session: { exposure: "event" }, $session_recording_event_trigger_activated_session: { exposure: "event" }, $debug_first_full_snapshot_timestamp: { exposure: "event" }, $sess_rec_flush_size: { exposure: "hidden" }, [C]: { exposure: "derived", storageGroup: "flags", shouldSkipFromEventProperties: (e2, t2) => t2(), transformToEventProperties(e2) {
    if (!tt(e2)) return {};
    for (var t2 = {}, i2 = Object.keys(e2), r2 = 0; i2.length > r2; r2++) t2["$feature/" + i2[r2]] = e2[i2[r2]];
    return t2;
  } }, [T]: { exposure: "event", storageGroup: "flags" }, [F]: { exposure: "hidden" }, [R]: { exposure: "hidden", storageGroup: "flags" }, [L]: { exposure: "event", storageGroup: "flags" }, [M]: { exposure: "event", storageGroup: "flags", volatile: true }, [A]: { exposure: "event" }, [O]: { exposure: "hidden" }, [D]: { exposure: "hidden" }, [N]: { exposure: "hidden" }, [B]: { exposure: "hidden", storageGroup: "surveys" }, [U]: { exposure: "hidden", storageGroup: "surveys", volatile: true }, [q]: { exposure: "event" }, [H]: { exposure: "hidden" }, $product_tours_activated: { exposure: "hidden" }, $conversations_widget_session_id: { exposure: "event" }, $conversations_ticket_id: { exposure: "event" }, $conversations_widget_state: { exposure: "event" }, $conversations_user_traits: { exposure: "event" }, [z]: { exposure: "hidden" }, [j]: { exposure: "hidden" }, [V]: { exposure: "hidden" }, [W]: { exposure: "hidden", storageGroup: "flags", volatile: true }, [G]: { exposure: "hidden" }, [Q]: { exposure: "hidden" }, [K]: { exposure: "hidden" }, [Y]: { exposure: "hidden" }, [J]: { exposure: "hidden" }, [Z]: { exposure: "hidden" }, [X]: { exposure: "hidden" }, [S]: { exposure: "event" }, [E]: { exposure: "event" }, [x]: { exposure: "event" }, [k]: { exposure: "event" }, [ie]: { exposure: "event" }, [re]: { exposure: "event" }, [se]: { exposure: "event" }, $sdk_debug_replay_event_trigger_status: { exposure: "event" }, $sdk_debug_replay_linked_flag_trigger_status: { exposure: "event" }, $sdk_debug_replay_matched_recording_trigger_groups: { exposure: "event" }, $sdk_debug_replay_remote_trigger_matching_config: { exposure: "event" }, $sdk_debug_replay_trigger_groups_count: { exposure: "event" }, $sdk_debug_replay_url_trigger_status: { exposure: "event" }, $session_recording_start_reason: { exposure: "event" } };
  var Xs = [["$posthog_sr_group_event_trigger_", { exposure: "hidden" }], ["$posthog_sr_group_url_trigger_", { exposure: "hidden" }], ["$posthog_sr_group_sampling_", { exposure: "hidden" }]];
  var en = (e2) => {
    var t2 = Zs[e2];
    if (t2) return t2;
    for (var i2 of Xs) {
      var r2 = i2[1];
      if (0 === e2.indexOf(i2[0])) return r2;
    }
  };
  var tn = (e2) => {
    var t2 = null == be ? void 0 : be.createElement("a");
    return rt(t2) ? null : (t2.href = e2, t2);
  };
  var rn = function(e2, t2) {
    for (var i2, r2 = ((e2.split("#")[0] || "").split(/\?(.*)/)[1] || "").replace(/^\?+/g, "").split("&"), s2 = 0; r2.length > s2; s2++) {
      var n2 = r2[s2].split("=");
      if (n2[0] === t2) {
        i2 = n2;
        break;
      }
    }
    if (!Xe(i2) || 2 > i2.length) return "";
    var o2 = i2[1];
    try {
      o2 = decodeURIComponent(o2);
    } catch (e3) {
      xr.error("Skipping decoding for malformed query param: " + o2);
    }
    return o2.replace(/\+/g, " ");
  };
  var sn = function(e2, t2, i2) {
    if (!e2 || !t2 || !t2.length) return e2;
    for (var r2 = e2.split("#"), s2 = r2[1], n2 = (r2[0] || "").split("?"), o2 = n2[1], a2 = n2[0], l2 = (o2 || "").split("&"), u2 = [], c2 = 0; l2.length > c2; c2++) {
      var d2 = l2[c2].split("=");
      Xe(d2) && (t2.includes(d2[0]) ? u2.push(d2[0] + "=" + i2) : u2.push(l2[c2]));
    }
    var _2 = a2;
    return null != o2 && (_2 += "?" + u2.join("&")), null != s2 && (_2 += "#" + s2), _2;
  };
  var nn = function(e2, t2) {
    var i2 = e2.match(new RegExp(t2 + "=([^&]*)"));
    return i2 ? i2[1] : null;
  };
  var on = (e2, t2) => e2 >= t2 && Ce();
  var an = (e2, t2, i2, r2) => {
    if (0 === e2) {
      if (Ce()) {
        var s2 = t2 + 1;
        return s2 === i2 && r2(), s2;
      }
      return t2;
    }
    return 0;
  };
  var ln = "https?://(.*)";
  var un = ["gclid", "gclsrc", "dclid", "gbraid", "wbraid", "fbclid", "msclkid", "twclid", "li_fat_id", "igshid", "ttclid", "rdt_cid", "epik", "qclid", "sccid", "irclid", "_kx"];
  var cn = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gad_source", "mc_cid", ...un];
  var dn = "<masked>";
  var _n = ["li_fat_id"];
  function hn(e2, t2, i2) {
    if (!be) return {};
    var r2, s2 = t2 ? [...un, ...i2 || []] : [], n2 = pn(sn(be.URL, s2, dn), e2), o2 = (r2 = {}, Ir(_n, (function(e3) {
      var t3 = Wr._get(e3);
      r2[e3] = t3 || null;
    })), r2);
    return Cr(o2, n2);
  }
  function pn(e2, t2) {
    var i2 = cn.concat(t2 || []), r2 = {};
    return Ir(i2, (function(t3) {
      var i3 = rn(e2, t3);
      r2[t3] = i3 || null;
    })), r2;
  }
  function gn(e2) {
    var t2 = (function(e3) {
      return e3 ? 0 === e3.search(ln + "google.([^/?]*)") ? "google" : 0 === e3.search(ln + "bing.com") ? "bing" : 0 === e3.search(ln + "yahoo.com") ? "yahoo" : 0 === e3.search(ln + "duckduckgo.com") ? "duckduckgo" : null : null;
    })(e2), i2 = "yahoo" != t2 ? "q" : "p", r2 = {};
    if (!ot(t2)) {
      r2.$search_engine = t2;
      var s2 = be ? rn(be.referrer, i2) : "";
      s2.length && (r2.ph_keyword = s2);
    }
    return r2;
  }
  function vn() {
    return navigator.language || navigator.userLanguage;
  }
  var fn = "$direct";
  function mn() {
    return (null == be ? void 0 : be.referrer) || fn;
  }
  function yn(e2, t2, i2) {
    void 0 === i2 && (i2 = false);
    var r2 = e2 ? [...un, ...t2 || []] : [], s2 = i2 ? Ci(null == we ? void 0 : we.href) : null == we ? void 0 : we.href, n2 = null == s2 ? void 0 : s2.substring(0, 1e3);
    return { r: mn().substring(0, 1e3), u: n2 ? sn(n2, r2, dn) : void 0 };
  }
  function bn(e2, t2) {
    var i2;
    void 0 === t2 && (t2 = false);
    var r2 = e2.r, s2 = e2.u, n2 = t2 ? Ci(s2) : s2, o2 = { $referrer: r2, $referring_domain: null == r2 ? void 0 : r2 == fn ? fn : null == (i2 = tn(r2)) ? void 0 : i2.host };
    if (n2) {
      o2.$current_url = n2;
      var a2 = tn(n2);
      o2.$host = null == a2 ? void 0 : a2.host, o2.$pathname = null == a2 ? void 0 : a2.pathname;
      var l2 = pn(n2);
      Cr(o2, l2);
    }
    if (r2) {
      var u2 = gn(r2);
      Cr(o2, u2);
    }
    return o2;
  }
  function wn() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e2) {
      return;
    }
  }
  function Sn() {
    try {
      return (/* @__PURE__ */ new Date()).getTimezoneOffset();
    } catch (e2) {
      return;
    }
  }
  var En = { flags: W, surveys: U };
  var xn = ["cookie", "localstorage", "localstorage+cookie", "sessionstorage", "memory"];
  var kn = "main";
  var Pn = class {
    constructor(e2, t2, r2) {
      if (void 0 === r2 && (r2 = true), this._slotState = {}, this._splitStorageEligible = false, this._splitStorage = false, this._config = e2, this._ownsSplitStorage = r2, this.props = {}, this._campaign_params_saved = false, this._name = ((e3) => {
        var t3 = "";
        return e3.token && (t3 = e3.token.replace(/\+/g, "PL").replace(/\//g, "SL").replace(/=/g, "EQ")), e3.persistence_name ? "ph_" + e3.persistence_name : "ph_" + t3 + "_posthog";
      })(e2), this._storage = this._buildStorage(e2), this._splitStorage = this._resolveSplitStorage(e2), this.load(), e2.debug && xr.info("Persistence loaded", e2.persistence, i({}, this.props)), this.update_config(e2, e2, t2), this.save(), fe) {
        var s2 = () => this.flush();
        Or(fe, "beforeunload", s2, { capture: false }), Or(fe, "pagehide", s2, { capture: false });
      }
    }
    _saveDebounceMs() {
      var e2, t2 = null == (e2 = this._config) ? void 0 : e2.persistence_save_debounce_ms;
      return lt(t2) && t2 > 0 ? t2 : 0;
    }
    isDisabled() {
      return !!this._disabled;
    }
    _buildStorage(e2) {
      -1 === xn.indexOf(e2.persistence.toLowerCase()) && (xr.critical("Unknown persistence type " + e2.persistence + "; falling back to localStorage+cookie"), e2.persistence = "localStorage+cookie");
      var t2, r2 = (function(e3, t3) {
        void 0 === e3 && (e3 = []), void 0 === t3 && (t3 = false);
        var r3 = [...Kr, ...e3];
        return i({}, Qr, { _parse(e4) {
          try {
            var i2 = {};
            try {
              i2 = Wr._parse(e4) || {};
            } catch (e5) {
            }
            var r4, s3 = JSON.parse(Qr._get(e4) || "{}");
            if (t3) {
              var n3 = {};
              for (var o2 in i2) {
                var a2 = i2[o2];
                ot(a2) || "" === a2 || (n3[o2] = a2);
              }
              r4 = Cr(s3, n3);
            } else r4 = Cr(i2, s3);
            return Qr._set(e4, r4), r4;
          } catch (e5) {
          }
          return null;
        }, _set(e4, t4, i2, s3, n3, o2) {
          var a2 = Qr._set(e4, t4, void 0, void 0, o2);
          try {
            var l2 = {};
            r3.forEach(((e5) => {
              t4[e5] && (l2[e5] = t4[e5]);
            })), Object.keys(l2).length && Wr._set(e4, l2, i2, s3, n3, o2);
          } catch (e5) {
            Qr._error(e5);
          }
          return a2;
        }, _remove(e4, t4) {
          try {
            null == fe || fe.localStorage.removeItem(e4), Wr._remove(e4, t4);
          } catch (e5) {
            Qr._error(e5);
          }
        } });
      })(e2.cookie_persisted_properties || [], e2.__preview_cookie_wins_on_conflict || false), s2 = false, n2 = e2.persistence.toLowerCase();
      return "localstorage" === n2 && Qr._is_supported() ? (t2 = Qr, s2 = true) : "localstorage+cookie" === n2 && r2._is_supported() ? (t2 = r2, s2 = true) : "sessionstorage" === n2 && Xr._is_supported() ? t2 = Xr : "memory" === n2 ? t2 = Jr : "cookie" === n2 ? t2 = Wr : r2._is_supported() ? (t2 = r2, s2 = true) : t2 = Wr, this._splitStorageEligible = s2, t2;
    }
    _groupEntryName(e2) {
      return this._name + "__" + e2;
    }
    _resolveSplitStorage(e2) {
      return this._splitStorageEligible && !!e2.split_storage;
    }
    _isFeatureFlagCacheStale(e2) {
      var t2 = null != e2 ? e2 : this._config.feature_flag_cache_ttl_ms;
      if (!t2 || 0 >= t2) return false;
      var i2 = this.props[W];
      return !i2 || "number" != typeof i2 || Date.now() - i2 > t2;
    }
    properties() {
      var e2 = {};
      return Ir(this.props, ((t2, i2) => {
        var r2 = en(i2);
        if ("derived" === (null == r2 ? void 0 : r2.exposure)) {
          if (null != r2.shouldSkipFromEventProperties && r2.shouldSkipFromEventProperties(t2, i2 === C ? () => this._isFeatureFlagCacheStale() : () => false)) return;
          r2.transformToEventProperties && Cr(e2, r2.transformToEventProperties(t2));
        } else if (!r2 || "event" === r2.exposure) {
          if (null != r2 && null != r2.shouldSkipFromEventProperties && r2.shouldSkipFromEventProperties(t2, (() => false))) return;
          e2[i2] = t2;
        }
      })), e2;
    }
    load() {
      if (!this._disabled) {
        var e2 = this._storage._parse(this._name);
        e2 && (this.props = Cr({}, e2)), this._splitStorage && this._loadGroupEntries();
      }
    }
    _loadGroupEntries() {
      for (var e2 of Js) {
        var t2 = Qr._parse(this._groupEntryName(e2));
        if (t2 && !it(t2)) {
          var i2 = this._slotWriteState(e2);
          i2.persisted = true, this._mainCarriesGroupKey(e2) || (i2.fingerprint = this._entryFingerprint(t2, e2)), this._groupEntryIsStale(e2, t2) || Cr(this.props, t2);
        }
      }
    }
    _mainCarriesGroupKey(e2) {
      return Object.keys(this.props).some(((t2) => {
        var i2;
        return (null == (i2 = en(t2)) ? void 0 : i2.storageGroup) === e2;
      }));
    }
    _groupEntryIsStale(e2, t2) {
      var i2 = En[e2];
      if (!i2) return false;
      var r2 = t2[i2], s2 = this.props[i2];
      return lt(r2) && lt(s2) && s2 > r2;
    }
    refreshKey(e2) {
      var t2;
      if (!this._disabled) {
        var i2 = this._splitStorage ? null == (t2 = en(e2)) ? void 0 : t2.storageGroup : void 0, r2 = i2 ? Qr._parse(this._groupEntryName(i2)) : this._storage._parse(this._name);
        if (r2 && e2 in r2) this._setProp(e2, r2[e2]);
        else {
          if (i2) {
            var s2 = this._storage._parse(this._name);
            if (s2 && e2 in s2) return void this._setProp(e2, s2[e2]);
          }
          this._deleteProp(e2);
        }
      }
    }
    save() {
      if (!this._disabled) {
        var e2 = this._saveDebounceMs();
        e2 > 0 ? rt(this._pendingSaveTimer) && (this._pendingSaveTimer = setTimeout((() => {
          this._pendingSaveTimer = void 0, this._writeNow();
        }), e2)) : this._writeNow();
      }
    }
    flush() {
      rt(this._pendingSaveTimer) || (clearTimeout(this._pendingSaveTimer), this._pendingSaveTimer = void 0, this._writeNow());
    }
    _writeNow() {
      this._disabled || (this._splitStorage ? this._writeNowSplit() : this._writeEntry(this._storage, this._name, this.props, kn));
    }
    _writeNowSplit() {
      var e2 = this._partitionProps(), t2 = e2.main, i2 = e2.groups;
      for (var r2 of (this._writeEntry(this._storage, this._name, t2, kn), Js)) {
        var s2, n2 = i2[r2];
        (!it(n2) || null != (s2 = this._slotState[r2]) && s2.persisted) && this._writeEntry(Qr, this._groupEntryName(r2), n2, r2);
      }
    }
    _partitionProps() {
      var e2 = {}, t2 = { flags: {}, surveys: {} };
      return Ir(this.props, ((i2, r2) => {
        var s2, n2 = null == (s2 = en(r2)) ? void 0 : s2.storageGroup;
        n2 ? t2[n2][r2] = i2 : e2[r2] = i2;
      })), { main: e2, groups: t2 };
    }
    _entryFingerprint(e2, t2) {
      if (t2 === kn) return JSON.stringify(e2) + "|" + this._expire_days + "|" + this._cross_subdomain + "|" + this._secure;
      var i2 = {};
      return Ir(e2, ((e3, t3) => {
        var r2;
        i2[t3] = null != (r2 = en(t3)) && r2.volatile ? "__volatile__" : e3;
      })), JSON.stringify(i2);
    }
    _writeEntry(e2, t2, i2, r2) {
      var s2 = this._slotWriteState(r2);
      if (r2 === kn || s2.dirty || rt(s2.fingerprint)) {
        var n2;
        try {
          if ((n2 = this._entryFingerprint(i2, r2)) === s2.fingerprint) return void (s2.dirty = false);
        } catch (e3) {
          n2 = void 0;
        }
        e2._set(t2, i2, this._expire_days, this._cross_subdomain, this._secure, this._config.debug) ? (s2.dirty = false, r2 !== kn && (s2.persisted = true), rt(n2) || (s2.fingerprint = n2)) : this._config.debug && xr.warn('failed to persist storage entry "' + t2 + '"; will retry on next save');
      }
    }
    remove(e2) {
      var t2 = (void 0 === e2 ? {} : e2).keepGroupEntries, i2 = void 0 !== t2 && t2;
      if (rt(this._pendingSaveTimer) || (clearTimeout(this._pendingSaveTimer), this._pendingSaveTimer = void 0), this._storage._remove(this._name, false), this._storage._remove(this._name, true), !i2 && this._ownsSplitStorage) for (var r2 of Js) Qr._remove(this._groupEntryName(r2));
      i2 ? delete this._slotState[kn] : this._slotState = {};
    }
    clear() {
      this.remove(), this.props = {};
    }
    register_once(e2, t2, i2) {
      if (tt(e2)) {
        rt(t2) && (t2 = "None"), this._expire_days = rt(i2) ? this._default_expiry : i2;
        var r2 = false;
        if (Ir(e2, ((e3, i3) => {
          this.props.hasOwnProperty(i3) && this.props[i3] !== t2 || (this._setProp(i3, e3), r2 = true);
        })), r2) return this.save(), true;
      }
      return false;
    }
    register(e2, t2) {
      if (tt(e2)) {
        this._expire_days = rt(t2) ? this._default_expiry : t2;
        var i2 = false;
        if (Ir(e2, ((t3, r2) => {
          e2.hasOwnProperty(r2) && this.props[r2] !== t3 && (this._setProp(r2, t3), i2 = true);
        })), i2) return this.save(), true;
      }
      return false;
    }
    unregister(e2) {
      e2 in this.props && (this._deleteProp(e2), this.save());
    }
    update_campaign_params() {
      if (!this._campaign_params_saved) {
        var e2 = hn(this._config.custom_campaign_params, this._config.mask_personal_data_properties, this._config.custom_personal_data_properties);
        it(Lr(e2)) || this.register(e2), this._campaign_params_saved = true;
      }
    }
    update_search_keyword() {
      var e2;
      this.register((e2 = null == be ? void 0 : be.referrer) ? gn(e2) : {});
    }
    update_referrer_info() {
      var e2;
      this.register_once({ $referrer: mn(), $referring_domain: null != be && be.referrer && (null == (e2 = tn(be.referrer)) ? void 0 : e2.host) || fn }, void 0);
    }
    set_initial_person_info() {
      this.props[Y] || this.props[J] || this.register_once({ [Z]: yn(this._config.mask_personal_data_properties, this._config.custom_personal_data_properties, this._config.disable_capture_url_hashes) }, void 0);
    }
    get_initial_props() {
      var e2 = {};
      Ir([J, Y], ((t3) => {
        var i3 = this.props[t3];
        i3 && Ir(i3, (function(t4, i4) {
          e2["$initial_" + Qe(i4)] = t4;
        }));
      }));
      var t2 = this.props[Z];
      if (t2) {
        var i2 = (function(e3, t3) {
          void 0 === t3 && (t3 = false);
          var i3 = bn(e3, t3), r2 = {};
          return Ir(i3, (function(e4, t4) {
            r2["$initial_" + Qe(t4)] = e4;
          })), r2;
        })(t2, this._config.disable_capture_url_hashes);
        Cr(e2, i2);
      }
      return e2;
    }
    safe_merge(e2) {
      return Ir(this.props, (function(t2, i2) {
        i2 in e2 || (e2[i2] = t2);
      })), e2;
    }
    update_config(e2, t2, i2) {
      this._default_expiry = this._expire_days = e2.cookie_expiration, this.set_disabled(e2.disable_persistence || !!i2), this.set_cross_subdomain(e2.cross_subdomain_cookie), this.set_secure(e2.secure_cookie);
      var r2 = e2.persistence !== t2.persistence || !((e3, t3) => {
        if (e3.length !== t3.length) return false;
        var i3 = [...e3].sort(), r3 = [...t3].sort();
        return i3.every(((e4, t4) => e4 === r3[t4]));
      })(e2.cookie_persisted_properties || [], t2.cookie_persisted_properties || []), s2 = r2 ? this._buildStorage(e2) : this._storage, n2 = this._resolveSplitStorage(e2);
      if (r2 || n2 !== this._splitStorage) {
        var o2 = this.props;
        this.clear(), this._storage = s2, this._splitStorage = n2, this.props = o2, this.save();
      }
    }
    set_disabled(e2) {
      this._disabled = e2, this._disabled ? this.remove() : this.save();
    }
    set_cross_subdomain(e2) {
      e2 !== this._cross_subdomain && (this._cross_subdomain = e2, this.remove({ keepGroupEntries: true }), this.save());
    }
    set_secure(e2) {
      e2 !== this._secure && (this._secure = e2, this.remove({ keepGroupEntries: true }), this.save());
    }
    set_event_timer(e2, t2) {
      var i2 = this.props[c] || {};
      i2[e2] = t2, this._setProp(c, i2), this.save();
    }
    remove_event_timer(e2) {
      var t2 = this.props[c] || {}, i2 = t2[e2];
      return rt(i2) || (delete t2[e2], this._setProp(c, t2), this.save()), i2;
    }
    get_property(e2) {
      return this.props[e2];
    }
    set_property(e2, t2) {
      this._setProp(e2, t2), this.save();
    }
    _setProp(e2, t2) {
      var i2;
      this.props[e2] = t2, null != (i2 = en(e2)) && i2.volatile || this._markGroupDirty(e2);
    }
    _deleteProp(e2) {
      delete this.props[e2], this._markGroupDirty(e2);
    }
    _markGroupDirty(e2) {
      var t2, i2 = null == (t2 = en(e2)) ? void 0 : t2.storageGroup;
      i2 && (this._slotWriteState(i2).dirty = true);
    }
    _slotWriteState(e2) {
      return this._slotState[e2] || (this._slotState[e2] = {});
    }
  };
  var In = { Activation: "events", Cancellation: "cancelEvents" };
  var Rn = { Popover: "popover", API: "api", Widget: "widget", ExternalSurvey: "external_survey" };
  var On = { SHOWN: "survey shown", DISMISSED: "survey dismissed", SENT: "survey sent", ABANDONED: "survey abandoned" };
  var $n = { SURVEY_ID: "$survey_id", SURVEY_NAME: "$survey_name", SURVEY_RESPONSE: "$survey_response", SURVEY_ITERATION: "$survey_iteration", SURVEY_ITERATION_START_DATE: "$survey_iteration_start_date", SURVEY_PARTIALLY_COMPLETED: "$survey_partially_completed", SURVEY_SUBMISSION_ID: "$survey_submission_id", SURVEY_QUESTIONS: "$survey_questions", SURVEY_COMPLETED: "$survey_completed", PRODUCT_TOUR_ID: "$product_tour_id", SURVEY_LAST_SEEN_DATE: "$survey_last_seen_date", SURVEY_LANGUAGE: "$survey_language" };
  var Dn = { Popover: "popover", Inline: "inline" };
  var Bn = { SHOWN: "product tour shown", DISMISSED: "product tour dismissed", COMPLETED: "product tour completed", STEP_SHOWN: "product tour step shown", STEP_COMPLETED: "product tour step completed", BUTTON_CLICKED: "product tour button clicked", STEP_SELECTOR_FAILED: "product tour step selector failed", BANNER_CONTAINER_SELECTOR_FAILED: "product tour banner container selector failed", BANNER_ACTION_CLICKED: "product tour banner action clicked" };
  var Un = { TOUR_ID: "$product_tour_id", TOUR_NAME: "$product_tour_name", TOUR_ITERATION: "$product_tour_iteration", TOUR_RENDER_REASON: "$product_tour_render_reason", TOUR_STEP_ID: "$product_tour_step_id", TOUR_STEP_ORDER: "$product_tour_step_order", TOUR_STEP_TYPE: "$product_tour_step_type", TOUR_DISMISS_REASON: "$product_tour_dismiss_reason", TOUR_BUTTON_TEXT: "$product_tour_button_text", TOUR_BUTTON_ACTION: "$product_tour_button_action", TOUR_BUTTON_LINK: "$product_tour_button_link", TOUR_BUTTON_TOUR_ID: "$product_tour_button_tour_id", TOUR_STEPS_COUNT: "$product_tour_steps_count", TOUR_STEP_SELECTOR: "$product_tour_step_selector", TOUR_STEP_SELECTOR_FOUND: "$product_tour_step_selector_found", TOUR_STEP_ELEMENT_TAG: "$product_tour_step_element_tag", TOUR_STEP_ELEMENT_ID: "$product_tour_step_element_id", TOUR_STEP_ELEMENT_CLASSES: "$product_tour_step_element_classes", TOUR_STEP_ELEMENT_TEXT: "$product_tour_step_element_text", TOUR_ERROR: "$product_tour_error", TOUR_MATCHES_COUNT: "$product_tour_matches_count", TOUR_FAILURE_PHASE: "$product_tour_failure_phase", TOUR_WAITED_FOR_ELEMENT: "$product_tour_waited_for_element", TOUR_WAIT_DURATION_MS: "$product_tour_wait_duration_ms", TOUR_BANNER_SELECTOR: "$product_tour_banner_selector", TOUR_LINKED_SURVEY_ID: "$product_tour_linked_survey_id", USE_MANUAL_SELECTOR: "$use_manual_selector", INFERENCE_DATA_PRESENT: "$inference_data_present", TOUR_LAST_SEEN_DATE: "$product_tour_last_seen_date", TOUR_TYPE: "$product_tour_type" };
  var qn = kr("[RateLimiter]");
  var Hn = class {
    constructor(e2) {
      this.serverLimits = {}, this.lastEventRateLimited = false, this.checkForLimiting = (e3) => {
        var t2 = e3.text;
        if (t2 && t2.length) try {
          (JSON.parse(t2).quota_limited || []).forEach(((e4) => {
            qn.info((e4 || "events") + " is quota limited."), this.serverLimits[e4] = (/* @__PURE__ */ new Date()).getTime() + 6e4;
          }));
        } catch (e4) {
          return void qn.warn('could not rate limit - continuing. Error: "' + (null == e4 ? void 0 : e4.message) + '"', { text: t2 });
        }
      }, this.instance = e2, this.lastEventRateLimited = this.clientRateLimitContext(true).isRateLimited;
    }
    get captureEventsPerSecond() {
      var e2;
      return (null == (e2 = this.instance.config.rate_limiting) ? void 0 : e2.events_per_second) || 10;
    }
    get captureEventsBurstLimit() {
      var e2;
      return Math.max((null == (e2 = this.instance.config.rate_limiting) ? void 0 : e2.events_burst_limit) || 10 * this.captureEventsPerSecond, this.captureEventsPerSecond);
    }
    clientRateLimitContext(e2) {
      var t2, i2, r2;
      void 0 === e2 && (e2 = false);
      var s2 = this.captureEventsBurstLimit, n2 = this.captureEventsPerSecond, o2 = (/* @__PURE__ */ new Date()).getTime(), a2 = null !== (t2 = null == (i2 = this.instance.persistence) ? void 0 : i2.get_property(K)) && void 0 !== t2 ? t2 : { tokens: s2, last: o2 };
      a2.tokens += (o2 - a2.last) / 1e3 * n2, a2.last = o2, a2.tokens > s2 && (a2.tokens = s2);
      var l2 = 1 > a2.tokens;
      return l2 || e2 || (a2.tokens = Math.max(0, a2.tokens - 1)), !l2 || this.lastEventRateLimited || e2 || this.instance.capture("$$client_ingestion_warning", { $$client_ingestion_warning_message: "posthog-js client rate limited. Config is set to " + n2 + " events per second and " + s2 + " events burst limit." }, { skip_client_rate_limiting: true }), this.lastEventRateLimited = l2, null == (r2 = this.instance.persistence) || r2.set_property(K, a2), { isRateLimited: l2, remainingTokens: a2.tokens };
    }
    isServerRateLimited(e2) {
      var t2 = this.serverLimits[e2 || "events"] || false;
      return false !== t2 && (/* @__PURE__ */ new Date()).getTime() < t2;
    }
  };
  var zn = kr("[RemoteConfig]");
  var jn = class {
    constructor(e2) {
      this._instance = e2;
    }
    get remoteConfig() {
      var e2;
      return null == (e2 = Ie._POSTHOG_REMOTE_CONFIG) || null == (e2 = e2[this._instance.config.token]) ? void 0 : e2.config;
    }
    _loadRemoteConfigJs(e2) {
      var t2, i2;
      null != (t2 = Ie.__PosthogExtensions__) && t2.loadExternalDependency ? null == (i2 = Ie.__PosthogExtensions__) || null == i2.loadExternalDependency || i2.loadExternalDependency(this._instance, "remote-config", (() => e2(this.remoteConfig))) : e2();
    }
    _loadRemoteConfigJSON(e2) {
      this._instance._send_request({ method: "GET", url: this._instance.requestRouter.endpointFor("assets", "/array/" + this._instance.config.token + "/config"), callback(t2) {
        e2(t2.json);
      } });
    }
    load() {
      try {
        if (this.remoteConfig) return zn.info("Using preloaded remote config", this.remoteConfig), this._onRemoteConfig(this.remoteConfig), void this._startRefreshInterval();
        if (this._instance._shouldDisableFlags()) return void zn.warn("Remote config is disabled. Falling back to local config.");
        this._loadRemoteConfigJs(((e2) => {
          if (!e2) return zn.info("No config found after loading remote JS config. Falling back to JSON."), void this._loadRemoteConfigJSON(((e3) => {
            this._onRemoteConfig(e3), this._startRefreshInterval();
          }));
          this._onRemoteConfig(e2), this._startRefreshInterval();
        }));
      } catch (e2) {
        zn.error("Error loading remote config", e2);
      }
    }
    stop() {
      this._refreshInterval && (clearInterval(this._refreshInterval), this._refreshInterval = void 0);
    }
    refresh() {
      !this._instance._shouldDisableFlags() && be && "hidden" !== be.visibilityState && this._instance.reloadFeatureFlags();
    }
    _startRefreshInterval() {
      var e2;
      if (!this._refreshInterval) {
        var t2 = null !== (e2 = this._instance.config.remote_config_refresh_interval_ms) && void 0 !== e2 ? e2 : 3e5;
        0 !== t2 && (this._refreshInterval = setInterval((() => {
          this.refresh();
        }), t2));
      }
    }
    _onRemoteConfig(e2) {
      var t2;
      e2 || zn.error("Failed to fetch remote config from PostHog."), this._instance._onRemoteConfig(e2 ? { ok: true, config: e2 } : { ok: false }), false !== (null == e2 ? void 0 : e2.hasFeatureFlags) && (this._instance.config.advanced_disable_feature_flags_on_first_load || null == (t2 = this._instance.featureFlags) || t2.ensureFlagsLoaded());
    }
  };
  var Wn = { GZipJS: "gzip-js", Base64: "base64" };
  var Gn = Uint8Array;
  var Qn = Uint16Array;
  var Kn = Uint32Array;
  var Yn = new Gn([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0]);
  var Jn = new Gn([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0]);
  var Zn = new Gn([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  var Xn = function(e2, t2) {
    for (var i2 = new Qn(31), r2 = 0; 31 > r2; ++r2) i2[r2] = t2 += 1 << e2[r2 - 1];
    var s2 = new Kn(i2[30]);
    for (r2 = 1; 30 > r2; ++r2) for (var n2 = i2[r2]; i2[r2 + 1] > n2; ++n2) s2[n2] = n2 - i2[r2] << 5 | r2;
    return [i2, s2];
  };
  var eo = Xn(Yn, 2);
  var to = eo[1];
  eo[0][28] = 258, to[258] = 28;
  for (io = Xn(Jn, 0)[1], ro = new Qn(32768), so = 0; 32768 > so; ++so) {
    no = (43690 & so) >>> 1 | (21845 & so) << 1;
    ro[so] = ((65280 & (no = (61680 & (no = (52428 & no) >>> 2 | (13107 & no) << 2)) >>> 4 | (3855 & no) << 4)) >>> 8 | (255 & no) << 8) >>> 1;
  }
  var no;
  var io;
  var ro;
  var so;
  var oo = function(e2, t2, i2) {
    for (var r2 = e2.length, s2 = 0, n2 = new Qn(t2); r2 > s2; ++s2) ++n2[e2[s2] - 1];
    var o2, a2 = new Qn(t2);
    for (s2 = 0; t2 > s2; ++s2) a2[s2] = a2[s2 - 1] + n2[s2 - 1] << 1;
    if (i2) {
      o2 = new Qn(1 << t2);
      var l2 = 15 - t2;
      for (s2 = 0; r2 > s2; ++s2) if (e2[s2]) for (var u2 = s2 << 4 | e2[s2], c2 = t2 - e2[s2], d2 = a2[e2[s2] - 1]++ << c2, _2 = d2 | (1 << c2) - 1; _2 >= d2; ++d2) o2[ro[d2] >>> l2] = u2;
    } else for (o2 = new Qn(r2), s2 = 0; r2 > s2; ++s2) o2[s2] = ro[a2[e2[s2] - 1]++] >>> 15 - e2[s2];
    return o2;
  };
  var ao = new Gn(288);
  for (so = 0; 144 > so; ++so) ao[so] = 8;
  for (so = 144; 256 > so; ++so) ao[so] = 9;
  for (so = 256; 280 > so; ++so) ao[so] = 7;
  for (so = 280; 288 > so; ++so) ao[so] = 8;
  var lo = new Gn(32);
  for (so = 0; 32 > so; ++so) lo[so] = 5;
  var uo = oo(ao, 9, 0);
  var co = oo(lo, 5, 0);
  var _o = function(e2) {
    return (e2 / 8 >> 0) + (7 & e2 && 1);
  };
  var ho = function(e2, t2, i2) {
    (null == i2 || i2 > e2.length) && (i2 = e2.length);
    var r2 = new (e2 instanceof Qn ? Qn : e2 instanceof Kn ? Kn : Gn)(i2 - t2);
    return r2.set(e2.subarray(t2, i2)), r2;
  };
  var po = function(e2, t2, i2) {
    var r2 = t2 / 8 >> 0;
    e2[r2] |= i2 <<= 7 & t2, e2[r2 + 1] |= i2 >>> 8;
  };
  var go = function(e2, t2, i2) {
    var r2 = t2 / 8 >> 0;
    e2[r2] |= i2 <<= 7 & t2, e2[r2 + 1] |= i2 >>> 8, e2[r2 + 2] |= i2 >>> 16;
  };
  var vo = function(e2, t2) {
    for (var i2 = [], r2 = 0; e2.length > r2; ++r2) e2[r2] && i2.push({ s: r2, f: e2[r2] });
    var s2 = i2.length, n2 = i2.slice();
    if (!s2) return [new Gn(0), 0];
    if (1 == s2) {
      var o2 = new Gn(i2[0].s + 1);
      return o2[i2[0].s] = 1, [o2, 1];
    }
    i2.sort((function(e3, t3) {
      return e3.f - t3.f;
    })), i2.push({ s: -1, f: 25001 });
    var a2 = i2[0], l2 = i2[1], u2 = 0, c2 = 1, d2 = 2;
    for (i2[0] = { s: -1, f: a2.f + l2.f, l: a2, r: l2 }; c2 != s2 - 1; ) a2 = i2[i2[d2].f > i2[u2].f ? u2++ : d2++], l2 = i2[u2 != c2 && i2[d2].f > i2[u2].f ? u2++ : d2++], i2[c2++] = { s: -1, f: a2.f + l2.f, l: a2, r: l2 };
    var _2 = n2[0].s;
    for (r2 = 1; s2 > r2; ++r2) n2[r2].s > _2 && (_2 = n2[r2].s);
    var h2 = new Qn(_2 + 1), p2 = fo(i2[c2 - 1], h2, 0);
    if (p2 > t2) {
      r2 = 0;
      var g2 = 0, v2 = p2 - t2, f2 = 1 << v2;
      for (n2.sort((function(e3, t3) {
        return h2[t3.s] - h2[e3.s] || e3.f - t3.f;
      })); s2 > r2; ++r2) {
        var m2 = n2[r2].s;
        if (t2 >= h2[m2]) break;
        g2 += f2 - (1 << p2 - h2[m2]), h2[m2] = t2;
      }
      for (g2 >>>= v2; g2 > 0; ) {
        var y2 = n2[r2].s;
        t2 > h2[y2] ? g2 -= 1 << t2 - h2[y2]++ - 1 : ++r2;
      }
      for (; r2 >= 0 && g2; --r2) {
        var b2 = n2[r2].s;
        h2[b2] == t2 && (--h2[b2], ++g2);
      }
      p2 = t2;
    }
    return [new Gn(h2), p2];
  };
  var fo = function(e2, t2, i2) {
    return -1 == e2.s ? Math.max(fo(e2.l, t2, i2 + 1), fo(e2.r, t2, i2 + 1)) : t2[e2.s] = i2;
  };
  var mo = function(e2) {
    for (var t2 = e2.length; t2 && !e2[--t2]; ) ;
    for (var i2 = new Qn(++t2), r2 = 0, s2 = e2[0], n2 = 1, o2 = function(e3) {
      i2[r2++] = e3;
    }, a2 = 1; t2 >= a2; ++a2) if (e2[a2] == s2 && a2 != t2) ++n2;
    else {
      if (!s2 && n2 > 2) {
        for (; n2 > 138; n2 -= 138) o2(32754);
        n2 > 2 && (o2(n2 > 10 ? n2 - 11 << 5 | 28690 : n2 - 3 << 5 | 12305), n2 = 0);
      } else if (n2 > 3) {
        for (o2(s2), --n2; n2 > 6; n2 -= 6) o2(8304);
        n2 > 2 && (o2(n2 - 3 << 5 | 8208), n2 = 0);
      }
      for (; n2--; ) o2(s2);
      n2 = 1, s2 = e2[a2];
    }
    return [i2.subarray(0, r2), t2];
  };
  var yo = function(e2, t2) {
    for (var i2 = 0, r2 = 0; t2.length > r2; ++r2) i2 += e2[r2] * t2[r2];
    return i2;
  };
  var bo = function(e2, t2, i2) {
    var r2 = i2.length, s2 = _o(t2 + 2);
    e2[s2] = 255 & r2, e2[s2 + 1] = r2 >>> 8, e2[s2 + 2] = 255 ^ e2[s2], e2[s2 + 3] = 255 ^ e2[s2 + 1];
    for (var n2 = 0; r2 > n2; ++n2) e2[s2 + n2 + 4] = i2[n2];
    return 8 * (s2 + 4 + r2);
  };
  var wo = function(e2, t2, i2, r2, s2, n2, o2, a2, l2, u2, c2) {
    po(t2, c2++, i2), ++s2[256];
    for (var d2 = vo(s2, 15), _2 = d2[0], h2 = d2[1], p2 = vo(n2, 15), g2 = p2[0], v2 = p2[1], f2 = mo(_2), m2 = f2[0], y2 = f2[1], b2 = mo(g2), w2 = b2[0], S2 = b2[1], E2 = new Qn(19), x2 = 0; m2.length > x2; ++x2) E2[31 & m2[x2]]++;
    for (x2 = 0; w2.length > x2; ++x2) E2[31 & w2[x2]]++;
    for (var k2 = vo(E2, 7), P2 = k2[0], I2 = k2[1], C2 = 19; C2 > 4 && !P2[Zn[C2 - 1]]; --C2) ;
    var T2, F2, R2, L2, M2 = u2 + 5 << 3, A2 = yo(s2, ao) + yo(n2, lo) + o2, O2 = yo(s2, _2) + yo(n2, g2) + o2 + 14 + 3 * C2 + yo(E2, P2) + (2 * E2[16] + 3 * E2[17] + 7 * E2[18]);
    if (A2 >= M2 && O2 >= M2) return bo(t2, c2, e2.subarray(l2, l2 + u2));
    if (po(t2, c2, 1 + (A2 > O2)), c2 += 2, A2 > O2) {
      T2 = oo(_2, h2, 0), F2 = _2, R2 = oo(g2, v2, 0), L2 = g2;
      var D2 = oo(P2, I2, 0);
      for (po(t2, c2, y2 - 257), po(t2, c2 + 5, S2 - 1), po(t2, c2 + 10, C2 - 4), c2 += 14, x2 = 0; C2 > x2; ++x2) po(t2, c2 + 3 * x2, P2[Zn[x2]]);
      c2 += 3 * C2;
      for (var N2 = [m2, w2], B2 = 0; 2 > B2; ++B2) {
        var U2 = N2[B2];
        for (x2 = 0; U2.length > x2; ++x2) po(t2, c2, D2[q2 = 31 & U2[x2]]), c2 += P2[q2], q2 > 15 && (po(t2, c2, U2[x2] >>> 5 & 127), c2 += U2[x2] >>> 12);
      }
    } else T2 = uo, F2 = ao, R2 = co, L2 = lo;
    for (x2 = 0; a2 > x2; ++x2) if (r2[x2] > 255) {
      var q2;
      go(t2, c2, T2[257 + (q2 = r2[x2] >>> 18 & 31)]), c2 += F2[q2 + 257], q2 > 7 && (po(t2, c2, r2[x2] >>> 23 & 31), c2 += Yn[q2]);
      var H2 = 31 & r2[x2];
      go(t2, c2, R2[H2]), c2 += L2[H2], H2 > 3 && (go(t2, c2, r2[x2] >>> 5 & 8191), c2 += Jn[H2]);
    } else go(t2, c2, T2[r2[x2]]), c2 += F2[r2[x2]];
    return go(t2, c2, T2[256]), c2 + F2[256];
  };
  var So = new Kn([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
  var Eo = (function() {
    for (var e2 = new Kn(256), t2 = 0; 256 > t2; ++t2) {
      for (var i2 = t2, r2 = 9; --r2; ) i2 = (1 & i2 && 3988292384) ^ i2 >>> 1;
      e2[t2] = i2;
    }
    return e2;
  })();
  var xo = function(e2, t2, i2) {
    for (; i2; ++t2) e2[t2] = i2, i2 >>>= 8;
  };
  function ko(e2, t2) {
    void 0 === t2 && (t2 = {});
    var i2 = /* @__PURE__ */ (function() {
      var e3 = 4294967295;
      return { p(t3) {
        for (var i3 = e3, r3 = 0; t3.length > r3; ++r3) i3 = Eo[255 & i3 ^ t3[r3]] ^ i3 >>> 8;
        e3 = i3;
      }, d() {
        return 4294967295 ^ e3;
      } };
    })(), r2 = e2.length;
    i2.p(e2);
    var s2, n2, o2, a2, l2, u2 = (a2 = 10 + ((s2 = t2).filename && s2.filename.length + 1 || 0), l2 = 8, (function(e3, t3, i3, r3, s3, n3) {
      var o3 = e3.length, a3 = new Gn(r3 + o3 + 5 * (1 + Math.floor(o3 / 7e3)) + s3), l3 = a3.subarray(r3, a3.length - s3), u3 = 0;
      if (!t3 || 8 > o3) for (var c3 = 0; o3 >= c3; c3 += 65535) {
        var d2 = c3 + 65535;
        o3 > d2 ? u3 = bo(l3, u3, e3.subarray(c3, d2)) : (l3[c3] = true, u3 = bo(l3, u3, e3.subarray(c3, o3)));
      }
      else {
        for (var _2 = So[t3 - 1], h2 = _2 >>> 13, p2 = 8191 & _2, g2 = (1 << i3) - 1, v2 = new Qn(32768), f2 = new Qn(g2 + 1), m2 = Math.ceil(i3 / 3), y2 = 2 * m2, b2 = function(t4) {
          return (e3[t4] ^ e3[t4 + 1] << m2 ^ e3[t4 + 2] << y2) & g2;
        }, w2 = new Kn(25e3), S2 = new Qn(288), E2 = new Qn(32), x2 = 0, k2 = 0, P2 = (c3 = 0, 0), I2 = 0, C2 = 0; o3 > c3; ++c3) {
          var T2 = b2(c3), F2 = 32767 & c3, R2 = f2[T2];
          if (v2[F2] = R2, f2[T2] = F2, c3 >= I2) {
            var L2 = o3 - c3;
            if ((x2 > 7e3 || P2 > 24576) && L2 > 423) {
              u3 = wo(e3, l3, 0, w2, S2, E2, k2, P2, C2, c3 - C2, u3), P2 = x2 = k2 = 0, C2 = c3;
              for (var M2 = 0; 286 > M2; ++M2) S2[M2] = 0;
              for (M2 = 0; 30 > M2; ++M2) E2[M2] = 0;
            }
            var A2 = 2, O2 = 0, D2 = p2, N2 = F2 - R2 & 32767;
            if (L2 > 2 && T2 == b2(c3 - N2)) for (var B2 = Math.min(h2, L2) - 1, U2 = Math.min(32767, c3), q2 = Math.min(258, L2); U2 >= N2 && --D2 && F2 != R2; ) {
              if (e3[c3 + A2] == e3[c3 + A2 - N2]) {
                for (var H2 = 0; q2 > H2 && e3[c3 + H2] == e3[c3 + H2 - N2]; ++H2) ;
                if (H2 > A2) {
                  if (A2 = H2, O2 = N2, H2 > B2) break;
                  var z2 = Math.min(N2, H2 - 2), j2 = 0;
                  for (M2 = 0; z2 > M2; ++M2) {
                    var V2 = c3 - N2 + M2 + 32768 & 32767, W2 = V2 - v2[V2] + 32768 & 32767;
                    W2 > j2 && (j2 = W2, R2 = V2);
                  }
                }
              }
              N2 += (F2 = R2) - (R2 = v2[F2]) + 32768 & 32767;
            }
            if (O2) {
              w2[P2++] = 268435456 | to[A2] << 18 | io[O2];
              var G2 = 31 & to[A2], Q2 = 31 & io[O2];
              k2 += Yn[G2] + Jn[Q2], ++S2[257 + G2], ++E2[Q2], I2 = c3 + A2, ++x2;
            } else w2[P2++] = e3[c3], ++S2[e3[c3]];
          }
        }
        u3 = wo(e3, l3, true, w2, S2, E2, k2, P2, C2, c3 - C2, u3);
      }
      return ho(a3, 0, r3 + _o(u3) + s3);
    })(n2 = e2, null == (o2 = t2).level ? 6 : o2.level, null == o2.mem ? Math.ceil(1.5 * Math.max(8, Math.min(13, Math.log(n2.length)))) : 12 + o2.mem, a2, l2)), c2 = u2.length;
    return (function(e3, t3) {
      var i3 = t3.filename;
      if (e3[0] = 31, e3[1] = 139, e3[2] = 8, e3[8] = 2 > t3.level ? 4 : 9 == t3.level ? 2 : 0, e3[9] = 3, 0 != t3.mtime && xo(e3, 4, Math.floor(new Date(t3.mtime || Date.now()) / 1e3)), i3) {
        e3[3] = 8;
        for (var r3 = 0; i3.length >= r3; ++r3) e3[r3 + 10] = i3.charCodeAt(r3);
      }
    })(u2, t2), xo(u2, c2 - 8, i2.d()), xo(u2, c2 - 4, r2), u2;
  }
  var Po = !!Ee || !!Se;
  var Io = "text/plain";
  var Co = false;
  var To = (e2, t2) => {
    var i2 = e2.split("#"), r2 = i2[1], s2 = i2[0].split("?"), n2 = s2[0], o2 = s2[1];
    if (!o2) return e2;
    var a2 = o2.split("&").filter(((e3) => e3.split("=")[0] !== t2)).join("&");
    return n2 + (a2 ? "?" + a2 : "") + (r2 ? "#" + r2 : "");
  };
  var Fo = function(e2, t2, r2) {
    var s2;
    void 0 === r2 && (r2 = true);
    var n2 = e2.split("?"), o2 = n2[0], a2 = n2[1], l2 = i({}, t2), u2 = null !== (s2 = null == a2 ? void 0 : a2.split("&").map(((e3) => {
      var t3, i2 = e3.split("="), s3 = i2[0], n3 = r2 && null !== (t3 = l2[s3]) && void 0 !== t3 ? t3 : i2[1];
      return delete l2[s3], s3 + "=" + n3;
    }))) && void 0 !== s2 ? s2 : [], c2 = (function(e3, t3) {
      var i2, r3;
      void 0 === t3 && (t3 = "&");
      var s3 = [];
      return Ir(e3, (function(e4, t4) {
        rt(e4) || rt(t4) || "undefined" === t4 || (i2 = encodeURIComponent(((e5) => e5 instanceof File)(e4) ? e4.name : e4.toString()), r3 = encodeURIComponent(t4), s3[s3.length] = r3 + "=" + i2);
      })), s3.join(t3);
    })(l2);
    return c2 && u2.push(c2), o2 + "?" + u2.join("&");
  };
  var Ro = (e2, t2) => {
    try {
      return JSON.stringify(e2, ((e3, t3) => "bigint" == typeof t3 ? t3.toString() : t3), t2);
    } catch (t3) {
      return Ke(e2);
    }
  };
  var Lo = (e2) => {
    if (e2._encodedBody) return e2._encodedBody;
    var t2 = e2.data, i2 = e2.compression;
    if (t2) {
      if (i2 === Wn.GZipJS) {
        var r2 = ko((function(e3, t3) {
          var i3 = e3.length;
          if ("undefined" != typeof TextEncoder) return new TextEncoder().encode(e3);
          for (var r3 = new Gn(e3.length + (e3.length >>> 1)), s3 = 0, n3 = function(e4) {
            r3[s3++] = e4;
          }, o3 = 0; i3 > o3; ++o3) {
            if (s3 + 5 > r3.length) {
              var a2 = new Gn(s3 + 8 + (i3 - o3 << 1));
              a2.set(r3), r3 = a2;
            }
            var l2 = e3.charCodeAt(o3);
            128 > l2 ? n3(l2) : 2048 > l2 ? (n3(192 | l2 >>> 6), n3(128 | 63 & l2)) : l2 > 55295 && 57344 > l2 ? (n3(240 | (l2 = 65536 + (1047552 & l2) | 1023 & e3.charCodeAt(++o3)) >>> 18), n3(128 | l2 >>> 12 & 63), n3(128 | l2 >>> 6 & 63), n3(128 | 63 & l2)) : (n3(224 | l2 >>> 12), n3(128 | l2 >>> 6 & 63), n3(128 | 63 & l2));
          }
          return ho(r3, 0, s3);
        })(Ro(t2)), { mtime: 0 });
        return { contentType: Io, body: r2.buffer.slice(r2.byteOffset, r2.byteOffset + r2.byteLength), estimatedSize: r2.byteLength };
      }
      if (i2 === Wn.Base64) {
        var s2 = (function(e3) {
          return e3 ? btoa(encodeURIComponent(e3).replace(/%([0-9A-F]{2})/g, ((e4, t3) => String.fromCharCode(parseInt(t3, 16))))) : e3;
        })(Ro(t2)), n2 = ((e3) => "data=" + encodeURIComponent("string" == typeof e3 ? e3 : Ro(e3)))(s2);
        return { contentType: "application/x-www-form-urlencoded", body: n2, estimatedSize: new Blob([n2]).size };
      }
      var o2 = Ro(t2);
      return { contentType: "application/json", body: o2, estimatedSize: new Blob([o2]).size };
    }
  };
  var Mo = (e2) => {
    var t2, r2, s2 = () => "sendBeacon" === e2.transport ? { url: Fo(e2.url, { compression: Wn.Base64 }), encodedBody: Lo(i({}, e2, { compression: Wn.Base64, _encodedBody: void 0 })) } : { url: To(e2.url, "compression"), encodedBody: Lo(i({}, e2, { compression: void 0, _encodedBody: void 0 })) };
    try {
      t2 = Lo(e2);
    } catch (t3) {
      if (Be(e2.compression, rn(e2.url, "compression"))) return xr.error("Failed to gzip request body, sending uncompressed payload", t3), s2();
      throw t3;
    }
    return t2 && Be(e2.compression, rn(e2.url, "compression")) && !((r2 = t2.body) instanceof ArrayBuffer ? Ne(new Uint8Array(r2)) : ArrayBuffer.isView(r2) && Ne(new Uint8Array(r2.buffer, r2.byteOffset, r2.byteLength))) ? (Co = true, s2()) : { url: e2.url, encodedBody: t2 };
  };
  var Ao = (e2) => {
    try {
      return Mo(e2);
    } catch (t2) {
      return xr.error(t2), void (null == e2.callback || e2.callback({ statusCode: 0, error: t2 }));
    }
  };
  var Oo = (function() {
    var e2 = t((function* (e3) {
      var t2 = Ro(e3.data), r2 = yield (function(e4, t3, i2) {
        return ze.apply(this, arguments);
      })(t2, n.DEBUG, { rethrow: true });
      if (!r2) return e3;
      var s2 = yield r2.arrayBuffer();
      return i({}, e3, { _encodedBody: { contentType: Io, body: s2, estimatedSize: s2.byteLength } });
    }));
    return function(t2) {
      return e2.apply(this, arguments);
    };
  })();
  var $o = /Failed to fetch|NetworkError|Load failed/i;
  var Do = (e2) => {
    var t2 = Ao(e2);
    if (t2) {
      var r2 = t2.url, s2 = t2.encodedBody, n2 = null != s2 ? s2 : {}, o2 = n2.contentType, a2 = n2.body, l2 = n2.estimatedSize, u2 = new Headers();
      Ir(e2.headers, (function(e3, t3) {
        u2.append(t3, e3);
      })), o2 && u2.append("Content-Type", o2);
      var c2 = null, d2 = false;
      if (xe) {
        var _2 = new xe();
        c2 = { signal: _2.signal, timeout: setTimeout((() => {
          var t3, i2;
          d2 = true, _2.abort((t3 = e2.timeout, (i2 = new Error("PostHog request timed out" + (t3 ? " after " + t3 + "ms" : ""))).name = "AbortError", i2));
        }), e2.timeout) };
      }
      var h2 = (t3) => {
        d2 && "AbortError" === (null == t3 ? void 0 : t3.name) || ((e3) => "TypeError" === (null == e3 ? void 0 : e3.name) && $o.test((null == e3 ? void 0 : e3.message) || ""))(t3) ? xr.warn(t3) : xr.error(t3), null == e2.callback || e2.callback({ statusCode: 0, error: t3 });
      };
      try {
        var p2;
        Se(r2, i({ method: (null == e2 ? void 0 : e2.method) || "GET", headers: u2, keepalive: "POST" === e2.method && !e2._keepaliveDisabled && 52428.8 > (l2 || 0), body: a2, signal: null == (p2 = c2) ? void 0 : p2.signal }, e2.fetchOptions)).then(((t3) => t3.text().then(((i2) => {
          var r3 = { statusCode: t3.status, text: i2 };
          if (200 === t3.status) try {
            r3.json = JSON.parse(i2);
          } catch (e3) {
            xr.error(e3);
          }
          null == e2.callback || e2.callback(r3);
        })))).catch(h2).finally((() => c2 ? clearTimeout(c2.timeout) : null));
      } catch (e3) {
        c2 && clearTimeout(c2.timeout), h2(e3);
      }
    }
  };
  var No = (e2) => {
    try {
      var t2 = Mo(e2), r2 = t2.url, s2 = t2.encodedBody, n2 = null != s2 ? s2 : {}, o2 = n2.body, a2 = n2.estimatedSize;
      if (!o2) return;
      var l2 = o2 instanceof Blob ? o2 : new Blob([o2], { type: n2.contentType });
      if (ye.sendBeacon(r2, l2)) return;
      if (Xe(e2.data) && e2.data.length > 1 && (null != a2 ? a2 : 0) > 16384) {
        var u2 = Math.ceil(e2.data.length / 2);
        return No(i({}, e2, { data: e2.data.slice(0, u2) })), void No(i({}, e2, { data: e2.data.slice(u2) }));
      }
      xr.warn("Beacon of ~" + (null != a2 ? a2 : 0) + " bytes was rejected by the browser, falling back to fetch"), Do(i({}, e2, { _keepaliveDisabled: true }));
    } catch (e3) {
      xr.warn("Beacon send failed", e3);
    }
  };
  var Bo = ["/e/", "/s/"];
  var Uo = (e2, t2) => {
    var r2 = ((e3) => {
      var t3 = ((e4) => {
        var t4 = tn(e4), i2 = (null == t4 ? void 0 : t4.pathname) || e4.split(/[?#]/)[0];
        return i2 ? "/" === i2[0] ? i2 : "/" + i2 : "/";
      })(e3);
      return Bo.some(((e4) => ((e5, t4) => e5.slice(e5.length - t4.length) === t4)(t3, e4)));
    })(e2), s2 = r2 ? To(e2, "ver") : e2;
    return Fo(t2 === Wn.GZipJS ? To(s2, "compression") : s2, i({ _: (/* @__PURE__ */ new Date()).getTime().toString() }, r2 ? {} : { ver: n.JS_SDK_VERSION }, t2 === Wn.GZipJS ? {} : { compression: t2 }));
  };
  var qo = [];
  Se && qo.push({ transport: "fetch", method: Do }), Ee && qo.push({ transport: "XHR", method(e2) {
    var t2 = Ao(e2);
    if (t2) {
      var i2 = new Ee(), r2 = t2.encodedBody;
      i2.open(e2.method || "GET", t2.url, true);
      var s2 = null != r2 ? r2 : {}, n2 = s2.contentType, o2 = s2.body;
      Ir(e2.headers, (function(e3, t3) {
        i2.setRequestHeader(t3, e3);
      })), n2 && i2.setRequestHeader("Content-Type", n2), e2.timeout && (i2.timeout = e2.timeout), i2.onreadystatechange = () => {
        if (4 === i2.readyState) {
          var t3 = { statusCode: i2.status, text: i2.responseText };
          if (200 === i2.status) try {
            t3.json = JSON.parse(i2.responseText);
          } catch (e3) {
          }
          null == e2.callback || e2.callback(t3);
        }
      }, i2.send(o2);
    }
  } }), null != ye && ye.sendBeacon && qo.push({ transport: "sendBeacon", method: No });
  var Ho = 3e3;
  var zo = class {
    constructor(e2, t2) {
      this._isPaused = true, this._queue = [], this._flushTimeoutMs = bt((null == t2 ? void 0 : t2.flush_interval_ms) || Ho, 250, 5e3, xr.createLogger("flush interval"), Ho), this._sendRequest = e2;
    }
    enqueue(e2) {
      this._queue.push(e2), this._flushTimeout || this._setFlushTimeout();
    }
    unload() {
      this._clearFlushTimeout();
      var e2 = this._queue.length > 0 ? this._formatQueue() : {}, t2 = Object.values(e2);
      [...t2.filter(((e3) => 0 === e3.url.indexOf("/e"))), ...t2.filter(((e3) => 0 !== e3.url.indexOf("/e")))].map(((e3) => {
        this._sendRequestSafely(i({}, e3, { transport: "sendBeacon" }));
      }));
    }
    enable() {
      this._isPaused = false, this._setFlushTimeout();
    }
    _setFlushTimeout() {
      var e2 = this;
      this._isPaused || (this._flushTimeout = setTimeout((() => {
        if (this._clearFlushTimeout(), this._queue.length > 0) {
          var t2 = this._formatQueue(), i2 = function() {
            var i3 = t2[r2], s2 = (/* @__PURE__ */ new Date()).getTime();
            i3.data && Xe(i3.data) && Ir(i3.data, ((e3) => {
              e3.offset = Math.abs(e3.timestamp - s2), delete e3.timestamp;
            })), e2._sendRequestSafely(i3);
          };
          for (var r2 in t2) i2();
        }
      }), this._flushTimeoutMs));
    }
    _sendRequestSafely(e2) {
      try {
        this._sendRequest(e2);
      } catch (e3) {
        xr.error(e3);
      }
    }
    _clearFlushTimeout() {
      clearTimeout(this._flushTimeout), this._flushTimeout = void 0;
    }
    _formatQueue() {
      var e2 = {};
      return Ir(this._queue, ((t2) => {
        var r2, s2 = t2, n2 = (s2 ? s2.batchKey : null) || s2.url;
        rt(e2[n2]) && (e2[n2] = i({}, s2, { data: [] })), null == (r2 = e2[n2].data) || r2.push(s2.data);
      })), this._queue = [], e2;
    }
  };
  var jo = ["retriesPerformedSoFar"];
  var Vo = class {
    constructor(e2) {
      this._isPolling = false, this._pollIntervalMs = 3e3, this._queue = [], this._instance = e2, this._queue = [], this._areWeOnline = true, !rt(fe) && "onLine" in fe.navigator && (this._areWeOnline = fe.navigator.onLine, this._onlineListener = () => {
        this._areWeOnline = true, this._flush();
      }, this._offlineListener = () => {
        this._areWeOnline = false;
      }, Or(fe, "online", this._onlineListener), Or(fe, "offline", this._offlineListener));
    }
    get length() {
      return this._queue.length;
    }
    retriableRequest(e2) {
      var t2 = e2.retriesPerformedSoFar, s2 = r(e2, jo);
      ut(t2) && (s2.url = Fo(s2.url, { retry_count: t2 })), this._instance._send_request(i({}, s2, { callback: (e3) => {
        if (200 !== e3.statusCode && (400 > e3.statusCode || e3.statusCode >= 500)) {
          if ((0 === e3.statusCode ? 3 : 10) > (null != t2 ? t2 : 0)) return void this._enqueue(i({ retriesPerformedSoFar: t2 }, s2));
          0 === e3.statusCode && xr.warn("Request failed before receiving an HTTP response; this can happen due to network issues, CORS, browser blocking, or ad blockers. Stopped retrying after " + (null != t2 ? t2 : 0) + " retries.");
        }
        null == s2.callback || s2.callback(e3);
      } }));
    }
    _enqueue(e2) {
      var t2 = e2.retriesPerformedSoFar || 0;
      e2.retriesPerformedSoFar = t2 + 1;
      var i2 = (function(e3) {
        var t3 = 3e3 * Math.pow(2, e3), i3 = t3 / 2, r3 = Math.min(18e5, t3), s3 = Math.random() - 0.5;
        return Math.ceil(r3 + s3 * (r3 - i3));
      })(t2), r2 = Date.now() + i2;
      this._queue.push({ retryAt: r2, requestOptions: e2 });
      var s2 = "Enqueued failed request for retry in " + i2;
      navigator.onLine || (s2 += " (Browser is offline)"), xr.warn(s2), this._isPolling || (this._isPolling = true, this._poll());
    }
    _poll() {
      if (this._poller && clearTimeout(this._poller), 0 === this._queue.length) return this._isPolling = false, void (this._poller = void 0);
      this._poller = setTimeout((() => {
        this._areWeOnline && this._queue.length > 0 && this._flush(), this._poll();
      }), this._pollIntervalMs);
    }
    _flush() {
      var e2 = Date.now(), t2 = [], i2 = this._queue.filter(((i3) => e2 > i3.retryAt || (t2.push(i3), false)));
      if (this._queue = t2, i2.length > 0) for (var r2 of i2) this.retriableRequest(r2.requestOptions);
    }
    unload() {
      for (var e2 of (this._poller && (clearTimeout(this._poller), this._poller = void 0), this._isPolling = false, rt(fe) || (this._onlineListener && (fe.removeEventListener("online", this._onlineListener), this._onlineListener = void 0), this._offlineListener && (fe.removeEventListener("offline", this._offlineListener), this._offlineListener = void 0)), this._queue)) {
        var t2 = e2.requestOptions;
        try {
          this._instance._send_request(i({}, t2, { transport: "sendBeacon" }));
        } catch (e3) {
          xr.error(e3);
        }
      }
      this._queue = [];
    }
  };
  var Wo = class {
    constructor(e2) {
      this._updateScrollData = () => {
        var e3, t2, i2, r2;
        this._context || (this._context = {});
        var s2 = this.scrollElement(), n2 = this.scrollY(), o2 = s2 ? Math.max(0, s2.scrollHeight - s2.clientHeight) : 0, a2 = n2 + ((null == s2 ? void 0 : s2.clientHeight) || 0), l2 = (null == s2 ? void 0 : s2.scrollHeight) || 0;
        this._context.lastScrollY = Math.ceil(n2), this._context.maxScrollY = Math.max(n2, null !== (e3 = this._context.maxScrollY) && void 0 !== e3 ? e3 : 0), this._context.maxScrollHeight = Math.max(o2, null !== (t2 = this._context.maxScrollHeight) && void 0 !== t2 ? t2 : 0), this._context.lastContentY = a2, this._context.maxContentY = Math.max(a2, null !== (i2 = this._context.maxContentY) && void 0 !== i2 ? i2 : 0), this._context.maxContentHeight = Math.max(l2, null !== (r2 = this._context.maxContentHeight) && void 0 !== r2 ? r2 : 0);
      }, this._instance = e2;
    }
    get _scrollRoot() {
      return this._instance.config.scroll_root_selector;
    }
    getContext() {
      return this._context;
    }
    resetContext() {
      var e2 = this._context;
      return setTimeout(this._updateScrollData, 0), e2;
    }
    startMeasuringScrollPosition() {
      Or(fe, "scroll", this._updateScrollData, { capture: true }), Or(fe, "scrollend", this._updateScrollData, { capture: true }), Or(fe, "resize", this._updateScrollData);
    }
    scrollElement() {
      if (!this._scrollRoot) return null == fe ? void 0 : fe.document.documentElement;
      var e2 = Xe(this._scrollRoot) ? this._scrollRoot : [this._scrollRoot];
      for (var t2 of e2) {
        var i2 = null == fe ? void 0 : fe.document.querySelector(t2);
        if (i2) return i2;
      }
    }
    _scrollPosition(e2) {
      var t2 = "y" === e2 ? "scrollTop" : "scrollLeft";
      if (this._scrollRoot) {
        var i2 = this.scrollElement();
        return i2 && i2[t2] || 0;
      }
      return fe ? "y" === e2 ? fe.scrollY || fe.pageYOffset || fe.document.documentElement.scrollTop || 0 : fe.scrollX || fe.pageXOffset || fe.document.documentElement.scrollLeft || 0 : 0;
    }
    scrollY() {
      return this._scrollPosition("y");
    }
    scrollX() {
      return this._scrollPosition("x");
    }
  };
  var Go = (e2) => yn(null == e2 ? void 0 : e2.config.mask_personal_data_properties, null == e2 ? void 0 : e2.config.custom_personal_data_properties, null == e2 ? void 0 : e2.config.disable_capture_url_hashes);
  var Qo = class {
    constructor(e2, t2, i2, r2) {
      this._onSessionIdCallback = (e3) => {
        var t3 = this._getStored();
        if (!t3 || t3.sessionId !== e3) {
          var i3 = { sessionId: e3, props: this._sessionSourceParamGenerator(this._instance) };
          this._persistence.register({ [Q]: i3 });
        }
      }, this._instance = e2, this._sessionIdManager = t2, this._persistence = i2, this._sessionSourceParamGenerator = r2 || Go, this._sessionIdManager.onSessionId(this._onSessionIdCallback);
    }
    _getStored() {
      return this._persistence.props[Q];
    }
    getSetOnceProps() {
      var e2, t2 = null == (e2 = this._getStored()) ? void 0 : e2.props;
      return t2 ? "r" in t2 ? bn(t2, this._instance.config.disable_capture_url_hashes) : { $referring_domain: t2.referringDomain, $pathname: t2.initialPathName, utm_source: t2.utm_source, utm_campaign: t2.utm_campaign, utm_medium: t2.utm_medium, utm_content: t2.utm_content, utm_term: t2.utm_term } : {};
    }
    getSessionProps() {
      var e2 = {};
      return Ir(Lr(this.getSetOnceProps()), ((t2, i2) => {
        "$current_url" === i2 && (i2 = "url"), e2["$session_entry_" + Qe(i2)] = t2;
      })), e2;
    }
  };
  var Ko = class {
    constructor() {
      this._events = {};
    }
    on(e2, t2) {
      return this._events[e2] || (this._events[e2] = []), this._events[e2].push(t2), () => {
        this._events[e2] = this._events[e2].filter(((e3) => e3 !== t2));
      };
    }
    emit(e2, t2) {
      for (var i2 of this._events[e2] || []) i2(t2);
      for (var r2 of this._events["*"] || []) r2(e2, t2);
    }
  };
  var Yo = kr("[SessionId]");
  var Jo = class {
    on(e2, t2) {
      return this._eventEmitter.on(e2, t2);
    }
    constructor(e2, t2, i2) {
      var r2;
      if (this._lastPersistedActivityTimestamp = null, this._sessionIdChangedHandlers = [], this._beforeUnloadListener = void 0, this._destroyed = false, this._eventEmitter = new Ko(), this._sessionHasBeenIdleTooLong = (e3, t3) => !(!ut(e3) || !ut(t3)) && Math.abs(e3 - t3) > this.sessionTimeoutMs, !e2.persistence) throw new Error("SessionIdManager requires a PostHogPersistence instance");
      if (e2.config.cookieless_mode === ae) throw new Error('SessionIdManager cannot be used with cookieless_mode="always"');
      this._config = e2.config, this._persistence = e2.persistence, this._windowId = void 0, this._sessionId = void 0, this._sessionStartTimestamp = null, this._sessionActivityTimestamp = null, this._sessionIdGenerator = t2 || Hr, this._windowIdGenerator = i2 || Hr;
      var s2 = this._config.persistence_name || this._config.token;
      if (this._sessionTimeoutMs = 1e3 * bt(this._config.session_idle_timeout_seconds || 1800, 60, 36e3, Yo.createLogger("session_idle_timeout_seconds"), 1800), e2.register({ $configured_session_timeout_ms: this._sessionTimeoutMs }), this._resetIdleTimer(), this._window_id_storage_key = "ph_" + s2 + "_window_id", this._primary_window_exists_storage_key = "ph_" + s2 + "_primary_window_exists", this._canUseSessionStorage()) {
        var n2 = Xr._parse(this._window_id_storage_key), o2 = Xr._parse(this._primary_window_exists_storage_key);
        n2 && !o2 ? this._windowId = n2 : Xr._remove(this._window_id_storage_key), Xr._set(this._primary_window_exists_storage_key, true);
      }
      if (null != (r2 = this._config.bootstrap) && r2.sessionID) try {
        var a2 = ((e3) => {
          var t3 = this._config.bootstrap.sessionID.replace(/-/g, "");
          if (32 !== t3.length) throw new Error("Not a valid UUID");
          if ("7" !== t3[12]) throw new Error("Not a UUIDv7");
          return parseInt(t3.substring(0, 12), 16);
        })();
        this._setSessionId(this._config.bootstrap.sessionID, (/* @__PURE__ */ new Date()).getTime(), a2);
      } catch (e3) {
        Yo.error("Invalid sessionID in bootstrap", e3);
      }
      this._listenToReloadWindow();
    }
    get sessionTimeoutMs() {
      return this._sessionTimeoutMs;
    }
    onSessionId(e2) {
      return rt(this._sessionIdChangedHandlers) && (this._sessionIdChangedHandlers = []), this._sessionIdChangedHandlers.push(e2), this._sessionId && e2(this._sessionId, this._windowId), () => {
        this._sessionIdChangedHandlers = this._sessionIdChangedHandlers.filter(((t2) => t2 !== e2));
      };
    }
    _canUseSessionStorage() {
      return "memory" !== this._config.persistence && !this._persistence._disabled && Xr._is_supported();
    }
    _setWindowId(e2) {
      e2 !== this._windowId && (this._windowId = e2, this._canUseSessionStorage() && Xr._set(this._window_id_storage_key, e2));
    }
    _getWindowId() {
      return this._windowId ? this._windowId : this._canUseSessionStorage() ? Xr._parse(this._window_id_storage_key) : null;
    }
    _isActivityChangeBelowGranularity(e2) {
      var t2 = this._lastPersistedActivityTimestamp;
      return !ot(t2) && !ot(e2) && 5e3 > Math.abs(e2 - t2);
    }
    _setSessionId(e2, t2, i2) {
      var r2 = t2 !== this._sessionActivityTimestamp, s2 = !(e2 !== this._sessionId || i2 !== this._sessionStartTimestamp);
      this._sessionStartTimestamp = i2, this._sessionActivityTimestamp = t2, this._sessionId = e2, s2 && !r2 || s2 && this._isActivityChangeBelowGranularity(t2) || (this._lastPersistedActivityTimestamp = t2, this._persistence.register({ [P]: [t2, e2, i2] }));
    }
    _useCrossTabRefreshHardening() {
      var e2, t2 = null == (e2 = this._config) ? void 0 : e2.persistence_save_debounce_ms;
      return ut(t2) && t2 > 0;
    }
    _refreshSessionIdFromStorage() {
      this._useCrossTabRefreshHardening() ? this._persistence.refreshKey(P) : (this._persistence.flush(), this._persistence.load());
    }
    _flushPendingActivityTimestamp() {
      var e2;
      if (!ot(this._sessionActivityTimestamp) && this._sessionActivityTimestamp !== this._lastPersistedActivityTimestamp) {
        this._refreshSessionIdFromStorage();
        var t2 = this._getSessionId();
        t2[1] === this._sessionId && t2[2] === this._sessionStartTimestamp && (this._lastPersistedActivityTimestamp = this._sessionActivityTimestamp, this._persistence.register({ [P]: [this._sessionActivityTimestamp, null !== (e2 = this._sessionId) && void 0 !== e2 ? e2 : null, this._sessionStartTimestamp] }), this._persistence.flush());
      }
    }
    _freshestActivityTimestamp() {
      var e2 = this._getSessionId()[0], t2 = ut(e2) ? e2 : 0, i2 = ut(this._sessionActivityTimestamp) ? this._sessionActivityTimestamp : 0;
      return Math.max(t2, i2);
    }
    _isSessionIdleAfterCrossTabRefresh(e2) {
      return this._refreshSessionIdFromStorage(), this._sessionHasBeenIdleTooLong(e2, this._freshestActivityTimestamp());
    }
    _getSessionId() {
      var e2 = this._persistence.props[P];
      return Xe(e2) && 2 === e2.length && e2.push(e2[0]), e2 || [0, null, 0];
    }
    resetSessionId() {
      this._lastPersistedActivityTimestamp = null, clearTimeout(this._enforceIdleTimeout), this._enforceIdleTimeout = void 0, this._setSessionId(null, null, null);
    }
    destroy() {
      this._destroyed = true, this._flushPendingActivityTimestamp(), clearTimeout(this._enforceIdleTimeout), this._enforceIdleTimeout = void 0, this._beforeUnloadListener && fe && (fe.removeEventListener(_e, this._beforeUnloadListener, { capture: false }), this._beforeUnloadListener = void 0), this._sessionIdChangedHandlers = [];
    }
    _listenToReloadWindow() {
      this._beforeUnloadListener = () => {
        this._flushPendingActivityTimestamp(), this._canUseSessionStorage() && Xr._remove(this._primary_window_exists_storage_key);
      }, Or(fe, _e, this._beforeUnloadListener, { capture: false });
    }
    checkAndGetSessionAndWindowId(e2, t2) {
      if (void 0 === e2 && (e2 = false), void 0 === t2 && (t2 = null), this._config.cookieless_mode === ae) throw new Error('checkAndGetSessionAndWindowId should not be called with cookieless_mode="always"');
      var i2 = t2 || (/* @__PURE__ */ new Date()).getTime(), r2 = this._getSessionId(), s2 = r2[1], n2 = r2[2], o2 = this._freshestActivityTimestamp(), a2 = this._getWindowId(), l2 = ut(n2) && Math.abs(i2 - n2) > 864e5, u2 = false, c2 = false, d2 = !s2, _2 = s2, h2 = !d2 && !e2 && this._sessionHasBeenIdleTooLong(i2, o2);
      if (h2) {
        (h2 = this._isSessionIdleAfterCrossTabRefresh(i2)) || Yo.info("cross-tab refresh kept the session alive", { sessionId: s2 });
        var p2 = this._getSessionId();
        s2 = p2[1], n2 = p2[2];
      }
      d2 || h2 || l2 ? (s2 = this._sessionIdGenerator(), a2 = this._windowIdGenerator(), Yo.info("new session ID generated", { sessionId: s2, windowId: a2, changeReason: { noSessionId: d2, activityTimeout: h2, sessionPastMaximumLength: l2 } }), n2 = i2, u2 = true) : (a2 || (a2 = this._windowIdGenerator(), u2 = true), (c2 = s2 !== _2) && (Yo.info("adopted cross-tab session id", { sessionId: s2, windowId: a2 }), u2 = true));
      var g2 = ut(o2) && e2 && !l2 ? o2 : i2, v2 = ut(n2) ? n2 : (/* @__PURE__ */ new Date()).getTime();
      this._setWindowId(a2), this._setSessionId(s2, g2, v2), e2 || this._resetIdleTimer();
      var f2 = { noSessionId: d2, activityTimeout: h2, sessionPastMaximumLength: l2, crossTabAdoption: c2 };
      return u2 && this._sessionIdChangedHandlers.forEach(((e3) => e3(s2, a2, f2))), { sessionId: s2, windowId: a2, sessionStartTimestamp: v2, changeReason: u2 ? f2 : void 0, lastActivityTimestamp: o2 };
    }
    _resetIdleTimer() {
      this._destroyed || (clearTimeout(this._enforceIdleTimeout), this._enforceIdleTimeout = setTimeout((() => {
        if (!this._destroyed) if (this._isSessionIdleAfterCrossTabRefresh((/* @__PURE__ */ new Date()).getTime())) {
          var e2 = this._sessionId;
          this.resetSessionId(), this._eventEmitter.emit("forcedIdleReset", { idleSessionId: e2 });
        } else this._resetIdleTimer();
      }), 1.1 * this.sessionTimeoutMs));
    }
  };
  var Zo = function(e2, t2) {
    if (!e2) return false;
    var i2 = e2.userAgent;
    if (i2 && Ve(i2, t2)) return true;
    try {
      var r2 = null == e2 ? void 0 : e2.userAgentData;
      if (null != r2 && r2.brands && r2.brands.some(((e3) => Ve(null == e3 ? void 0 : e3.brand, t2)))) return true;
    } catch (e3) {
    }
    return !!e2.webdriver;
  };
  function Xo() {
    return (Xo = t((function* () {
      var e2 = null == ye ? void 0 : ye.userAgentData;
      if (null != e2 && e2.getHighEntropyValues) try {
        var t2 = yield e2.getHighEntropyValues(["model"]), i2 = null == t2 ? void 0 : t2.model;
        return st(i2) && i2.length > 0 ? i2 : void 0;
      } catch (e3) {
        return void xr.info("Unable to resolve $device_model from userAgentData.getHighEntropyValues", e3);
      }
    }))).apply(this, arguments);
  }
  var ea = function(e2, t2) {
    if (!(function(e3) {
      try {
        new RegExp(e3);
      } catch (e4) {
        return false;
      }
      return true;
    })(t2)) return false;
    try {
      return new RegExp(t2).test(e2);
    } catch (e3) {
      return false;
    }
  };
  function ta(e2, t2, i2) {
    return Ro({ distinct_id: e2, userPropertiesToSet: t2, userPropertiesToSetOnce: i2 });
  }
  var ia = { exact: (e2, t2) => t2.some(((t3) => e2.some(((e3) => t3 === e3)))), is_not: (e2, t2) => t2.every(((t3) => e2.every(((e3) => t3 !== e3)))), regex: (e2, t2) => t2.some(((t3) => e2.some(((e3) => ea(t3, e3))))), not_regex: (e2, t2) => t2.every(((t3) => e2.every(((e3) => !ea(t3, e3))))), icontains: (e2, t2) => t2.map(ra).some(((t3) => e2.map(ra).some(((e3) => t3.includes(e3))))), not_icontains: (e2, t2) => t2.map(ra).every(((t3) => e2.map(ra).every(((e3) => !t3.includes(e3))))), gt: (e2, t2) => t2.some(((t3) => {
    var i2 = parseFloat(t3);
    return !isNaN(i2) && e2.some(((e3) => i2 > parseFloat(e3)));
  })), lt: (e2, t2) => t2.some(((t3) => {
    var i2 = parseFloat(t3);
    return !isNaN(i2) && e2.some(((e3) => i2 < parseFloat(e3)));
  })) };
  var ra = (e2) => e2.toLowerCase();
  function sa(e2, t2) {
    return !e2 || Object.entries(e2).every(((e3) => {
      var i2 = e3[1], r2 = null == t2 ? void 0 : t2[e3[0]];
      if (rt(r2) || ot(r2)) return false;
      var s2 = [String(r2)], n2 = ia[i2.operator];
      return !!n2 && n2(i2.values, s2);
    }));
  }
  var na = "custom";
  var oa = "i.posthog.com";
  var aa = /^\/static\//;
  var la = class {
    constructor(e2) {
      this._regionCache = {}, this.instance = e2;
    }
    get apiHost() {
      var e2 = this.instance.config.api_host.trim().replace(/\/$/, "");
      return "https://app.posthog.com" === e2 ? "https://us.i.posthog.com" : e2;
    }
    get flagsApiHost() {
      var e2 = this.instance.config.flags_api_host;
      return e2 ? e2.trim().replace(/\/$/, "") : this.apiHost;
    }
    get uiHost() {
      var e2, t2 = null == (e2 = this.instance.config.ui_host) ? void 0 : e2.replace(/\/$/, "");
      return t2 || (t2 = this.apiHost.replace("." + oa, ".posthog.com")), "https://app.posthog.com" === t2 ? "https://us.posthog.com" : t2;
    }
    get region() {
      return this._regionCache[this.apiHost] || (this._regionCache[this.apiHost] = /https:\/\/(app|us|us-assets)(\.i)?\.posthog\.com/i.test(this.apiHost) ? "us" : /https:\/\/(eu|eu-assets)(\.i)?\.posthog\.com/i.test(this.apiHost) ? "eu" : na), this._regionCache[this.apiHost];
    }
    _staticAssetHostOverride(e2) {
      if (aa.test(e2)) {
        var t2 = this.instance.config.asset_host;
        if ("string" == typeof t2) return t2.trim().replace(/\/$/, "") || void 0;
      }
    }
    endpointFor(e2, t2) {
      if (void 0 === t2 && (t2 = ""), t2 && (t2 = "/" === t2[0] ? t2 : "/" + t2), "ui" === e2) return this.uiHost + t2;
      if ("flags" === e2) return this.flagsApiHost + t2;
      if ("assets" === e2) {
        var i2 = this._staticAssetHostOverride(t2);
        if (i2) return "" + i2 + t2;
      }
      if (this.region === na) return this.apiHost + t2;
      var r2 = oa + t2;
      switch (e2) {
        case "assets":
          return "https://" + this.region + "-assets." + r2;
        case "api":
          return "https://" + this.region + "." + r2;
      }
    }
  };
  function ua(e2) {
    var t2;
    return !(null == (t2 = e2.conditions) || null == (t2 = t2.events) || null == (t2 = t2.values) || !t2.length);
  }
  var ca = kr("[Surveys]");
  var da = "seenSurvey_";
  var _a = (e2) => {
    try {
      var t2 = ((e3) => ((e4, t3) => "" + da + (function(e5) {
        return e5.current_iteration && e5.current_iteration > 0 ? e5.id + "_" + e5.current_iteration : e5.id;
      })(t3))(0, e3))(e2);
      if (localStorage.getItem(t2)) return;
      localStorage.setItem(t2, "true");
    } catch (e3) {
      ca.error("Failed to persist survey seen state", e3);
    }
  };
  var ha = [Rn.Popover, Rn.Widget, Rn.API];
  var pa = { ignoreConditions: false, ignoreDelay: false, displayType: Dn.Popover };
  var ga = kr("[PostHog ExternalIntegrations]");
  var va = { intercom: "intercom-integration", crispChat: "crisp-chat-integration" };
  var fa = class {
    constructor(e2) {
      this._instance = e2;
    }
    _loadScript(e2, t2) {
      var i2;
      null == (i2 = Ie.__PosthogExtensions__) || null == i2.loadExternalDependency || i2.loadExternalDependency(this._instance, e2, ((e3) => {
        if (e3) return ga.error("failed to load script", e3);
        t2();
      }));
    }
    startIfEnabledOrStop() {
      var e2 = this, t2 = function() {
        var t3, r3, s2, n2 = i2[0], o2 = i2[1];
        !o2 || null != (t3 = Ie.__PosthogExtensions__) && null != (t3 = t3.integrations) && t3[n2] || e2._loadScript(va[n2], (() => {
          var t4;
          null == (t4 = Ie.__PosthogExtensions__) || null == (t4 = t4.integrations) || null == (t4 = t4[n2]) || t4.start(e2._instance);
        })), !o2 && null != (r3 = Ie.__PosthogExtensions__) && null != (r3 = r3.integrations) && r3[n2] && (null == (s2 = Ie.__PosthogExtensions__) || null == (s2 = s2.integrations) || null == (s2 = s2[n2]) || s2.stop());
      };
      for (var i2 of Object.entries(null !== (r2 = this._instance.config.integrations) && void 0 !== r2 ? r2 : {})) {
        var r2;
        t2();
      }
    }
  };
  var ma = {};
  var ya = 0;
  var ba = () => {
  };
  var wa = 'Consent opt in/out is not valid with cookieless_mode="always" and will be ignored';
  var Sa = "Surveys module not available";
  var Ea = "sanitize_properties is deprecated. Use before_send instead";
  var xa = "Invalid value for property_denylist config: ";
  var ka = "posthog";
  var Pa = !Po && -1 === (null == Pe ? void 0 : Pe.indexOf("MSIE")) && -1 === (null == Pe ? void 0 : Pe.indexOf("Mozilla"));
  var Ia = (e2) => {
    var t2;
    return i({ api_host: "https://us.i.posthog.com", flags_api_host: null, ui_host: null, asset_host: null, token: "", autocapture: true, cross_subdomain_cookie: Ar(null == be ? void 0 : be.location), persistence: "localStorage+cookie", persistence_name: "", cookie_persisted_properties: [], loaded: ba, save_campaign_params: true, custom_campaign_params: [], custom_blocked_useragents: [], save_referrer: true, capture_pageleave: "if_capture_pageview", defaults: null != e2 ? e2 : "unset", __preview_deferred_init_extensions: false, __preview_external_dependency_versioned_paths: false, __preview_cookie_wins_on_conflict: false, debug: we && st(null == we ? void 0 : we.search) && -1 !== we.search.indexOf("__posthog_debug=true") || false, cookie_expiration: 365, upgrade: false, disable_session_recording: false, disable_persistence: false, disable_web_experiments: true, disable_surveys: false, disable_surveys_automatic_display: false, disable_conversations: false, disable_product_tours: false, disableDeviceModel: false, disable_external_dependency_loading: false, strict_script_versioning: false, enable_recording_console_log: void 0, secure_cookie: "https:" === (null == fe || null == (t2 = fe.location) ? void 0 : t2.protocol), ip: false, opt_out_capturing_by_default: false, opt_out_persistence_by_default: false, opt_out_useragent_filter: false, opt_out_capturing_persistence_type: "localStorage", consent_persistence_name: null, opt_out_capturing_cookie_prefix: null, opt_in_site_apps: false, property_denylist: [], respect_dnt: false, sanitize_properties: null, request_headers: {}, request_batching: true, properties_string_max_length: 65535, mask_all_element_attributes: false, mask_all_text: false, mask_personal_data_properties: false, custom_personal_data_properties: [], advanced_disable_flags: false, advanced_disable_decide: false, advanced_disable_feature_flags: false, advanced_disable_feature_flags_on_first_load: false, advanced_only_evaluate_survey_feature_flags: false, advanced_feature_flags_dedup_per_session: false, advanced_enable_surveys: false, advanced_disable_toolbar_metrics: false, feature_flag_request_timeout_ms: 3e3, surveys_request_timeout_ms: 1e4, on_request_error(e3) {
      xr.error("Bad HTTP status: " + e3.statusCode + " " + e3.text);
    }, get_device_id: (e3) => e3, capture_performance: void 0, name: "posthog", bootstrap: {}, disable_compression: false, session_idle_timeout_seconds: 1800, person_profiles: ce, before_send: void 0, get_current_url: void 0, request_queue_config: { flush_interval_ms: Ho }, error_tracking: {}, _onCapture: ba }, ((e3) => ({ rageclick: e3 && e3 >= "2026-05-30" ? { content_ignorelist: Ss, ignore_text_selection: true } : !e3 || "2025-11-30" > e3 || { content_ignorelist: true }, capture_pageview: !e3 || "2025-05-24" > e3 || "history_change", session_recording: e3 && e3 >= "2026-06-25" ? { strictMinimumDuration: true, canvasCapture: { resolutionScale: 0.6 }, streamNetworkBody: true } : e3 && e3 >= "2026-05-30" ? { strictMinimumDuration: true, canvasCapture: { resolutionScale: 0.6 } } : e3 && e3 >= "2025-11-30" ? { strictMinimumDuration: true } : {}, external_scripts_inject_target: e3 && e3 >= "2026-01-30" ? "head" : "body", internal_or_test_user_hostname: e3 && e3 >= "2026-01-30" ? /^(localhost|127\.0\.0\.1)$/ : void 0, persistence_save_debounce_ms: e3 && e3 >= "2026-05-30" ? 250 : 0, split_storage: !(!e3 || "2026-05-30" > e3), detect_google_search_app: !(!e3 || "2026-05-30" > e3), disable_capture_url_hashes: !(!e3 || "2026-06-25" > e3) }))(e2));
  };
  var Ca = [["process_person", "person_profiles"], ["xhr_headers", "request_headers"], ["cookie_name", "persistence_name"], ["disable_cookie", "disable_persistence"], ["__preview_disable_beacon", "disable_beacon"], ["store_google", "save_campaign_params"], ["verbose", "debug"]];
  var Ta = (e2) => {
    var t2 = {};
    for (var i2 of Ca) {
      var r2 = i2[0], s2 = i2[1];
      rt(e2[r2]) || (t2[s2] = e2[r2]);
    }
    var n2 = Cr({}, t2, e2), o2 = e2.__preview_external_dependency_versioned_paths;
    return rt(o2) || (rt(e2.strict_script_versioning) && (n2.strict_script_versioning = !!o2), st(o2) && rt(e2.asset_host) && (n2.asset_host = o2)), Xe(e2.property_blacklist) && (rt(e2.property_denylist) ? n2.property_denylist = e2.property_blacklist : Xe(e2.property_denylist) ? n2.property_denylist = [...e2.property_blacklist, ...e2.property_denylist] : xr.error(xa + e2.property_denylist)), n2;
  };
  var Fa = class {
    constructor() {
      this.__forceAllowLocalhost = false;
    }
    get _forceAllowLocalhost() {
      return this.__forceAllowLocalhost;
    }
    set _forceAllowLocalhost(e2) {
      xr.error("WebPerformanceObserver is deprecated and has no impact on network capture. Use `_forceAllowLocalhostNetworkCapture` on `posthog.sessionRecording`"), this.__forceAllowLocalhost = e2;
    }
  };
  var Ra = class _Ra {
    _replaceExtension(e2, t2) {
      if (e2) {
        var i2 = this._extensions.indexOf(e2);
        -1 !== i2 && this._extensions.splice(i2, 1);
      }
      return this._extensions.push(t2), null == t2.initialize || t2.initialize(), t2;
    }
    _inCookielessMode() {
      return this.config.cookieless_mode === ae || this.config.cookieless_mode === oe && this.consent.isRejected();
    }
    get decideEndpointWasHit() {
      var e2, t2;
      return null !== (e2 = null == (t2 = this.featureFlags) ? void 0 : t2.hasLoadedFlags) && void 0 !== e2 && e2;
    }
    get flagsEndpointWasHit() {
      var e2, t2;
      return null !== (e2 = null == (t2 = this.featureFlags) ? void 0 : t2.hasLoadedFlags) && void 0 !== e2 && e2;
    }
    constructor() {
      var e2;
      this.webPerformance = new Fa(), this._personProcessingSetOncePropertiesSent = false, this.version = n.LIB_VERSION, this._internalEventEmitter = new Ko(), this._extensions = [], this._calculate_event_properties = this.calculateEventProperties.bind(this), this.config = Ia(), this.SentryIntegration = Ks, this.sentryIntegration = (e3) => (function(e4, t3) {
        var i2 = Qs(e4, t3);
        return { name: Gs, processEvent: (e5) => i2(e5) };
      })(this, e3), this.__request_queue = [], this.__loaded = false, this.analyticsDefaultEndpoint = "/e/", this._initialPageviewCaptured = false, this._visibilityStateListener = null, this._initialPersonProfilesConfig = null, this._cachedPersonProperties = null, this.scrollManager = new Wo(this), this.pageViewManager = new Ys(this), this.rateLimiter = new Hn(this), this.requestRouter = new la(this), this.consent = new es(this), this.externalIntegrations = new fa(this);
      var t2 = null !== (e2 = _Ra.__defaultExtensionClasses) && void 0 !== e2 ? e2 : {};
      this.featureFlags = t2.featureFlags && new t2.featureFlags(this), this.toolbar = t2.toolbar && new t2.toolbar(this), this.surveys = t2.surveys && new t2.surveys(this), this.conversations = t2.conversations && new t2.conversations(this), this.logs = t2.logs && new t2.logs(this), this.metrics = t2.metrics && new t2.metrics(this), this.experiments = t2.experiments && new t2.experiments(this), this.exceptions = t2.exceptions && new t2.exceptions(this), this.people = { set: (e3, t3, i2) => {
        var r2 = st(e3) ? { [e3]: t3 } : e3;
        this.setPersonProperties(r2), null == i2 || i2({});
      }, set_once: (e3, t3, i2) => {
        var r2 = st(e3) ? { [e3]: t3 } : e3;
        this.setPersonProperties(void 0, r2), null == i2 || i2({});
      } }, this.on("eventCaptured", ((e3) => xr.info('send "' + (null == e3 ? void 0 : e3.event) + '"', e3)));
    }
    init(e2, t2, i2) {
      if (i2 && i2 !== ka) {
        var r2, s2 = null !== (r2 = ma[i2]) && void 0 !== r2 ? r2 : new _Ra();
        return s2._init(e2, t2, i2), ma[i2] = s2, ma[ka][i2] = s2, s2;
      }
      return this._init(e2, t2, i2);
    }
    _init(e2, t2, r2) {
      var s2, o2;
      void 0 === t2 && (t2 = {});
      var a2 = st(e2) ? e2.trim() : "";
      if (!a2) return xr.critical("PostHog was initialized without a token. This likely indicates a misconfiguration. Please check the first argument passed to posthog.init()"), this;
      if (this.__loaded) return console.warn("[PostHog.js]", "You have already initialized PostHog! Re-initializing is a no-op"), this;
      this.__loaded = true, this.config = Ia(t2.defaults), t2.debug = this._checkLocalStorageForDebug(t2.debug), this._originalUserConfig = t2, this._triggered_notifs = [], t2.person_profiles ? this._initialPersonProfilesConfig = t2.person_profiles : t2.process_person && (this._initialPersonProfilesConfig = t2.process_person);
      var u2 = Ia(t2.defaults), c2 = Ta(t2), d2 = Cr({}, u2, c2, { name: r2, token: a2 });
      tt(u2.rageclick) && tt(c2.rageclick) && (d2.rageclick = Cr({}, u2.rageclick, c2.rageclick)), tt(u2.session_recording) && tt(c2.session_recording) && (d2.session_recording = Cr({}, u2.session_recording, c2.session_recording)), this.set_config(d2), this.config.on_xhr_error && xr.error("on_xhr_error is deprecated. Use on_request_error instead"), this.compression = t2.disable_compression ? void 0 : Wn.GZipJS;
      var _2 = this._is_persistence_disabled();
      this.persistence = new Pn(this.config, _2), this.sessionPersistence = "sessionStorage" === this.config.persistence || "memory" === this.config.persistence ? this.persistence : new Pn(i({}, this.config, { persistence: "sessionStorage" }), _2, false);
      var h2 = i({}, this.persistence.props), p2 = i({}, this.sessionPersistence.props);
      this.register({ $initialization_time: (/* @__PURE__ */ new Date()).toISOString() }), this._requestQueue = new zo(((e3) => this._send_retriable_request(e3)), this.config.request_queue_config), this._retryQueue = new Vo(this), this.__request_queue = [];
      var g2 = this._inCookielessMode();
      if (g2 || (this.sessionManager = new Jo(this), this.sessionPropsManager = new Qo(this, this.sessionManager, this.persistence)), this.config.__preview_deferred_init_extensions ? (xr.info("Deferring extension initialization to improve startup performance"), setTimeout((() => {
        this._initExtensions(g2);
      }), 0)) : (xr.info("Initializing extensions synchronously"), this._initExtensions(g2)), n.DEBUG = n.DEBUG || this.config.debug, n.DEBUG && xr.info("Starting in debug mode", { this: this, config: t2, thisC: i({}, this.config), p: h2, s: p2 }), !this.config.identity_distinct_id || null != (s2 = t2.bootstrap) && s2.distinctID || (t2.bootstrap = i({}, t2.bootstrap, { distinctID: this.config.identity_distinct_id, isIdentifiedID: true })), void 0 !== (null == (o2 = t2.bootstrap) ? void 0 : o2.distinctID)) {
        var v2 = t2.bootstrap.distinctID, f2 = this.get_distinct_id(), m2 = this.persistence.get_property(G);
        if (t2.bootstrap.isIdentifiedID && null != f2 && f2 !== v2 && m2 === le) this.identify(v2);
        else if (t2.bootstrap.isIdentifiedID && null != f2 && f2 !== v2 && m2 === ue) xr.warn("Bootstrap distinctID differs from an already-identified user. The existing identity is preserved. Call reset() before reinitializing if you intend to switch users.");
        else {
          var y2 = this.config.get_device_id(Hr()), b2 = t2.bootstrap.isIdentifiedID ? y2 : v2;
          this.persistence.set_property(G, t2.bootstrap.isIdentifiedID ? ue : le), this.register({ distinct_id: v2, $device_id: b2 });
        }
      }
      if (g2) this.register_once({ distinct_id: te, $device_id: null }, "");
      else if (!this.get_distinct_id()) {
        var w2 = this.config.get_device_id(Hr());
        this.register_once({ distinct_id: w2, $device_id: w2 }, ""), this.persistence.set_property(G, le);
      }
      return Or(fe, "onpagehide" in self ? "pagehide" : "unload", this._handle_unload.bind(this), { passive: false }), t2.segment ? (function(e3, t3) {
        var i2 = e3.config.segment;
        if (!i2) return t3();
        !(function(e4, t4) {
          var i3 = e4.config.segment;
          if (!i3) return t4();
          var r3 = (i4) => {
            var r4 = () => i4.anonymousId() || Hr();
            e4.config.get_device_id = r4, i4.id() && (e4.register({ distinct_id: i4.id(), $device_id: r4() }), e4.persistence.set_property(G, ue)), t4();
          }, s3 = i3.user();
          "then" in s3 && et(s3.then) ? s3.then(r3) : r3(s3);
        })(e3, (() => {
          i2.register(((e4) => {
            "undefined" != typeof Promise && Promise.resolve || Ws.warn("This browser does not have Promise support, and can not use the segment integration");
            var t4 = (t5, i3) => {
              if (!i3) return t5;
              t5.event.userId || t5.event.anonymousId === e4.get_distinct_id() || (Ws.info("No userId set, resetting PostHog"), e4.reset()), t5.event.userId && t5.event.userId !== e4.get_distinct_id() && (Ws.info("UserId set, identifying with PostHog"), e4.identify(t5.event.userId));
              var r3 = e4.calculateEventProperties(i3, t5.event.properties);
              return t5.event.properties = Object.assign({}, r3, t5.event.properties), t5;
            };
            return { name: "PostHog JS", type: "enrichment", version: "1.0.0", isLoaded: () => true, load: () => Promise.resolve(), track: (e5) => t4(e5, e5.event.event), page: (e5) => t4(e5, he), identify: (e5) => t4(e5, ge), screen: (e5) => t4(e5, "$screen") };
          })(e3)).then((() => {
            t3();
          }));
        }));
      })(this, (() => this._loaded())) : this._loaded(), et(this.config._onCapture) && this.config._onCapture !== ba && (xr.warn("onCapture is deprecated. Please use `before_send` instead"), this.on("eventCaptured", ((e3) => this.config._onCapture(e3.event, e3)))), this.config.ip && xr.warn('The `ip` config option has NO EFFECT AT ALL and has been deprecated. Use a custom transformation or "Discard IP data" project setting instead. See https://posthog.com/tutorials/web-redact-properties#hiding-customer-ip-address for more information.'), this.config.disableDeviceModel || (function() {
        return Xo.apply(this, arguments);
      })().then(((e3) => {
        e3 && this.register({ [l]: e3 });
      })).catch(ba), this;
    }
    _initExtensions(e2) {
      var t2, r2, s2, n2, o2, a2, l2, u2, c2 = performance.now(), d2 = i({}, _Ra.__defaultExtensionClasses, this.config.__extensionClasses), _2 = [];
      d2.featureFlags && this._extensions.push(this.featureFlags = null !== (t2 = this.featureFlags) && void 0 !== t2 ? t2 : new d2.featureFlags(this)), d2.exceptions && this._extensions.push(this.exceptions = null !== (r2 = this.exceptions) && void 0 !== r2 ? r2 : new d2.exceptions(this)), d2.historyAutocapture && this._extensions.push(this.historyAutocapture = new d2.historyAutocapture(this)), d2.tracingHeaders && this._extensions.push(this.tracingHeaders = new d2.tracingHeaders(this)), d2.siteApps && this._extensions.push(this.siteApps = new d2.siteApps(this)), d2.sessionRecording && !e2 && this._extensions.push(this.sessionRecording = new d2.sessionRecording(this)), this.config.disable_scroll_properties || _2.push((() => {
        this.scrollManager.startMeasuringScrollPosition();
      })), d2.autocapture && this._extensions.push(this.autocapture = new d2.autocapture(this)), d2.surveys && this._extensions.push(this.surveys = null !== (s2 = this.surveys) && void 0 !== s2 ? s2 : new d2.surveys(this)), d2.logs && this._extensions.push(this.logs = null !== (n2 = this.logs) && void 0 !== n2 ? n2 : new d2.logs(this)), d2.metrics && this._extensions.push(this.metrics = null !== (o2 = this.metrics) && void 0 !== o2 ? o2 : new d2.metrics(this)), d2.conversations && this._extensions.push(this.conversations = null !== (a2 = this.conversations) && void 0 !== a2 ? a2 : new d2.conversations(this)), d2.productTours && this._extensions.push(this.productTours = new d2.productTours(this)), d2.heatmaps && this._extensions.push(this.heatmaps = new d2.heatmaps(this)), d2.webVitalsAutocapture && this._extensions.push(this.webVitalsAutocapture = new d2.webVitalsAutocapture(this)), d2.exceptionObserver && this._extensions.push(this.exceptionObserver = new d2.exceptionObserver(this)), d2.deadClicksAutocapture && this._extensions.push(this.deadClicksAutocapture = new d2.deadClicksAutocapture(this, js)), d2.toolbar && this._extensions.push(this.toolbar = null !== (l2 = this.toolbar) && void 0 !== l2 ? l2 : new d2.toolbar(this)), d2.experiments && this._extensions.push(this.experiments = null !== (u2 = this.experiments) && void 0 !== u2 ? u2 : new d2.experiments(this)), this._extensions.forEach(((e3) => {
        e3.initialize && _2.push((() => {
          null == e3.initialize || e3.initialize();
        }));
      })), _2.push((() => {
        if (this._pendingRemoteConfig) {
          var e3 = this._pendingRemoteConfig;
          this._pendingRemoteConfig = void 0, this._onRemoteConfig(e3);
        }
      })), this._processInitTaskQueue(_2, c2);
    }
    _processInitTaskQueue(e2, t2) {
      for (; e2.length > 0; ) {
        if (this.config.__preview_deferred_init_extensions && performance.now() - t2 >= 30 && e2.length > 0) return void setTimeout((() => {
          this._processInitTaskQueue(e2, t2);
        }), 0);
        var i2 = e2.shift();
        if (i2) try {
          i2();
        } catch (e3) {
          xr.error("Error initializing extension:", e3);
        }
      }
      var r2 = Math.round(performance.now() - t2);
      this.register_for_session({ [ie]: this.config.__preview_deferred_init_extensions ? "deferred" : "synchronous", [re]: r2 }), this.config.__preview_deferred_init_extensions && xr.info("PostHog extensions initialized (" + r2 + "ms)");
    }
    _onRemoteConfig(e2) {
      var t2;
      if (!be || !be.body) return xr.info("document not ready yet, trying again in 500 milliseconds..."), void setTimeout((() => {
        this._onRemoteConfig(e2);
      }), 500);
      this.config.__preview_deferred_init_extensions && (this._pendingRemoteConfig = e2);
      var i2 = e2.ok ? e2.config : { supportedCompression: [], toolbarParams: {}, toolbarVersion: "toolbar", isAuthenticated: false, siteApps: [] };
      this._lastRemoteConfig = i2, this.compression = void 0, i2.supportedCompression && !this.config.disable_compression && (this.compression = We(i2.supportedCompression, Wn.GZipJS) ? Wn.GZipJS : We(i2.supportedCompression, Wn.Base64) ? Wn.Base64 : void 0), null != (t2 = i2.analytics) && t2.endpoint && (this.analyticsDefaultEndpoint = i2.analytics.endpoint), this.set_config({ person_profiles: this._initialPersonProfilesConfig ? this._initialPersonProfilesConfig : ce }), this._extensions.forEach(((t3) => {
        !e2.ok && t3.onRemoteConfigFailed ? t3.onRemoteConfigFailed() : null == t3.onRemoteConfig || t3.onRemoteConfig(i2);
      }));
    }
    _loaded() {
      try {
        this.config.loaded(this);
      } catch (e3) {
        xr.critical("`loaded` function failed", e3);
      }
      if (this._start_queue_if_opted_in(), this.config.internal_or_test_user_hostname && null != we && we.hostname) {
        var e2 = we.hostname, t2 = this.config.internal_or_test_user_hostname;
        ("string" == typeof t2 ? e2 === t2 : t2.test(e2)) && this.setInternalOrTestUser();
      }
      this.config.capture_pageview && setTimeout((() => {
        (this.consent.isOptedIn() || this._inCookielessMode()) && this._captureInitialPageview();
      }), 1), this._remoteConfigLoader = new jn(this), this._remoteConfigLoader.load();
    }
    _start_queue_if_opted_in() {
      var e2;
      this.is_capturing() && this.config.request_batching && (null == (e2 = this._requestQueue) || e2.enable());
    }
    _dom_loaded() {
      this.is_capturing() && Pr(this.__request_queue, ((e2) => this._send_retriable_request(e2))), this.__request_queue = [], this._start_queue_if_opted_in();
    }
    _handle_unload() {
      var e2, t2, i2, r2, s2;
      null == (e2 = this.surveys) || null == e2.handlePageUnload || e2.handlePageUnload(), null == (t2 = this.metrics) || t2.flush("sendBeacon"), this.config.request_batching ? (this._shouldCapturePageleave() && this.capture(pe), null == (i2 = this.logs) || i2.flushLogs("sendBeacon"), null == (r2 = this._requestQueue) || r2.unload(), null == (s2 = this._retryQueue) || s2.unload()) : this._shouldCapturePageleave() && this.capture(pe, null, { transport: "sendBeacon" });
    }
    _send_request(e2) {
      this.__loaded ? Pa ? this.__request_queue.push(e2) : this.rateLimiter.isServerRateLimited(e2.batchKey) ? e2.fireCallbackOnDrop && (null == e2.callback || e2.callback({ statusCode: 429 })) : (e2.transport = e2.transport || this.config.api_transport, e2.headers = i({}, this.config.request_headers, e2.headers), e2.compression = "best-available" === e2.compression ? this.compression : e2.compression, (rt(this.config.disable_beacon) ? this.config.__preview_disable_beacon : this.config.disable_beacon) && (e2.disableTransport = ["sendBeacon"]), e2.fetchOptions = e2.fetchOptions || this.config.fetch_options, ((e3) => {
        var t2, r2, s2, n2 = i({}, e3);
        n2.timeout = n2.timeout || 6e4;
        var o2 = null !== (t2 = n2.transport) && void 0 !== t2 ? t2 : "fetch";
        "sendBeacon" === o2 && rt(n2.compression) && n2.data && (n2.compression = Wn.Base64), n2.url = Uo(n2.url, n2.compression);
        var a2 = qo.filter(((e4) => !n2.disableTransport || !e4.transport || !n2.disableTransport.includes(e4.transport))), l2 = null !== (r2 = null == (s2 = (function(e4, t3) {
          for (var i2 = 0; e4.length > i2; i2++) if (e4[i2].transport === o2) return e4[i2];
        })(a2)) ? void 0 : s2.method) && void 0 !== r2 ? r2 : a2[0].method;
        if (!l2) throw new Error("No available transport method");
        "sendBeacon" !== o2 && n2.data && n2.compression === Wn.GZipJS && ke && "undefined" != typeof Promise && !Co ? Oo(n2).then(((e4) => {
          l2(e4);
        })).catch(((t3) => {
          if (Ue(t3)) return Co = true, void l2(i({}, n2, { compression: void 0, url: Uo(e3.url, void 0) }));
          ((e4) => {
            if (!e4 || "object" != typeof e4) return false;
            var t4 = "name" in e4 ? String(e4.name) : "";
            return Ue(e4) || t4 === De;
          })(t3) && (Co = true), l2(n2);
        })) : l2(n2);
      })(i({}, e2, { callback: (t2) => {
        var i2, r2;
        this.rateLimiter.checkForLimiting(t2), 400 > t2.statusCode || null == (i2 = (r2 = this.config).on_request_error) || i2.call(r2, t2), null == e2.callback || e2.callback(t2);
      } }))) : e2.fireCallbackOnDrop && (null == e2.callback || e2.callback({ statusCode: 0 }));
    }
    _send_retriable_request(e2) {
      this._retryQueue ? this._retryQueue.retriableRequest(e2) : this._send_request(e2);
    }
    _execute_array(e2) {
      ya++;
      try {
        var t2, i2 = [], r2 = [], s2 = [];
        Pr(e2, ((e3) => {
          if (e3) if (Xe(t2 = e3[0])) s2.push(e3);
          else if (et(e3)) try {
            e3.call(this);
          } catch (t3) {
            xr.error("Error executing queued PostHog call", e3, t3);
          }
          else Xe(e3) && "alias" === t2 ? i2.push(e3) : Xe(e3) && -1 !== t2.indexOf("capture") && et(this[t2]) ? s2.push(e3) : r2.push(e3);
        }));
        var n2 = function(e3, t3) {
          Pr(e3, (function(e4) {
            try {
              if (Xe(e4[0])) {
                var i3 = t3;
                Ir(e4, (function(e5) {
                  i3 = i3[e5[0]].apply(i3, e5.slice(1));
                }));
              } else t3[e4[0]].apply(t3, e4.slice(1));
            } catch (t4) {
              xr.error("Error executing queued PostHog call", e4, t4);
            }
          }));
        };
        n2(i2, this), n2(r2, this), n2(s2, this);
      } finally {
        ya--;
      }
    }
    push(e2) {
      if (ya > 0 && Xe(e2) && st(e2[0])) {
        var t2 = _Ra.prototype[e2[0]];
        et(t2) && t2.apply(this, e2.slice(1));
      } else this._execute_array([e2]);
    }
    capture(e2, t2, r2) {
      var s2, n2, o2, a2, l2;
      if (this.__loaded && this.persistence && this.sessionPersistence && this._requestQueue) {
        if (this.is_capturing()) if (!rt(e2) && st(e2)) {
          var u2 = !this.config.opt_out_useragent_filter && this._is_bot();
          if (!u2 || this.config.__preview_capture_bot_pageviews) {
            var c2 = null != r2 && r2.skip_client_rate_limiting ? void 0 : this.rateLimiter.clientRateLimitContext();
            if (null == c2 || !c2.isRateLimited) {
              null != t2 && t2.$current_url && !st(null == t2 ? void 0 : t2.$current_url) && (xr.error("Invalid `$current_url` property provided to `posthog.capture`. Input must be a string. Ignoring provided value."), null == t2 || delete t2.$current_url), "$exception" !== e2 || null != r2 && r2._originatedFromCaptureException || xr.warn("Using `posthog.capture('$exception')` is unreliable because it does not attach required metadata. Use `posthog.captureException(error)` instead, which attaches required metadata automatically."), this.sessionPersistence.update_search_keyword(), this.config.save_campaign_params && this.sessionPersistence.update_campaign_params(), this.config.save_referrer && this.sessionPersistence.update_referrer_info(), (this.config.save_campaign_params || this.config.save_referrer) && this.persistence.set_initial_person_info();
              var d2 = /* @__PURE__ */ new Date(), _2 = (null == r2 ? void 0 : r2.timestamp) || d2, h2 = Ii(null == r2 ? void 0 : r2.uuid, Hr), p2 = { uuid: h2, event: e2, properties: this.calculateEventProperties(e2, t2 || {}, _2, h2) };
              e2 === he && this.config.__preview_capture_bot_pageviews && u2 && (p2.event = "$bot_pageview", p2.properties.$browser_type = "bot"), c2 && (p2.properties.$lib_rate_limit_remaining_tokens = c2.remainingTokens), (null == r2 ? void 0 : r2.$set) && (p2.$set = null == r2 ? void 0 : r2.$set);
              var g2 = null == r2 ? void 0 : r2.$unset;
              g2 && (p2.$unset = g2);
              var v2, f2, m2, y2 = this._calculate_set_once_properties(null == r2 ? void 0 : r2.$set_once, e2 !== ve, e2 === ge);
              if (y2 && (p2.$set_once = y2), null != r2 && r2._noTruncate || (n2 = this.config.properties_string_max_length, o2 = p2, a2 = (e3) => st(e3) ? e3.slice(0, n2) : e3, l2 = /* @__PURE__ */ new Set(), p2 = (function e3(t3, i2) {
                if (t3 !== Object(t3)) return a2 ? a2(t3) : t3;
                if (!l2.has(t3)) {
                  var r3;
                  if (l2.add(t3), Xe(t3)) r3 = [], Pr(t3, ((t4) => {
                    r3.push(e3(t4));
                  }));
                  else {
                    var s3 = {};
                    Ir(t3, ((t4, i3) => {
                      l2.has(t4) || (s3[i3] = e3(t4, i3));
                    })), r3 = s3;
                  }
                  return r3;
                }
              })(o2)), p2.timestamp = _2, rt(null == r2 ? void 0 : r2.timestamp) || (p2.properties.$event_time_override_provided = true, p2.properties.$event_time_override_system_time = d2), e2 === On.DISMISSED || e2 === On.SENT) {
                var b2 = null == t2 ? void 0 : t2[$n.SURVEY_ID], w2 = null == t2 ? void 0 : t2[$n.SURVEY_ITERATION];
                _a({ id: b2, current_iteration: w2 }), p2.$set = i({}, p2.$set, { [(v2 = { id: b2, current_iteration: w2 }, f2 = e2 === On.SENT ? "responded" : "dismissed", m2 = "$survey_" + f2 + "/" + v2.id, v2.current_iteration && v2.current_iteration > 0 && (m2 = "$survey_" + f2 + "/" + v2.id + "/" + v2.current_iteration), m2)]: true });
              } else e2 === On.SHOWN && (p2.$set = i({}, p2.$set, { [$n.SURVEY_LAST_SEEN_DATE]: (/* @__PURE__ */ new Date()).toISOString() }));
              if (e2 === Bn.SHOWN) {
                var S2 = null == t2 ? void 0 : t2[Un.TOUR_TYPE];
                S2 && (p2.$set = i({}, p2.$set, { [Un.TOUR_LAST_SEEN_DATE + "/" + S2]: (/* @__PURE__ */ new Date()).toISOString() }));
              }
              var E2 = i({}, p2.properties.$set, p2.$set);
              if (it(E2) || this.setPersonPropertiesForFlags(E2), !at(this.config.before_send)) {
                var x2 = this._runBeforeSend(p2);
                if (!x2) return;
                (p2 = x2).uuid = Ii(p2.uuid, Hr);
              }
              this._internalEventEmitter.emit("eventCaptured", p2);
              var k2 = { method: "POST", url: null !== (s2 = null == r2 ? void 0 : r2._url) && void 0 !== s2 ? s2 : this.requestRouter.endpointFor("api", this.analyticsDefaultEndpoint), data: p2, compression: "best-available", batchKey: null == r2 ? void 0 : r2._batchKey, transport: null == r2 ? void 0 : r2.transport };
              return !this.config.request_batching || r2 && (null == r2 || !r2._batchKey) || null != r2 && r2.send_instantly ? this._send_retriable_request(k2) : this._requestQueue.enqueue(k2), p2;
            }
            xr.critical("This capture call is ignored due to client rate limiting.");
          }
        } else xr.error("No event name provided to posthog.capture");
      } else xr.uninitializedWarning("posthog.capture");
    }
    _addCaptureHook(e2) {
      return this.on("eventCaptured", ((t2) => e2(t2.event, t2)));
    }
    calculateEventProperties(e2, t2, r2, s2, o2) {
      if (r2 = r2 || /* @__PURE__ */ new Date(), !this.persistence || !this.sessionPersistence) return t2;
      var a2 = o2 ? void 0 : this.persistence.remove_event_timer(e2), l2 = i({}, t2);
      if (l2.token = this.config.token, l2.$config_defaults = this.config.defaults, this._inCookielessMode() && (l2.$cookieless_mode = true), "$snapshot" === e2) {
        var u2 = i({}, this.persistence.properties(), this.sessionPersistence.properties());
        return l2.distinct_id = u2.distinct_id, (!st(l2.distinct_id) && !lt(l2.distinct_id) || nt(l2.distinct_id)) && xr.error("Invalid distinct_id for replay event. This indicates a bug in your implementation"), l2;
      }
      var c2, d2 = (function(e3, t3, i2, r3) {
        var s3, o3, a3, l3;
        if (void 0 === r3 && (r3 = false), !Pe) return {};
        var u3, c3, d3, _3, h3, p3, g3, v3, f3, m2 = e3 ? [...un, ...t3 || []] : [], y2 = (function(e4) {
          for (var t4 = 0; xi.length > t4; t4++) {
            var i3 = xi[t4], r4 = i3[1], s4 = i3[0].exec(e4), n2 = s4 && (et(r4) ? r4(s4, e4) : r4);
            if (n2) return n2;
          }
          return ["", ""];
        })(Pe), b2 = null != (u3 = "undefined" != typeof navigator ? navigator : void 0) && u3.brave ? { brave: true } : {}, w2 = { detectGoogleSearchApp: i2 }, S2 = Cr(Lr({ $os: y2[0], $os_version: y2[1], $browser: wi(Pe, navigator.vendor, b2, w2), $device: ki(Pe), $device_type: (d3 = Pe, _3 = { userAgentDataPlatform: null == (s3 = navigator) || null == (s3 = s3.userAgentData) ? void 0 : s3.platform, maxTouchPoints: null == (o3 = navigator) ? void 0 : o3.maxTouchPoints, screenWidth: null == fe || null == (a3 = fe.screen) ? void 0 : a3.width, screenHeight: null == fe || null == (l3 = fe.screen) ? void 0 : l3.height, devicePixelRatio: null == fe ? void 0 : fe.devicePixelRatio }, f3 = ki(d3), f3 === It || f3 === Pt || "Kobo" === f3 || "Kindle Fire" === f3 || f3 === ri ? kt : f3 === Wt || f3 === Qt || f3 === Gt || f3 === ei ? "Console" : f3 === Tt ? "Wearable" : f3 ? St : "Android" === (null == _3 ? void 0 : _3.userAgentDataPlatform) && (null !== (h3 = null == _3 ? void 0 : _3.maxTouchPoints) && void 0 !== h3 ? h3 : 0) > 0 ? 600 > Math.min(null !== (p3 = null == _3 ? void 0 : _3.screenWidth) && void 0 !== p3 ? p3 : 0, null !== (g3 = null == _3 ? void 0 : _3.screenHeight) && void 0 !== g3 ? g3 : 0) / (null !== (v3 = null == _3 ? void 0 : _3.devicePixelRatio) && void 0 !== v3 ? v3 : 1) ? St : kt : "Desktop"), $timezone: wn(), $timezone_offset: Sn() }), { $current_url: sn(r3 ? Ci(null == we ? void 0 : we.href) : null == we ? void 0 : we.href, m2, dn), $host: null == we ? void 0 : we.host, $pathname: null == we ? void 0 : we.pathname, $raw_user_agent: Pe.length > 1e3 ? Pe.substring(0, 997) + "..." : Pe, $browser_version: Ei(Pe, navigator.vendor, b2, w2), $browser_language: vn(), $browser_language_prefix: (c3 = vn(), "string" == typeof c3 ? c3.split("-")[0] : void 0), $screen_height: null == fe ? void 0 : fe.screen.height, $screen_width: null == fe ? void 0 : fe.screen.width, $viewport_height: null == fe ? void 0 : fe.innerHeight, $viewport_width: null == fe ? void 0 : fe.innerWidth, $lib: n.LIB_NAME, $lib_version: n.LIB_VERSION, $insert_id: Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10), $time: Date.now() / 1e3 });
        return n.SDK_DIST_CHANNEL && (S2.$sdk_dist_channel = n.SDK_DIST_CHANNEL), S2;
      })(this.config.mask_personal_data_properties, this.config.custom_personal_data_properties, this.config.detect_google_search_app, this.config.disable_capture_url_hashes);
      if (this.sessionManager) {
        var _2 = this.sessionManager.checkAndGetSessionAndWindowId(o2, r2.getTime()), h2 = _2.windowId;
        l2.$session_id = _2.sessionId, l2.$window_id = h2;
      }
      this.sessionPropsManager && Cr(l2, this.sessionPropsManager.getSessionProps());
      try {
        var p2;
        this.sessionRecording && Cr(l2, this.sessionRecording.sdkDebugProperties), l2.$sdk_debug_retry_queue_size = null == (p2 = this._retryQueue) ? void 0 : p2.length;
      } catch (e3) {
        l2.$sdk_debug_error_capturing_properties = String(e3);
      }
      if (this.requestRouter.region === na && (l2.$lib_custom_api_host = this.config.api_host), c2 = e2 !== he || o2 ? e2 !== pe || o2 ? this.pageViewManager.doEvent() : this.pageViewManager.doPageLeave(r2) : this.pageViewManager.doPageView(r2, s2), l2 = Cr(l2, c2), e2 === he && be && (l2.title = be.title), !rt(a2)) {
        var g2 = r2.getTime() - a2;
        l2.$duration = parseFloat((g2 / 1e3).toFixed(3));
      }
      Pe && this.config.opt_out_useragent_filter && (l2.$browser_type = this._is_bot() ? "bot" : "browser"), (l2 = Cr({}, d2, this.persistence.properties(), this.sessionPersistence.properties(), l2)).$is_identified = this._isIdentified(), Xe(this.config.property_denylist) ? Ir(this.config.property_denylist, (function(e3) {
        delete l2[e3];
      })) : xr.error(xa + this.config.property_denylist + " or property_blacklist config: " + this.config.property_blacklist);
      var v2 = this.config.sanitize_properties;
      v2 && (xr.error(Ea), l2 = v2(l2, e2));
      var f2 = this._hasPersonProcessing();
      return l2.$process_person_profile = f2, f2 && !o2 && this._requirePersonProcessing("_calculate_event_properties"), l2;
    }
    _calculate_set_once_properties(e2, t2, i2) {
      var r2;
      if (void 0 === t2 && (t2 = true), void 0 === i2 && (i2 = false), !this.persistence || !this._hasPersonProcessing()) return e2;
      if (this._personProcessingSetOncePropertiesSent && !i2) return e2;
      var s2 = this.persistence.get_initial_props(), n2 = null == (r2 = this.sessionPropsManager) ? void 0 : r2.getSetOnceProps(), o2 = Cr({}, s2, n2 || {}, e2 || {}), a2 = this.config.sanitize_properties;
      return a2 && (xr.error(Ea), o2 = a2(o2, "$set_once")), t2 && (this._personProcessingSetOncePropertiesSent = true), it(o2) ? void 0 : o2;
    }
    register(e2, t2) {
      var i2;
      null == (i2 = this.persistence) || i2.register(e2, t2);
    }
    register_once(e2, t2, i2) {
      var r2;
      null == (r2 = this.persistence) || r2.register_once(e2, t2, i2);
    }
    register_for_session(e2) {
      var t2;
      null == (t2 = this.sessionPersistence) || t2.register(e2);
    }
    unregister(e2) {
      var t2;
      null == (t2 = this.persistence) || t2.unregister(e2);
    }
    unregister_for_session(e2) {
      var t2;
      null == (t2 = this.sessionPersistence) || t2.unregister(e2);
    }
    _register_single(e2, t2) {
      this.register({ [e2]: t2 });
    }
    getFeatureFlag(e2, t2) {
      var i2;
      return null == (i2 = this.featureFlags) ? void 0 : i2.getFeatureFlag(e2, t2);
    }
    getFeatureFlagPayload(e2) {
      var t2;
      return null == (t2 = this.featureFlags) ? void 0 : t2.getFeatureFlagPayload(e2);
    }
    getFeatureFlagResult(e2, t2) {
      var i2;
      return null == (i2 = this.featureFlags) ? void 0 : i2.getFeatureFlagResult(e2, t2);
    }
    getAllFeatureFlags() {
      var e2, t2;
      return null !== (e2 = null == (t2 = this.featureFlags) ? void 0 : t2.getAllFeatureFlags()) && void 0 !== e2 ? e2 : [];
    }
    isFeatureEnabled(e2, t2) {
      var i2;
      return null == (i2 = this.featureFlags) ? void 0 : i2.isFeatureEnabled(e2, t2);
    }
    reloadFeatureFlags() {
      var e2;
      null == (e2 = this.featureFlags) || e2.reloadFeatureFlags();
    }
    updateFlags(e2, t2, i2) {
      var r2;
      null == (r2 = this.featureFlags) || r2.updateFlags(e2, t2, i2);
    }
    updateEarlyAccessFeatureEnrollment(e2, t2, i2) {
      var r2;
      null == (r2 = this.featureFlags) || r2.updateEarlyAccessFeatureEnrollment(e2, t2, i2);
    }
    getEarlyAccessFeatures(e2, t2, i2) {
      var r2;
      return void 0 === t2 && (t2 = false), null == (r2 = this.featureFlags) ? void 0 : r2.getEarlyAccessFeatures(e2, t2, i2);
    }
    on(e2, t2) {
      return this._internalEventEmitter.on(e2, t2);
    }
    onFeatureFlags(e2) {
      return this.featureFlags ? this.featureFlags.onFeatureFlags(e2) : (e2([], {}, { errorsLoading: true }), () => {
      });
    }
    onSurveysLoaded(e2) {
      return this.surveys ? this.surveys.onSurveysLoaded(e2) : (e2([], { isLoaded: false, error: Sa }), () => {
      });
    }
    onSessionId(e2) {
      var t2, i2;
      return null !== (t2 = null == (i2 = this.sessionManager) ? void 0 : i2.onSessionId(e2)) && void 0 !== t2 ? t2 : () => {
      };
    }
    getSurveys(e2, t2) {
      void 0 === t2 && (t2 = false), this.surveys ? this.surveys.getSurveys(e2, t2) : e2([], { isLoaded: false, error: Sa });
    }
    getActiveMatchingSurveys(e2, t2) {
      void 0 === t2 && (t2 = false), this.surveys ? this.surveys.getActiveMatchingSurveys(e2, t2) : e2([], { isLoaded: false, error: Sa });
    }
    renderSurvey(e2, t2) {
      var i2;
      null == (i2 = this.surveys) || i2.renderSurvey(e2, t2);
    }
    displaySurvey(e2, t2) {
      var i2;
      void 0 === t2 && (t2 = pa), null == (i2 = this.surveys) || i2.displaySurvey(e2, t2);
    }
    cancelPendingSurvey(e2) {
      var t2;
      null == (t2 = this.surveys) || t2.cancelPendingSurvey(e2);
    }
    canRenderSurvey(e2) {
      var t2, i2;
      return null !== (t2 = null == (i2 = this.surveys) ? void 0 : i2.canRenderSurvey(e2)) && void 0 !== t2 ? t2 : { visible: false, disabledReason: Sa };
    }
    canRenderSurveyAsync(e2, t2) {
      var i2, r2;
      return void 0 === t2 && (t2 = false), null !== (i2 = null == (r2 = this.surveys) ? void 0 : r2.canRenderSurveyAsync(e2, t2)) && void 0 !== i2 ? i2 : Promise.resolve({ visible: false, disabledReason: Sa });
    }
    _validateIdentifyId(e2) {
      return !e2 || nt(e2) ? (xr.critical("Unique user id has not been set in posthog.identify"), false) : e2 === te ? (xr.critical('The string "' + e2 + '" was set in posthog.identify which indicates an error. This ID is only used as a sentinel value.'), false) : !["distinct_id", "distinctid"].includes(e2.toLowerCase()) && !["undefined", "null"].includes(e2.toLowerCase()) || (xr.critical('The string "' + e2 + '" was set in posthog.identify which indicates an error. This ID should be unique to the user and not a hardcoded string.'), false);
    }
    identify(e2, t2, i2) {
      if (!this.__loaded || !this.persistence) return xr.uninitializedWarning("posthog.identify");
      if (lt(e2) && (e2 = e2.toString(), xr.warn("The first argument to posthog.identify was a number, but it should be a string. It has been converted to a string.")), this._validateIdentifyId(e2) && this._requirePersonProcessing("posthog.identify")) {
        var r2 = this.get_distinct_id();
        this.register({ $user_id: e2 }), this.get_property(a) || this.register_once({ $had_persisted_distinct_id: true, $device_id: r2 }, ""), e2 !== r2 && e2 !== this.get_property(u) && (this.unregister(u), this.register({ distinct_id: e2 }));
        var s2, n2 = (this.persistence.get_property(G) || le) === le;
        e2 !== r2 && n2 ? (this.persistence.set_property(G, ue), this.setPersonPropertiesForFlags({ $set: t2 || {}, $set_once: i2 || {} }, false), this.capture(ge, { distinct_id: e2, $anon_distinct_id: r2 }, { $set: t2 || {}, $set_once: i2 || {} }), this._cachedPersonProperties = ta(e2, t2, i2), null == (s2 = this.featureFlags) || s2.setAnonymousDistinctId(r2)) : (t2 || i2) && this.setPersonProperties(t2, i2), e2 !== r2 && (this.reloadFeatureFlags(), this.unregister(z));
      }
    }
    setPersonProperties(e2, t2) {
      if ((e2 || t2) && this._requirePersonProcessing("posthog.setPersonProperties")) {
        var i2 = ta(this.get_distinct_id(), e2, t2);
        this._cachedPersonProperties !== i2 ? (this.setPersonPropertiesForFlags({ $set: e2 || {}, $set_once: t2 || {} }, true), this.capture("$set", { $set: e2 || {}, $set_once: t2 || {} }), this._cachedPersonProperties = i2) : xr.info("A duplicate setPersonProperties call was made with the same properties. It has been ignored.");
      }
    }
    unsetPersonProperties(e2) {
      var t2, i2 = (Xe(e2) ? e2 : [e2]).filter(((e3) => st(e3) && e3.length > 0));
      0 !== i2.length && this._requirePersonProcessing("posthog.unsetPersonProperties") && (null == (t2 = this.featureFlags) || t2.unsetPersonPropertiesForFlags(i2, true), this.capture("$set", { $unset: i2 }), this._cachedPersonProperties = null);
    }
    group(e2, t2, r2) {
      if (e2 && t2) {
        var s2 = this.getGroups(), n2 = s2[e2] !== t2;
        if (n2 && this.resetGroupPropertiesForFlags(e2), this.register({ $groups: i({}, s2, { [e2]: t2 }) }), n2 || r2) {
          var o2 = { $group_type: e2, $group_key: t2 };
          r2 && (o2.$group_set = r2), this.capture(ve, o2);
        }
        r2 && this.setGroupPropertiesForFlags({ [e2]: r2 }), n2 && !r2 && this.reloadFeatureFlags();
      } else xr.error("posthog.group requires a group type and group key");
    }
    resetGroups() {
      this.register({ $groups: {} }), this.resetGroupPropertiesForFlags(), this.reloadFeatureFlags();
    }
    setPersonPropertiesForFlags(e2, t2) {
      var i2;
      void 0 === t2 && (t2 = true), null == (i2 = this.featureFlags) || i2.setPersonPropertiesForFlags(e2, t2);
    }
    resetPersonPropertiesForFlags(e2) {
      var t2;
      void 0 === e2 && (e2 = true), null == (t2 = this.featureFlags) || t2.resetPersonPropertiesForFlags(e2);
    }
    setGroupPropertiesForFlags(e2, t2) {
      var i2;
      void 0 === t2 && (t2 = true), this._requirePersonProcessing("posthog.setGroupPropertiesForFlags") && (null == (i2 = this.featureFlags) || i2.setGroupPropertiesForFlags(e2, t2));
    }
    resetGroupPropertiesForFlags(e2) {
      var t2;
      null == (t2 = this.featureFlags) || t2.resetGroupPropertiesForFlags(e2);
    }
    reset(e2) {
      var t2, i2, r2, s2, n2, o2, u2, c2, d2, _2;
      if (xr.info("reset"), !this.__loaded) return xr.uninitializedWarning("posthog.reset");
      var h2, p2 = this.get_property(a), g2 = this.get_property(l), v2 = this.get_property(b);
      if (this.consent.reset(), null == (t2 = this.persistence) || t2.clear(), null == (i2 = this.sessionPersistence) || i2.clear(), rt(v2) || null == (h2 = this.persistence) || h2.register({ [b]: v2 }), null == (r2 = this.surveys) || r2.reset(), null == (s2 = this._remoteConfigLoader) || s2.stop(), null == (n2 = this.featureFlags) || n2.reset(), null == (o2 = this.conversations) || o2.reset(), null == (u2 = this.logs) || u2.reset(), null == (c2 = this.metrics) || c2.reset(), null == (d2 = this.persistence) || d2.set_property(G, le), null == (_2 = this.sessionManager) || _2.resetSessionId(), this._cachedPersonProperties = null, this.config.cookieless_mode === ae) this.register_once({ distinct_id: te, $device_id: null }, "");
      else {
        var f2 = this.config.get_device_id(Hr());
        this.register_once({ distinct_id: f2, $device_id: e2 ? f2 : p2 }, ""), e2 || rt(g2) || this.register({ [l]: g2 });
      }
      this.register({ $last_posthog_reset: (/* @__PURE__ */ new Date()).toISOString() }, 1), delete this.config.identity_distinct_id, delete this.config.identity_hash, this.reloadFeatureFlags();
    }
    shutdown(e2) {
      var i2 = this;
      return t((function* () {
        var e3, t2, r2, s2, n2;
        i2.__loaded ? (null == (e3 = i2.logs) || e3.flushLogs("sendBeacon"), null == (t2 = i2.metrics) || t2.flush("sendBeacon"), null == (r2 = i2._requestQueue) || r2.unload(), null == (s2 = i2._retryQueue) || s2.unload(), null == (n2 = i2.featureFlags) || n2.destroy()) : xr.uninitializedWarning("posthog.shutdown");
      }))();
    }
    setIdentity(e2, t2) {
      var i2;
      this.config.identity_distinct_id = e2, this.config.identity_hash = t2, this.alias(e2), null == (i2 = this.conversations) || i2._onIdentityChanged();
    }
    clearIdentity() {
      var e2;
      delete this.config.identity_distinct_id, delete this.config.identity_hash, null == (e2 = this.conversations) || e2._onIdentityCleared();
    }
    get_distinct_id() {
      return this.get_property("distinct_id");
    }
    getGroups() {
      return this.get_property("$groups") || {};
    }
    get_session_id() {
      var e2, t2;
      return null !== (e2 = null == (t2 = this.sessionManager) ? void 0 : t2.checkAndGetSessionAndWindowId(true).sessionId) && void 0 !== e2 ? e2 : "";
    }
    get_session_replay_url(e2) {
      if (!this.sessionManager) return "";
      var t2 = this.sessionManager.checkAndGetSessionAndWindowId(true), i2 = t2.sessionStartTimestamp, r2 = this.requestRouter.endpointFor("ui", "/project/" + this.config.token + "/replay/" + t2.sessionId);
      if (null != e2 && e2.withTimestamp && i2) {
        var s2, n2 = null !== (s2 = e2.timestampLookBack) && void 0 !== s2 ? s2 : 10;
        if (!i2) return r2;
        r2 += "?t=" + Math.max(Math.floor(((/* @__PURE__ */ new Date()).getTime() - i2) / 1e3) - n2, 0);
      }
      return r2;
    }
    alias(e2, t2) {
      return e2 === this.get_property(o) ? (xr.critical("Attempting to create alias for existing People user - aborting."), -2) : this._requirePersonProcessing("posthog.alias") ? (rt(t2) && (t2 = this.get_distinct_id()), e2 !== t2 ? (this._register_single(u, e2), this.capture("$create_alias", { alias: e2, distinct_id: t2 })) : (xr.warn("alias matches current distinct_id - skipping api call."), this.identify(e2), -1)) : void 0;
    }
    set_config(e2) {
      var t2 = i({}, this.config);
      if (tt(e2)) {
        var r2, s2, o2, a2, l2, u2, c2, d2, _2, h2, p2;
        Cr(this.config, Ta(e2));
        var g2 = this._is_persistence_disabled();
        null == (r2 = this.persistence) || r2.update_config(this.config, t2, g2), this.sessionPersistence = "sessionStorage" === this.config.persistence || "memory" === this.config.persistence ? this.persistence : new Pn(i({}, this.config, { persistence: "sessionStorage" }), g2, false);
        var v2 = this._checkLocalStorageForDebug(this.config.debug);
        ct(v2) && (this.config.debug = v2), ct(this.config.debug) && (this.config.debug ? (n.DEBUG = true, Qr._is_supported() && Qr._set("ph_debug", true), xr.info("set_config", { config: e2, oldConfig: t2, newConfig: i({}, this.config) })) : (n.DEBUG = false, Qr._is_supported() && Qr._remove("ph_debug"))), null == (s2 = this.exceptionObserver) || s2.onConfigChange(), null == (o2 = this.exceptions) || o2.onConfigChange(), null == (a2 = this.sessionRecording) || a2.startIfEnabledOrStop(), null == (l2 = this.tracingHeaders) || l2.startIfEnabledOrStop(), null == (u2 = this.autocapture) || u2.startIfEnabled(), null == (c2 = this.heatmaps) || c2.startIfEnabled(), null == (d2 = this.exceptionObserver) || d2.startIfEnabledOrStop(), null == (_2 = this.deadClicksAutocapture) || _2.startIfEnabledOrStop(), null == (h2 = this.surveys) || h2.loadIfEnabled(), this._sync_opt_out_with_persistence(), null == (p2 = this.externalIntegrations) || p2.startIfEnabledOrStop();
      }
    }
    _overrideSDKInfo(e2, t2) {
      n.LIB_NAME = e2, n.LIB_VERSION = t2;
    }
    startSessionRecording(e2) {
      var t2, i2, r2, s2, n2, o2 = true === e2, a2 = { sampling: o2 || !(null == e2 || !e2.sampling), linked_flag: o2 || !(null == e2 || !e2.linked_flag), url_trigger: o2 || !(null == e2 || !e2.url_trigger), event_trigger: o2 || !(null == e2 || !e2.event_trigger) };
      Object.values(a2).some(Boolean) && (null == (t2 = this.sessionManager) || t2.checkAndGetSessionAndWindowId(), a2.sampling && (null == (i2 = this.sessionRecording) || i2.overrideSampling()), a2.linked_flag && (null == (r2 = this.sessionRecording) || r2.overrideLinkedFlag()), a2.url_trigger && (null == (s2 = this.sessionRecording) || s2.overrideTrigger("url")), a2.event_trigger && (null == (n2 = this.sessionRecording) || n2.overrideTrigger("event")));
      this.set_config({ disable_session_recording: false });
    }
    stopSessionRecording() {
      this.set_config({ disable_session_recording: true });
    }
    sessionRecordingStarted() {
      var e2;
      return !(null == (e2 = this.sessionRecording) || !e2.started);
    }
    captureException(e2, t2) {
      if (this.exceptions) {
        var r2 = new Error("PostHog syntheticException"), s2 = this.exceptions.buildProperties(e2, { handled: true, syntheticException: r2 });
        return this.exceptions.sendExceptionEvent(i({}, s2, t2));
      }
    }
    addExceptionStep(e2, t2) {
      var i2;
      null == (i2 = this.exceptions) || i2.addExceptionStep(e2, t2);
    }
    captureLog(e2) {
      var t2;
      null == (t2 = this.logs) || t2.captureLog(e2);
    }
    get logger() {
      var e2, t2;
      return null !== (e2 = null == (t2 = this.logs) ? void 0 : t2.logger) && void 0 !== e2 ? e2 : _Ra._noopLogger;
    }
    startExceptionAutocapture(e2) {
      this.set_config({ capture_exceptions: null == e2 || e2 });
    }
    stopExceptionAutocapture() {
      this.set_config({ capture_exceptions: false });
    }
    loadToolbar(e2) {
      var t2, i2;
      return null !== (t2 = null == (i2 = this.toolbar) ? void 0 : i2.loadToolbar(e2)) && void 0 !== t2 && t2;
    }
    get_property(e2) {
      var t2;
      return null == (t2 = this.persistence) ? void 0 : t2.props[e2];
    }
    getSessionProperty(e2) {
      var t2;
      return null == (t2 = this.sessionPersistence) ? void 0 : t2.props[e2];
    }
    toString() {
      var e2, t2 = null !== (e2 = this.config.name) && void 0 !== e2 ? e2 : ka;
      return t2 !== ka && (t2 = ka + "." + t2), t2;
    }
    _isIdentified() {
      var e2, t2;
      return (null == (e2 = this.persistence) ? void 0 : e2.get_property(G)) === ue || (null == (t2 = this.sessionPersistence) ? void 0 : t2.get_property(G)) === ue;
    }
    _hasPersonProcessing() {
      var e2, t2;
      return !("never" === this.config.person_profiles || this.config.person_profiles === ce && !this._isIdentified() && it(this.getGroups()) && (null == (e2 = this.persistence) || null == (e2 = e2.props) || !e2[u]) && (null == (t2 = this.persistence) || null == (t2 = t2.props) || !t2[X]));
    }
    _shouldCapturePageleave() {
      return true === this.config.capture_pageleave || "if_capture_pageview" === this.config.capture_pageleave && (true === this.config.capture_pageview || "history_change" === this.config.capture_pageview);
    }
    createPersonProfile() {
      this._hasPersonProcessing() || this._requirePersonProcessing("posthog.createPersonProfile") && this.setPersonProperties({}, {});
    }
    setInternalOrTestUser() {
      this._requirePersonProcessing("posthog.setInternalOrTestUser") && this.setPersonProperties({ $internal_or_test_user: true });
    }
    _requirePersonProcessing(e2) {
      return "never" === this.config.person_profiles ? (xr.error(e2 + ' was called, but process_person is set to "never". This call will be ignored.'), false) : (this._register_single(X, true), true);
    }
    _is_persistence_disabled() {
      if ("always" === this.config.cookieless_mode) return true;
      var e2 = this.consent.isOptedOut();
      return this.config.disable_persistence || e2 && !(!this.config.opt_out_persistence_by_default && this.config.cookieless_mode !== oe);
    }
    _sync_opt_out_with_persistence() {
      var e2, t2, i2, r2, s2 = this._is_persistence_disabled();
      return (null == (e2 = this.persistence) ? void 0 : e2._disabled) !== s2 && (null == (i2 = this.persistence) || i2.set_disabled(s2)), (null == (t2 = this.sessionPersistence) ? void 0 : t2._disabled) !== s2 && (null == (r2 = this.sessionPersistence) || r2.set_disabled(s2)), s2;
    }
    opt_in_capturing(e2) {
      var t2;
      if (this.config.cookieless_mode !== ae) {
        if (this._inCookielessMode()) {
          var i2, r2, s2, n2, o2;
          this.reset(true), null == (i2 = this.sessionManager) || i2.destroy(), null == (r2 = this.pageViewManager) || r2.destroy(), this.sessionManager = new Jo(this), this.pageViewManager = new Ys(this), this.persistence && (this.sessionPropsManager = new Qo(this, this.sessionManager, this.persistence));
          var a2, l2 = null !== (s2 = null == (n2 = this.config.__extensionClasses) ? void 0 : n2.sessionRecording) && void 0 !== s2 ? s2 : null == (o2 = _Ra.__defaultExtensionClasses) ? void 0 : o2.sessionRecording;
          l2 && (this.sessionRecording = this._replaceExtension(this.sessionRecording, new l2(this)), this._lastRemoteConfig && (null == (a2 = this.sessionRecording) || null == a2.onRemoteConfig || a2.onRemoteConfig(this._lastRemoteConfig)));
        }
        var u2, c2;
        this.consent.optInOut(true), this._sync_opt_out_with_persistence(), this._start_queue_if_opted_in(), null == (t2 = this.sessionRecording) || t2.startIfEnabledOrStop(), this.config.cookieless_mode == oe && (null == (u2 = this.surveys) || u2.loadIfEnabled()), (rt(null == e2 ? void 0 : e2.captureEventName) || null != e2 && e2.captureEventName) && this.capture(null !== (c2 = null == e2 ? void 0 : e2.captureEventName) && void 0 !== c2 ? c2 : "$opt_in", null == e2 ? void 0 : e2.captureProperties, { send_instantly: true }), this.config.capture_pageview && this._captureInitialPageview();
      } else xr.warn(wa);
    }
    opt_out_capturing() {
      var e2, t2, i2;
      this.config.cookieless_mode !== ae ? (this.config.cookieless_mode === oe && this.consent.isOptedIn() && this.reset(true), this.consent.optInOut(false), this._sync_opt_out_with_persistence(), this.config.cookieless_mode === oe && (this.register({ distinct_id: te, $device_id: null }), null == (e2 = this.sessionRecording) || e2.stopRecording(), this.sessionRecording = void 0, null == (t2 = this.sessionManager) || t2.destroy(), null == (i2 = this.pageViewManager) || i2.destroy(), this.sessionManager = void 0, this.sessionPropsManager = void 0, this.config.capture_pageview && this._captureInitialPageview(), this._start_queue_if_opted_in())) : xr.warn(wa);
    }
    has_opted_in_capturing() {
      return this.consent.isOptedIn();
    }
    has_opted_out_capturing() {
      return this.consent.isOptedOut();
    }
    get_explicit_consent_status() {
      var e2 = this.consent.consent;
      return 1 === e2 ? "granted" : 0 === e2 ? "denied" : "pending";
    }
    is_capturing() {
      return this.config.cookieless_mode === ae || (this.config.cookieless_mode === oe ? this.consent.isRejected() || this.consent.isOptedIn() : !this.has_opted_out_capturing());
    }
    clear_opt_in_out_capturing() {
      this.consent.reset(), this._sync_opt_out_with_persistence();
    }
    _is_bot() {
      return ye ? Zo(ye, this.config.custom_blocked_useragents) : void 0;
    }
    _captureInitialPageview() {
      be && ("visible" === be.visibilityState ? this._initialPageviewCaptured || (this._initialPageviewCaptured = true, this.capture(he, { title: be.title }, { send_instantly: true }), this._visibilityStateListener && (be.removeEventListener(de, this._visibilityStateListener), this._visibilityStateListener = null)) : this._visibilityStateListener || (this._visibilityStateListener = this._captureInitialPageview.bind(this), Or(be, de, this._visibilityStateListener)));
    }
    debug(e2) {
      false === e2 ? (null == fe || fe.console.log("You've disabled debug mode."), this.set_config({ debug: false })) : (null == fe || fe.console.log("You're now in debug mode. All calls to PostHog will be logged in your console.\nYou can disable this with `posthog.debug(false)`."), this.set_config({ debug: true }));
    }
    _shouldDisableFlags() {
      var e2, t2, i2, r2, s2, n2, o2 = this._originalUserConfig || {};
      return "advanced_disable_flags" in o2 ? !!o2.advanced_disable_flags : false !== this.config.advanced_disable_flags ? !!this.config.advanced_disable_flags : true === this.config.advanced_disable_decide ? (xr.warn("Config field 'advanced_disable_decide' is deprecated. Please use 'advanced_disable_flags' instead. The old field will be removed in a future major version."), true) : (i2 = "advanced_disable_decide", false, r2 = xr, s2 = (t2 = "advanced_disable_flags") in (e2 = o2) && !at(e2[t2]), n2 = i2 in e2 && !at(e2[i2]), s2 ? e2[t2] : !!n2 && (r2 && r2.warn("Config field '" + i2 + "' is deprecated. Please use '" + t2 + "' instead. The old field will be removed in a future major version."), e2[i2]));
    }
    _runBeforeSend(e2) {
      var t2;
      if (at(this.config.before_send)) return e2;
      var i2 = Object.keys(null !== (t2 = e2.properties) && void 0 !== t2 ? t2 : {}).filter(ht), r2 = Xe(this.config.before_send) ? this.config.before_send : [this.config.before_send], s2 = e2;
      for (var n2 of r2) {
        if (s2 = n2(s2), at(s2)) {
          var o2 = "Event '" + e2.event + "' was rejected in beforeSend function";
          return _t(e2.event) ? xr.warn(o2 + ". This can cause unexpected behavior.") : xr.info(o2), null;
        }
        s2.properties && !it(s2.properties) || xr.warn("Event '" + e2.event + "' has no properties after beforeSend function, this is likely an error.");
      }
      for (var a2 of i2) if (s2.properties && at(s2.properties[a2])) return xr.warn("Event '" + e2.event + "' had its '" + a2 + "' property removed in a beforeSend function. This property is required for ingestion, so the event will be dropped."), null;
      return s2;
    }
    getPageViewId() {
      var e2;
      return null == (e2 = this.pageViewManager._currentPageview) ? void 0 : e2.pageViewId;
    }
    captureTraceFeedback(e2, t2) {
      this.capture("$ai_feedback", { $ai_trace_id: String(e2), $ai_feedback_text: t2 });
    }
    captureTraceMetric(e2, t2, i2) {
      this.capture("$ai_metric", { $ai_trace_id: String(e2), $ai_metric_name: t2, $ai_metric_value: String(i2) });
    }
    _checkLocalStorageForDebug(e2) {
      var t2 = ct(e2) && !e2, i2 = Qr._is_supported() && "true" === Qr._get("ph_debug");
      return !t2 && (!!i2 || e2);
    }
  };
  Ra.__defaultExtensionClasses = {}, Ra._noopLogger = /* @__PURE__ */ (() => {
    var e2 = () => {
    };
    return { trace: e2, debug: e2, info: e2, warn: e2, error: e2, fatal: e2 };
  })(), (function(e2, t2) {
    for (var i2 = 0; t2.length > i2; i2++) e2.prototype[t2[i2]] = Rr(e2.prototype[t2[i2]]);
  })(Ra, ["identify"]);
  var La = class {
    constructor(e2) {
      this.disabled = false === e2;
      var t2 = tt(e2) ? e2 : {};
      this.thresholdPx = t2.threshold_px || 30, this.timeoutMs = t2.timeout_ms || 1e3, this.clickCount = t2.click_count || 3, this.clicks = [];
    }
    isRageClick(e2, t2, i2) {
      if (this.disabled) return false;
      var r2 = this.clicks[this.clicks.length - 1];
      if (r2 && Math.abs(e2 - r2.x) + Math.abs(t2 - r2.y) < this.thresholdPx && this.timeoutMs > i2 - r2.timestamp) {
        if (this.clicks.push({ x: e2, y: t2, timestamp: i2 }), this.clicks.length === this.clickCount) return true;
      } else this.clicks = [{ x: e2, y: t2, timestamp: i2 }];
      return false;
    }
  };
  var Ma = "$copy_autocapture";
  var Aa = kr("[AutoCapture]");
  function Oa(e2, t2) {
    return t2.length > e2 ? t2.slice(0, e2) + "..." : t2;
  }
  function $a(e2) {
    if (e2.previousElementSibling) return e2.previousElementSibling;
    var t2 = e2;
    do {
      t2 = t2.previousSibling;
    } while (t2 && !os(t2));
    return t2;
  }
  function Da(e2, t2) {
    var r2, s2, n2 = t2.e, o2 = t2.maskAllElementAttributes, a2 = t2.maskAllText, l2 = t2.elementAttributeIgnoreList, u2 = t2.elementsChainAsString, c2 = t2.disableCaptureUrlHashes;
    if (!os(e2)) return { props: {} };
    for (var d2 = [e2], _2 = /* @__PURE__ */ new Set([e2]), h2 = e2; h2.parentNode && !as(h2, "body") && cs > d2.length; ) if (us(h2.parentNode)) {
      var p2 = h2.parentNode.host;
      if (_2.has(p2)) break;
      _2.add(p2), d2.push(p2), h2 = p2;
    } else {
      if (!os(h2.parentNode)) break;
      if (_2.has(h2.parentNode)) break;
      _2.add(h2.parentNode), d2.push(h2.parentNode), h2 = h2.parentNode;
    }
    var g2, v2, f2 = [], m2 = {}, y2 = false, b2 = false;
    if (Ir(d2, ((e3) => {
      var t3 = Ts(e3);
      if (as(e3, "a")) {
        var i2 = e3.getAttribute("href");
        y2 = !!(t3 && i2 && Ds(i2)) && (c2 ? Ci(i2) : i2);
      }
      We(hs(e3), "ph-no-capture") && (b2 = true), f2.push((function(e4, t4, i3, r4, s3) {
        void 0 === s3 && (s3 = false);
        var n3 = e4.tagName.toLowerCase(), o3 = { tag_name: n3 };
        fs.indexOf(n3) > -1 && !i3 && (o3.$el_text = "a" === n3.toLowerCase() || "button" === n3.toLowerCase() ? Oa(1024, Ns(e4)) : Oa(1024, gs(e4)));
        var a3 = hs(e4);
        a3.length > 0 && (o3.classes = a3.filter((function(e5) {
          return "" !== e5;
        }))), Ir(e4.attributes, (function(i4) {
          var n4;
          if ((!Fs(e4) || -1 !== ["name", "id", "class", "aria-label"].indexOf(i4.name)) && (null == r4 || !r4.includes(i4.name)) && !t4 && Ds(i4.value) && (!st(n4 = i4.name) || "_ngcontent" !== n4.substring(0, 10) && "_nghost" !== n4.substring(0, 7))) {
            var a4 = i4.value;
            "class" === i4.name && (a4 = ds(a4).join(" ")), o3["attr__" + i4.name] = Oa(1024, "href" === i4.name && s3 ? Ci(a4) : a4);
          }
        }));
        for (var l3 = 1, u3 = 1, c3 = e4; c3 = $a(c3); ) l3++, c3.tagName === e4.tagName && u3++;
        return o3.nth_child = l3, o3.nth_of_type = u3, o3;
      })(e3, o2, a2, l2, c2));
      var r3 = (function(e4) {
        if (!Ts(e4)) return {};
        var t4 = {};
        return Ir(e4.attributes, (function(e5) {
          if (e5.name && 0 === e5.name.indexOf("data-ph-capture-attribute")) {
            var i3 = e5.name.replace("data-ph-capture-attribute-", ""), r4 = e5.value;
            i3 && r4 && Ds(r4) && (t4[i3] = r4);
          }
        })), t4;
      })(e3);
      Cr(m2, r3);
    })), b2) return { props: {}, explicitNoCapture: b2 };
    if (a2 || (f2[0].$el_text = as(e2, "a") || as(e2, "button") ? Ns(e2) : gs(e2)), y2) {
      var w2, S2;
      f2[0].attr__href = y2;
      var E2 = null == (w2 = tn(y2)) ? void 0 : w2.host, x2 = null == fe || null == (S2 = fe.location) ? void 0 : S2.host;
      E2 && x2 && E2 !== x2 && (g2 = y2);
    }
    return { props: Cr({ $event_type: n2.type, $ce_version: 1 }, u2 ? {} : { $elements: f2 }, { $elements_chain: (v2 = f2, (function(e3) {
      return e3.map(((e4) => {
        var t3, r3, s3 = "";
        if (e4.tag_name && (s3 += e4.tag_name), e4.attr_class) for (var n3 of (e4.attr_class.sort(), e4.attr_class)) s3 += "." + n3.replace(/"/g, "");
        var o3 = i({}, e4.text ? { text: e4.text } : {}, { "nth-child": null !== (t3 = e4.nth_child) && void 0 !== t3 ? t3 : 0, "nth-of-type": null !== (r3 = e4.nth_of_type) && void 0 !== r3 ? r3 : 0 }, e4.href ? { href: e4.href } : {}, e4.attr_id ? { attr_id: e4.attr_id } : {}, e4.attributes), a3 = {};
        return Tr(o3).sort(((e5, t4) => e5[0].localeCompare(t4[0]))).forEach(((e5) => {
          var t4 = e5[1];
          return a3[Us(e5[0].toString())] = Us(t4.toString());
        })), (s3 += ":") + Tr(a3).map(((e5) => e5[0] + '="' + e5[1] + '"')).join("");
      })).join(";");
    })((function(e3) {
      return e3.map(((e4) => {
        var t3, i2, r3 = { text: null == (t3 = e4.$el_text) ? void 0 : t3.slice(0, 400), tag_name: e4.tag_name, href: null == (i2 = e4.attr__href) ? void 0 : i2.slice(0, 2048), attr_class: qs(e4), attr_id: e4.attr__id, nth_child: e4.nth_child, nth_of_type: e4.nth_of_type, attributes: {} };
        return Tr(e4).filter(((e5) => 0 === e5[0].indexOf("attr__"))).forEach(((e5) => r3.attributes[e5[0]] = e5[1])), r3;
      }));
    })(v2))) }, null != (r2 = f2[0]) && r2.$el_text ? { $el_text: null == (s2 = f2[0]) ? void 0 : s2.$el_text } : {}, g2 && "click" === n2.type ? { $external_click_url: g2 } : {}, m2) };
  }
  var Na = kr("[ExceptionAutocapture]");
  var Ba = () => {
  };
  var Ua = kr("[TracingHeaders]");
  var qa = kr("[Web Vitals]");
  var Ha = 9e5;
  var za = "disabled";
  var ja = "lazy_loading";
  var Va = "awaiting_config";
  var Wa = "missing_config";
  kr("[SessionRecording]"), kr("[SessionRecording]");
  var Ga = "[SessionRecording]";
  var Qa = kr(Ga);
  var Ka = kr("[Heatmaps]");
  function Ya(e2) {
    return tt(e2) && "clientX" in e2 && "clientY" in e2 && lt(e2.clientX) && lt(e2.clientY);
  }
  var Ja = kr("[Product Tours]");
  var Za = (e2) => {
    var t2;
    return !e2.config.disable_product_tours && !(null == (t2 = e2.persistence) || !t2.get_property(m));
  };
  var Xa = ["$set_once", "$set"];
  var el = kr("[SiteApps]");
  var tl = "Error while initializing PostHog app with config id ";
  function il(e2, t2, i2) {
    if (at(e2)) return false;
    switch (i2) {
      case "exact":
        return e2 === t2;
      case "contains":
        var r2 = t2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/_/g, ".").replace(/%/g, ".*");
        return new RegExp(r2, "i").test(e2);
      case "regex":
        try {
          return new RegExp(t2).test(e2);
        } catch (e3) {
          return false;
        }
      default:
        return false;
    }
  }
  var rl = class {
    constructor(e2) {
      this._debugEventEmitter = new Ko(), this._checkStep = (e3, t2) => this._checkStepEvent(e3, t2) && this._checkStepUrl(e3, t2) && this._checkStepElement(e3, t2) && this._checkStepProperties(e3, t2), this._checkStepEvent = (e3, t2) => null == t2 || !t2.event || (null == e3 ? void 0 : e3.event) === (null == t2 ? void 0 : t2.event), this._instance = e2, this._actionEvents = /* @__PURE__ */ new Set(), this._actionRegistry = /* @__PURE__ */ new Set();
    }
    init() {
      var e2, t2;
      rt(null == (e2 = this._instance) ? void 0 : e2._addCaptureHook) || (null == (t2 = this._instance) || t2._addCaptureHook(((e3, t3) => {
        this.on(e3, t3);
      })));
    }
    register(e2) {
      var t2, i2;
      if (!rt(null == (t2 = this._instance) ? void 0 : t2._addCaptureHook) && (e2.forEach(((e3) => {
        var t3, i3;
        null == (t3 = this._actionRegistry) || t3.add(e3), null == (i3 = e3.steps) || i3.forEach(((e4) => {
          var t4;
          null == (t4 = this._actionEvents) || t4.add((null == e4 ? void 0 : e4.event) || "");
        }));
      })), null != (i2 = this._instance) && i2.autocapture)) {
        var r2, s2 = /* @__PURE__ */ new Set();
        e2.forEach(((e3) => {
          var t3;
          null == (t3 = e3.steps) || t3.forEach(((e4) => {
            null != e4 && e4.selector && s2.add(null == e4 ? void 0 : e4.selector);
          }));
        })), null == (r2 = this._instance) || r2.autocapture.setElementSelectors(s2);
      }
    }
    on(e2, t2) {
      var i2;
      null != t2 && 0 != e2.length && (this._actionEvents.has(e2) || this._actionEvents.has(t2.event)) && this._actionRegistry && (null == (i2 = this._actionRegistry) ? void 0 : i2.size) > 0 && this._actionRegistry.forEach(((e3) => {
        this._checkAction(t2, e3) && this._debugEventEmitter.emit("actionCaptured", e3.name);
      }));
    }
    _addActionHook(e2) {
      this.onAction("actionCaptured", ((t2) => e2(t2)));
    }
    _checkAction(e2, t2) {
      if (null == (null == t2 ? void 0 : t2.steps)) return false;
      for (var i2 of t2.steps) if (this._checkStep(e2, i2)) return true;
      return false;
    }
    onAction(e2, t2) {
      return this._debugEventEmitter.on(e2, t2);
    }
    _checkStepUrl(e2, t2) {
      if (null != t2 && t2.url) {
        var i2, r2 = null == e2 || null == (i2 = e2.properties) ? void 0 : i2.$current_url;
        if (!r2 || "string" != typeof r2) return false;
        if (!il(r2, t2.url, t2.url_matching || "contains")) return false;
      }
      return true;
    }
    _checkStepElement(e2, t2) {
      return !!this._checkStepHref(e2, t2) && !!this._checkStepText(e2, t2) && !!this._checkStepSelector(e2, t2);
    }
    _checkStepHref(e2, t2) {
      var i2;
      if (null == t2 || !t2.href) return true;
      var r2 = this._getElementsList(e2);
      if (r2.length > 0) return r2.some(((e3) => il(e3.href, t2.href, t2.href_matching || "exact")));
      var s2, n2 = (null == e2 || null == (i2 = e2.properties) ? void 0 : i2.$elements_chain) || "";
      return !!n2 && il((s2 = n2.match(/(?::|")href="(.*?)"/)) ? s2[1] : "", t2.href, t2.href_matching || "exact");
    }
    _checkStepText(e2, t2) {
      var i2;
      if (null == t2 || !t2.text) return true;
      var r2 = this._getElementsList(e2);
      if (r2.length > 0) return r2.some(((e3) => il(e3.text, t2.text, t2.text_matching || "exact") || il(e3.$el_text, t2.text, t2.text_matching || "exact")));
      var s2, n2, o2, a2 = (null == e2 || null == (i2 = e2.properties) ? void 0 : i2.$elements_chain) || "";
      return !!a2 && (s2 = (function(e3) {
        for (var t3, i3 = [], r3 = /(?::|")text="(.*?)"/g; !at(t3 = r3.exec(e3)); ) i3.includes(t3[1]) || i3.push(t3[1]);
        return i3;
      })(a2), n2 = t2.text, o2 = t2.text_matching || "exact", s2.some(((e3) => il(e3, n2, o2))));
    }
    _checkStepSelector(e2, t2) {
      var i2, r2;
      if (null == t2 || !t2.selector) return true;
      var s2 = null == e2 || null == (i2 = e2.properties) ? void 0 : i2.$element_selectors;
      if (null != s2 && s2.includes(t2.selector)) return true;
      var n2 = (null == e2 || null == (r2 = e2.properties) ? void 0 : r2.$elements_chain) || "";
      if (t2.selector_regex && n2) try {
        return new RegExp(t2.selector_regex).test(n2);
      } catch (e3) {
        return false;
      }
      return false;
    }
    _getElementsList(e2) {
      var t2;
      return null == (null == e2 || null == (t2 = e2.properties) ? void 0 : t2.$elements) ? [] : null == e2 ? void 0 : e2.properties.$elements;
    }
    _checkStepProperties(e2, t2) {
      return null == t2 || !t2.properties || 0 === t2.properties.length || sa(t2.properties.reduce(((e3, t3) => {
        var i2 = Xe(t3.value) ? t3.value.map(String) : null != t3.value ? [String(t3.value)] : [];
        return e3[t3.key] = { values: i2, operator: t3.operator || "exact" }, e3;
      }), {}), null == e2 ? void 0 : e2.properties);
    }
  };
  var sl = class {
    constructor(e2) {
      this._pendingActivatedItems = [], this._instance = e2, this._eventToItems = /* @__PURE__ */ new Map(), this._cancelEventToItems = /* @__PURE__ */ new Map(), this._actionToItems = /* @__PURE__ */ new Map();
    }
    _doesEventMatchFilter(e2, t2) {
      return !!e2 && sa(e2.propertyFilters, null == t2 ? void 0 : t2.properties);
    }
    _buildEventToItemMap(e2, t2) {
      var i2 = /* @__PURE__ */ new Map();
      return e2.forEach(((e3) => {
        var r2;
        null == (r2 = e3.conditions) || null == (r2 = r2[t2]) || null == (r2 = r2.values) || r2.forEach(((t3) => {
          if (null != t3 && t3.name) {
            var r3 = i2.get(t3.name) || [];
            r3.push(e3.id), i2.set(t3.name, r3);
          }
        }));
      })), i2;
    }
    _getMatchingItems(e2, t2, i2) {
      var r2 = (i2 === In.Activation ? this._eventToItems : this._cancelEventToItems).get(e2), s2 = [];
      return this._getItems(((e3) => {
        s2 = e3.filter(((e4) => null == r2 ? void 0 : r2.includes(e4.id)));
      })), s2.filter(((r3) => {
        var s3, n2 = null == (s3 = r3.conditions) || null == (s3 = s3[i2]) || null == (s3 = s3.values) ? void 0 : s3.find(((t3) => t3.name === e2));
        return this._doesEventMatchFilter(n2, t2);
      }));
    }
    register(e2) {
      var t2;
      rt(null == (t2 = this._instance) ? void 0 : t2._addCaptureHook) || (this._setupEventBasedItems(e2), this._setupActionBasedItems(e2));
    }
    _setupActionBasedItems(e2) {
      var t2 = e2.filter(((e3) => {
        var t3, i2;
        return (null == (t3 = e3.conditions) ? void 0 : t3.actions) && (null == (i2 = e3.conditions) || null == (i2 = i2.actions) || null == (i2 = i2.values) ? void 0 : i2.length) > 0;
      }));
      0 !== t2.length && (null == this._actionMatcher && (this._actionMatcher = new rl(this._instance), this._actionMatcher.init(), this._actionMatcher._addActionHook(((e3) => {
        this.onAction(e3);
      }))), t2.forEach(((e3) => {
        var t3, i2, r2, s2, n2;
        e3.conditions && null != (t3 = e3.conditions) && t3.actions && null != (i2 = e3.conditions) && null != (i2 = i2.actions) && i2.values && (null == (r2 = e3.conditions) || null == (r2 = r2.actions) || null == (r2 = r2.values) ? void 0 : r2.length) > 0 && (null == (s2 = this._actionMatcher) || s2.register(e3.conditions.actions.values), null == (n2 = e3.conditions) || null == (n2 = n2.actions) || null == (n2 = n2.values) || n2.forEach(((t4) => {
          if (t4 && t4.name) {
            var i3 = this._actionToItems.get(t4.name);
            i3 && i3.push(e3.id), this._actionToItems.set(t4.name, i3 || [e3.id]);
          }
        })));
      })));
    }
    _setupEventBasedItems(e2) {
      var t2, i2 = e2.filter(((e3) => {
        var t3, i3;
        return (null == (t3 = e3.conditions) ? void 0 : t3.events) && (null == (i3 = e3.conditions) || null == (i3 = i3.events) || null == (i3 = i3.values) ? void 0 : i3.length) > 0;
      })), r2 = e2.filter(((e3) => {
        var t3, i3;
        return (null == (t3 = e3.conditions) ? void 0 : t3.cancelEvents) && (null == (i3 = e3.conditions) || null == (i3 = i3.cancelEvents) || null == (i3 = i3.values) ? void 0 : i3.length) > 0;
      }));
      0 === i2.length && 0 === r2.length || (null == (t2 = this._instance) || t2._addCaptureHook(((e3, t3) => {
        this.onEvent(e3, t3);
      })), this._eventToItems = this._buildEventToItemMap(e2, In.Activation), this._cancelEventToItems = this._buildEventToItemMap(e2, In.Cancellation));
    }
    onEvent(e2, t2) {
      var i2, r2, s2 = this._getLogger(), n2 = (null == t2 || null == (i2 = t2.properties) ? void 0 : i2.$survey_id) || (null == t2 || null == (r2 = t2.properties) ? void 0 : r2.$product_tour_id);
      if (n2 && this.getActivatedIds().includes(n2)) {
        var o2 = this._activationOutcome(e2, n2);
        if ("consume" === o2) return s2.info("event consumed activated item, removing it", { event: e2, itemId: n2 }), void this._deactivateItems([n2]);
        if ("persist" === o2) return s2.info("shown item promoted to persisted activation", { event: e2, itemId: n2 }), void this._persistActivation(n2);
      }
      if (this._cancelEventToItems.has(e2)) {
        var a2 = this._getMatchingItems(e2, t2, In.Cancellation);
        a2.length > 0 && (s2.info("cancel event matched, cancelling items", { event: e2, itemsToCancel: a2.map(((e3) => e3.id)) }), this._deactivateItems(a2.map(((e3) => e3.id))), a2.forEach(((e3) => this._cancelPendingItem(e3.id))));
      }
      if (this._eventToItems.has(e2)) {
        s2.info("event name matched", { event: e2, eventPayload: t2, items: this._eventToItems.get(e2) });
        var l2 = this._getMatchingItems(e2, t2, In.Activation);
        this._activateItems(l2.map(((e3) => e3.id)));
      }
    }
    onAction(e2) {
      this._actionToItems.has(e2) && this._activateItems(this._actionToItems.get(e2) || []);
    }
    _activateItems(e2) {
      0 !== e2.length && (this._pendingActivatedItems = [.../* @__PURE__ */ new Set([...this._pendingActivatedItems, ...e2])], this._getLogger().info("updating activated items", { activatedItems: this.getActivatedIds() }));
    }
    _persistActivation(e2) {
      this._pendingActivatedItems = this._pendingActivatedItems.filter(((t3) => t3 !== e2));
      var t2 = this._getPersistedActivatedIds();
      t2.includes(e2) || this._setActivatedItems([...t2, e2]);
    }
    _deactivateItems(e2) {
      var t2 = new Set(e2);
      this._pendingActivatedItems = this._pendingActivatedItems.filter(((e3) => !t2.has(e3)));
      var i2 = this._getPersistedActivatedIds(), r2 = i2.filter(((e3) => !t2.has(e3)));
      r2.length !== i2.length && this._setActivatedItems(r2);
    }
    _getPersistedActivatedIds() {
      var e2, t2 = this._getActivatedKey();
      return (null == (e2 = this._instance) || null == (e2 = e2.persistence) ? void 0 : e2.props[t2]) || [];
    }
    getActivatedIds() {
      return [.../* @__PURE__ */ new Set([...this._getPersistedActivatedIds(), ...this._pendingActivatedItems])].filter(((e2) => !this._isItemPermanentlyIneligible(e2)));
    }
    reset() {
      this._pendingActivatedItems = [], this._getPersistedActivatedIds().length > 0 && this._setActivatedItems([]);
    }
    getEventToItemsMap() {
      return this._eventToItems;
    }
    _getActionMatcher() {
      return this._actionMatcher;
    }
  };
  var nl = class extends sl {
    constructor(e2) {
      super(e2);
    }
    _getActivatedKey() {
      return q;
    }
    _getShownEventName() {
      return On.SHOWN;
    }
    _getItems(e2) {
      var t2;
      null == (t2 = this._instance) || t2.getSurveys(e2);
    }
    _cancelPendingItem(e2) {
      var t2;
      null == (t2 = this._instance) || t2.cancelPendingSurvey(e2);
    }
    _getLogger() {
      return ca;
    }
    _setActivatedItems(e2) {
      var t2;
      null == (t2 = this._instance) || null == (t2 = t2.persistence) || t2.register({ [q]: e2 });
    }
    _isItemPermanentlyIneligible() {
      return false;
    }
    _activationOutcome(e2, t2) {
      var i2;
      this._getItems(((e3) => {
        i2 = e3.find(((e4) => e4.id === t2));
      }));
      var r2 = !i2 || (function(e3) {
        var t3;
        return ua(e3) && !(null == (t3 = e3.conditions) || null == (t3 = t3.events) || !t3.repeatedActivation) || "always" === e3.schedule;
      })(i2);
      return r2 ? e2 === On.SHOWN ? "consume" : "ignore" : e2 === On.SHOWN ? "persist" : e2 === On.DISMISSED || e2 === On.SENT ? "consume" : "ignore";
    }
    getSurveys() {
      return this.getActivatedIds();
    }
    getEventToSurveys() {
      return this.getEventToItemsMap();
    }
  };
  var ol = "SDK is not enabled or survey functionality is not yet loaded";
  var al = "Disabled. Not loading surveys.";
  var ll = null != fe && fe.location ? nn(fe.location.hash, "__posthog") || nn(location.hash, "state") : null;
  var ul = "_postHogToolbarParams";
  var cl = kr("[Toolbar]");
  var dl = kr("[FeatureFlags]");
  var _l = kr("[FeatureFlags]", { debugEnabled: true });
  var hl = `" failed. Feature flags didn't load in time.`;
  var pl = (e2) => {
    for (var t2 = {}, i2 = 0; e2.length > i2; i2++) t2[e2[i2]] = true;
    return t2;
  };
  var gl = (e2) => {
    var t2 = {};
    for (var i2 of Tr(e2 || {})) {
      var r2 = i2[1];
      r2 && (t2[i2[0]] = r2);
    }
    return t2;
  };
  var vl = kr("[Error tracking]");
  var fl = "Refusing to render web experiment since the viewer is a likely bot";
  var ml = { icontains: (e2, t2) => t2.toLowerCase().indexOf(e2.toLowerCase()) > -1, not_icontains: (e2, t2) => -1 === t2.toLowerCase().indexOf(e2.toLowerCase()), regex: (e2, t2) => ea(t2, e2), not_regex: (e2, t2) => !ea(t2, e2), exact: (e2, t2) => t2 === e2, is_not: (e2, t2) => t2 !== e2 };
  var yl = class _yl {
    get _config() {
      return this._instance.config;
    }
    constructor(e2) {
      var t2 = this;
      this.getWebExperimentsAndEvaluateDisplayLogic = function(e3) {
        void 0 === e3 && (e3 = false), t2.getWebExperiments(((e4) => {
          _yl._logInfo("retrieved web experiments from the server"), t2._flagToExperiments = /* @__PURE__ */ new Map(), e4.forEach(((e5) => {
            if (e5.feature_flag_key) {
              var i2;
              t2._flagToExperiments && (_yl._logInfo("setting flag key ", e5.feature_flag_key, " to web experiment ", e5), null == (i2 = t2._flagToExperiments) || i2.set(e5.feature_flag_key, e5));
              var r2 = t2._instance.getFeatureFlag(e5.feature_flag_key);
              st(r2) && e5.variants[r2] && t2._applyTransforms(e5.name, r2, e5.variants[r2].transforms);
            } else if (e5.variants) for (var s2 in e5.variants) {
              var n2 = e5.variants[s2];
              _yl._matchesTestVariant(n2, t2._instance) && t2._applyTransforms(e5.name, s2, n2.transforms);
            }
          }));
        }), e3);
      }, this._instance = e2, this._instance.onFeatureFlags(((e3) => {
        this.onFeatureFlags(e3);
      }));
    }
    initialize() {
    }
    onFeatureFlags(e2) {
      if (this._is_bot()) _yl._logInfo(fl);
      else if (!this._config.disable_web_experiments) {
        if (at(this._flagToExperiments)) return this._flagToExperiments = /* @__PURE__ */ new Map(), this.loadIfEnabled(), void this.previewWebExperiment();
        _yl._logInfo("applying feature flags", e2), e2.forEach(((e3) => {
          var t2;
          if (this._flagToExperiments && null != (t2 = this._flagToExperiments) && t2.has(e3)) {
            var i2, r2 = this._instance.getFeatureFlag(e3), s2 = null == (i2 = this._flagToExperiments) ? void 0 : i2.get(e3);
            r2 && null != s2 && s2.variants[r2] && this._applyTransforms(s2.name, r2, s2.variants[r2].transforms);
          }
        }));
      }
    }
    previewWebExperiment() {
      var e2 = _yl.getWindowLocation();
      if (null != e2 && e2.search) {
        var t2 = rn(null == e2 ? void 0 : e2.search, "__experiment_id"), i2 = rn(null == e2 ? void 0 : e2.search, "__experiment_variant");
        t2 && i2 && (_yl._logInfo("previewing web experiments " + t2 + " && " + i2), this.getWebExperiments(((e3) => {
          this._showPreviewWebExperiment(parseInt(t2), i2, e3);
        }), false, true));
      }
    }
    loadIfEnabled() {
      this._config.disable_web_experiments || this.getWebExperimentsAndEvaluateDisplayLogic();
    }
    getWebExperiments(e2, t2, i2) {
      if (this._config.disable_web_experiments && !i2) return e2([]);
      var r2 = this._instance.get_property("$web_experiments");
      if (r2 && !t2) return e2(r2);
      this._instance._send_request({ url: this._instance.requestRouter.endpointFor("api", "/api/web_experiments/?token=" + this._config.token), method: "GET", callback: (t3) => e2(200 === t3.statusCode && t3.json && t3.json.experiments || []) });
    }
    _showPreviewWebExperiment(e2, t2, i2) {
      var r2 = i2.filter(((t3) => t3.id === e2));
      r2 && r2.length > 0 && (_yl._logInfo("Previewing web experiment [" + r2[0].name + "] with variant [" + t2 + "]"), this._applyTransforms(r2[0].name, t2, r2[0].variants[t2].transforms));
    }
    static _matchesTestVariant(e2, t2) {
      return !at(e2.conditions) && _yl._matchUrlConditions(e2, t2) && _yl._matchUTMConditions(e2);
    }
    static _matchUrlConditions(e2, t2) {
      var i2;
      if (at(e2.conditions) || at(null == (i2 = e2.conditions) ? void 0 : i2.url)) return true;
      var r2 = _yl.getWindowLocation();
      if (r2) {
        var s2, n2, o2, a2 = ts(t2, r2.href);
        return null == (s2 = e2.conditions) || !s2.url || ml[null !== (n2 = null == (o2 = e2.conditions) ? void 0 : o2.urlMatchType) && void 0 !== n2 ? n2 : "icontains"](e2.conditions.url, a2);
      }
      return false;
    }
    static getWindowLocation() {
      return null == fe ? void 0 : fe.location;
    }
    static _matchUTMConditions(e2) {
      var t2;
      if (at(e2.conditions) || at(null == (t2 = e2.conditions) ? void 0 : t2.utm)) return true;
      var i2 = hn();
      if (i2.utm_source) {
        var r2, s2, n2, o2, a2, l2, u2, c2, d2 = null == (r2 = e2.conditions) || null == (r2 = r2.utm) || !r2.utm_campaign || (null == (s2 = e2.conditions) || null == (s2 = s2.utm) ? void 0 : s2.utm_campaign) == i2.utm_campaign, _2 = null == (n2 = e2.conditions) || null == (n2 = n2.utm) || !n2.utm_source || (null == (o2 = e2.conditions) || null == (o2 = o2.utm) ? void 0 : o2.utm_source) == i2.utm_source, h2 = null == (a2 = e2.conditions) || null == (a2 = a2.utm) || !a2.utm_medium || (null == (l2 = e2.conditions) || null == (l2 = l2.utm) ? void 0 : l2.utm_medium) == i2.utm_medium, p2 = null == (u2 = e2.conditions) || null == (u2 = u2.utm) || !u2.utm_term || (null == (c2 = e2.conditions) || null == (c2 = c2.utm) ? void 0 : c2.utm_term) == i2.utm_term;
        return d2 && h2 && p2 && _2;
      }
      return false;
    }
    static _logInfo(e2) {
      for (var t2 = arguments.length, i2 = new Array(t2 > 1 ? t2 - 1 : 0), r2 = 1; t2 > r2; r2++) i2[r2 - 1] = arguments[r2];
      xr.info("[WebExperiments] " + e2, i2);
    }
    _applyTransforms(e2, t2, i2) {
      this._is_bot() ? _yl._logInfo(fl) : "control" !== t2 ? i2.forEach(((i3) => {
        if (i3.selector) {
          var r2;
          _yl._logInfo("applying transform of variant " + t2 + " for experiment " + e2 + " ", i3);
          var s2 = null == (r2 = document) ? void 0 : r2.querySelectorAll(i3.selector);
          null == s2 || s2.forEach(((e3) => {
            var t3 = e3;
            i3.html && (t3.innerHTML = i3.html), i3.css && t3.setAttribute("style", i3.css);
          }));
        }
      })) : _yl._logInfo("Control variants leave the page unmodified.");
    }
    _is_bot() {
      return ye && this._instance ? Zo(ye, this._config.custom_blocked_useragents) : void 0;
    }
  };
  var bl = kr("[Conversations]");
  var wl = "Conversations not available yet.";
  var Sl = "console";
  var El = { featureFlags: class {
    constructor(e2) {
      this._override_warning = false, this._hasLoadedFlags = false, this._requestInFlight = false, this._reloadingDisabled = false, this._additionalReloadRequested = false, this._flagsLoadedFromRemote = false, this._hasLoggedDeprecationWarning = false, this._staleCacheRefreshTriggered = false, this._consecutiveStatusZeroFailures = 0, this._onOnline = () => {
        var e3 = this._hasStatusZeroCircuitBreakerTripped();
        this._consecutiveStatusZeroFailures = 0, e3 && this.reloadFeatureFlags();
      }, this._instance = e2, this.featureFlagEventHandlers = [], fe && Or(fe, "online", this._onOnline);
    }
    destroy() {
      null == fe || fe.removeEventListener("online", this._onOnline);
    }
    get _config() {
      return this._instance.config;
    }
    get _persistence() {
      return this._instance.persistence;
    }
    _prop(e2) {
      return this._instance.get_property(e2);
    }
    _isCacheStale() {
      var e2, t2;
      return null !== (e2 = null == (t2 = this._persistence) ? void 0 : t2._isFeatureFlagCacheStale(this._config.feature_flag_cache_ttl_ms)) && void 0 !== e2 && e2;
    }
    _checkAndTriggerStaleRefresh() {
      return !!this._isCacheStale() && (this._staleCacheRefreshTriggered || this._requestInFlight || (this._staleCacheRefreshTriggered = true, dl.warn("Feature flag cache is stale, triggering refresh..."), this.reloadFeatureFlags()), true);
    }
    _getValidEvaluationEnvironments() {
      var e2, t2 = null !== (e2 = this._config.evaluation_contexts) && void 0 !== e2 ? e2 : this._config.evaluation_environments;
      return !this._config.evaluation_environments || this._config.evaluation_contexts || this._hasLoggedDeprecationWarning || (dl.warn("evaluation_environments is deprecated. Use evaluation_contexts instead. evaluation_environments will be removed in a future version."), this._hasLoggedDeprecationWarning = true), null != t2 && t2.length ? t2.filter(((e3) => {
        var t3 = e3 && "string" == typeof e3 && e3.trim().length > 0;
        return t3 || dl.error("Invalid evaluation context found:", e3, "Expected non-empty string"), t3;
      })) : [];
    }
    _shouldIncludeEvaluationEnvironments() {
      return this._getValidEvaluationEnvironments().length > 0;
    }
    _getValidFlagKeys() {
      var e2 = this._config.flag_keys;
      if (!rt(e2)) {
        if (Xe(e2)) return e2.filter(((e3) => {
          var t2 = e3 && "string" == typeof e3 && e3.trim().length > 0;
          return t2 || dl.error("Invalid flag key found:", e3, "Expected non-empty string"), t2;
        }));
        dl.error("Invalid flag_keys found:", e2, "Expected array of non-empty strings");
      }
    }
    initialize() {
      var e2, t2, i2 = this._instance.config, r2 = null !== (e2 = null == (t2 = i2.bootstrap) ? void 0 : t2.featureFlags) && void 0 !== e2 ? e2 : {};
      if (Object.keys(r2).length) {
        var s2, n2, o2 = null !== (s2 = null == (n2 = i2.bootstrap) ? void 0 : n2.featureFlagPayloads) && void 0 !== s2 ? s2 : {}, a2 = Object.keys(r2).filter(((e3) => !!r2[e3])).reduce(((e3, t3) => (e3[t3] = r2[t3] || false, e3)), {}), l2 = Object.keys(o2).filter(((e3) => a2[e3])).reduce(((e3, t3) => (o2[t3] && (e3[t3] = o2[t3]), e3)), {});
        this.receivedFeatureFlags({ featureFlags: a2, featureFlagPayloads: l2 });
      }
    }
    updateFlags(e2, t2, r2) {
      var s2, n2, o2 = null != r2 && r2.merge && null !== (s2 = this._prop(C)) && void 0 !== s2 ? s2 : {}, a2 = null != r2 && r2.merge && null !== (n2 = this._prop(L)) && void 0 !== n2 ? n2 : {}, l2 = i({}, o2, e2), u2 = i({}, a2, t2), c2 = {};
      for (var d2 of Object.entries(l2)) {
        var _2 = d2[0], h2 = d2[1];
        c2[_2] = { key: _2, enabled: Fe(h2), variant: Re(h2), reason: void 0, metadata: rt(null == u2 ? void 0 : u2[_2]) ? void 0 : { id: 0, version: void 0, description: void 0, payload: u2[_2] } };
      }
      this.receivedFeatureFlags({ flags: c2 });
    }
    get hasLoadedFlags() {
      return this._hasLoadedFlags;
    }
    getFlags() {
      return Object.keys(this.getFlagVariants());
    }
    getFlagsWithDetails() {
      var e2 = this._prop(R), t2 = this._prop(A), r2 = this._prop(O);
      if (!r2 && !t2) return e2 || {};
      var s2 = Cr({}, e2 || {}), n2 = [.../* @__PURE__ */ new Set([...Object.keys(r2 || {}), ...Object.keys(t2 || {})])];
      for (var o2 of n2) {
        var a2, l2, u2 = s2[o2], c2 = null == t2 ? void 0 : t2[o2], d2 = rt(c2) ? null !== (a2 = null == u2 ? void 0 : u2.enabled) && void 0 !== a2 && a2 : !!c2, _2 = rt(c2) ? u2.variant : "string" == typeof c2 ? c2 : void 0, h2 = null == r2 ? void 0 : r2[o2], p2 = i({}, u2, { enabled: d2, variant: d2 ? null != _2 ? _2 : null == u2 ? void 0 : u2.variant : void 0 });
        d2 !== (null == u2 ? void 0 : u2.enabled) && (p2.original_enabled = null == u2 ? void 0 : u2.enabled), _2 !== (null == u2 ? void 0 : u2.variant) && (p2.original_variant = null == u2 ? void 0 : u2.variant), h2 && (p2.metadata = i({}, null == u2 ? void 0 : u2.metadata, { payload: h2, original_payload: null == u2 || null == (l2 = u2.metadata) ? void 0 : l2.payload })), s2[o2] = p2;
      }
      return this._override_warning || (dl.warn(" Overriding feature flag details!", { flagDetails: e2, overriddenPayloads: r2, finalDetails: s2 }), this._override_warning = true), s2;
    }
    getAllFeatureFlags() {
      var e2 = this.getFlagVariants(), t2 = this.getFlagPayloads();
      return Object.keys(e2).map(((i2) => {
        var r2 = e2[i2];
        return { key: i2, enabled: Fe(r2), variant: Re(r2), payload: Te(t2[i2]) };
      }));
    }
    getFlagVariants() {
      var e2 = this._prop(C), t2 = this._prop(A);
      if (!t2) return e2 || {};
      for (var i2 = Cr({}, e2), r2 = Object.keys(t2), s2 = 0; r2.length > s2; s2++) i2[r2[s2]] = t2[r2[s2]];
      return this._override_warning || (dl.warn(" Overriding feature flags!", { enabledFlags: e2, overriddenFlags: t2, finalFlags: i2 }), this._override_warning = true), i2;
    }
    getFlagPayloads() {
      var e2 = this._prop(L), t2 = this._prop(O);
      if (!t2) return e2 || {};
      for (var i2 = Cr({}, e2 || {}), r2 = Object.keys(t2), s2 = 0; r2.length > s2; s2++) i2[r2[s2]] = t2[r2[s2]];
      return this._override_warning || (dl.warn(" Overriding feature flag payloads!", { flagPayloads: e2, overriddenPayloads: t2, finalPayloads: i2 }), this._override_warning = true), i2;
    }
    reloadFeatureFlags() {
      this._reloadingDisabled || this._config.advanced_disable_feature_flags || this._hasStatusZeroCircuitBreakerTripped() || this._reloadDebouncer || (this._instance._internalEventEmitter.emit("featureFlagsReloading", true), this._reloadDebouncer = setTimeout((() => {
        this._callFlagsEndpoint();
      }), 5));
    }
    _clearDebouncer() {
      clearTimeout(this._reloadDebouncer), this._reloadDebouncer = void 0;
    }
    ensureFlagsLoaded() {
      this._hasLoadedFlags || this._requestInFlight || this._reloadDebouncer || this.reloadFeatureFlags();
    }
    setAnonymousDistinctId(e2) {
      this.$anon_distinct_id = e2;
    }
    setReloadingPaused(e2) {
      this._reloadingDisabled = e2;
    }
    _callFlagsEndpoint(e2) {
      var t2;
      if (this._clearDebouncer(), !this._instance._shouldDisableFlags() && !this._hasStatusZeroCircuitBreakerTripped()) if (this._requestInFlight) this._additionalReloadRequested = true;
      else {
        var r2 = this._config.token, s2 = this._prop(a), n2 = { token: r2, distinct_id: this._instance.get_distinct_id(), groups: this._instance.getGroups(), $anon_distinct_id: this.$anon_distinct_id, person_properties: i({}, (null == (t2 = this._persistence) ? void 0 : t2.get_initial_props()) || {}, this._prop(D) || {}), group_properties: this._prop(N), timezone: wn() };
        ot(s2) || rt(s2) || (n2.$device_id = s2), (null != e2 && e2.disableFlags || this._config.advanced_disable_feature_flags) && (n2.disable_flags = true), this._shouldIncludeEvaluationEnvironments() && (n2.evaluation_contexts = this._getValidEvaluationEnvironments());
        var o2 = this._getValidFlagKeys();
        rt(o2) || (n2.flag_keys = o2);
        var l2 = !!this._config.advanced_only_evaluate_survey_feature_flags, u2 = this._instance.requestRouter.endpointFor("flags", "/flags/?v=2" + (this._config.advanced_only_evaluate_survey_feature_flags ? "&only_evaluate_survey_feature_flags=true" : ""));
        this._requestInFlight = true, this._instance._send_request({ method: "POST", url: u2, data: n2, compression: this._config.disable_compression ? void 0 : Wn.Base64, timeout: this._config.feature_flag_request_timeout_ms, callback: (e3) => {
          var t3, i2, r3, s3 = true;
          if (this._trackStatusZeroReachability(e3.statusCode), 200 === e3.statusCode && (this._additionalReloadRequested || (this.$anon_distinct_id = void 0), s3 = false), this._requestInFlight = false, !n2.disable_flags || this._additionalReloadRequested) {
            this._flagsLoadedFromRemote = !s3;
            var o3 = [];
            e3.error ? e3.error instanceof Error ? o3.push("AbortError" === e3.error.name ? "timeout" : "connection_error") : o3.push("unknown_error") : 200 !== e3.statusCode && o3.push("api_error_" + e3.statusCode), null != (t3 = e3.json) && t3.errorsWhileComputingFlags && o3.push("errors_while_computing_flags");
            var a2, u3 = !(null == (i2 = e3.json) || null == (i2 = i2.quotaLimited) || !i2.includes("feature_flags"));
            if (u3 && o3.push("quota_limited"), null == (r3 = this._persistence) || r3.register({ [V]: o3 }), u3) dl.warn("You have hit your feature flags quota limit, and will not be able to load feature flags until the quota is reset.  Please visit https://posthog.com/docs/billing/limits-alerts to learn more.");
            else n2.disable_flags || this.receivedFeatureFlags(null !== (a2 = e3.json) && void 0 !== a2 ? a2 : {}, s3, { partialResponse: l2 }), this._additionalReloadRequested && (this._additionalReloadRequested = false, this._callFlagsEndpoint());
          }
        } });
      }
    }
    _hasStatusZeroCircuitBreakerTripped() {
      return on(this._consecutiveStatusZeroFailures, 3);
    }
    _trackStatusZeroReachability(e2) {
      this._consecutiveStatusZeroFailures = an(e2, this._consecutiveStatusZeroFailures, 3, (() => dl.warn("Feature flag requests are failing before receiving an HTTP response; this can happen due to network issues, CORS, browser blocking, or ad blockers. Stopped refreshing feature flags; will try again when connectivity changes.")));
    }
    getFeatureFlag(e2, t2) {
      var i2;
      if (void 0 === t2 && (t2 = {}), !t2.fresh || this._flagsLoadedFromRemote) if (this._hasLoadedFlags || this.getFlags() && this.getFlags().length > 0) {
        if (!this._checkAndTriggerStaleRefresh()) {
          var r2 = this.getFeatureFlagResult(e2, t2);
          return null !== (i2 = null == r2 ? void 0 : r2.variant) && void 0 !== i2 ? i2 : null == r2 ? void 0 : r2.enabled;
        }
      } else dl.warn('getFeatureFlag for key "' + e2 + hl);
    }
    getFeatureFlagDetails(e2) {
      return this.getFlagsWithDetails()[e2];
    }
    getFeatureFlagPayload(e2) {
      var t2 = this.getFeatureFlagResult(e2, { send_event: false });
      return null == t2 ? void 0 : t2.payload;
    }
    getFeatureFlagResult(e2, t2) {
      if (void 0 === t2 && (t2 = {}), !t2.fresh || this._flagsLoadedFromRemote) if (this._hasLoadedFlags || this.getFlags() && this.getFlags().length > 0) {
        if (!this._checkAndTriggerStaleRefresh()) {
          var i2 = this.getFlagVariants(), r2 = e2 in i2, s2 = i2[e2], n2 = this.getFlagPayloads()[e2], o2 = String(s2), a2 = this._prop(M) || void 0, l2 = this._prop(W) || void 0, u2 = this._prop(z) || {};
          if (this._config.advanced_feature_flags_dedup_per_session) {
            var c2, d2 = this._instance.get_session_id(), _2 = this._prop(j);
            d2 && d2 !== _2 && (u2 = {}, null == (c2 = this._persistence) || c2.register({ [z]: u2, [j]: d2 }));
          }
          if ((t2.send_event || !("send_event" in t2)) && (!(e2 in u2) || !u2[e2].includes(o2))) {
            var h2, p2, g2, v2, f2, m2, y2, b2, w2, S2, E2;
            Xe(u2[e2]) ? u2[e2].push(o2) : u2[e2] = [o2], null == (h2 = this._persistence) || h2.register({ [z]: u2 });
            var x2 = this.getFeatureFlagDetails(e2), k2 = [...null !== (p2 = this._prop(V)) && void 0 !== p2 ? p2 : []];
            rt(s2) && k2.push("flag_missing");
            var P2 = { $feature_flag: e2, $feature_flag_response: s2, $feature_flag_payload: n2 || null, $feature_flag_request_id: a2, $feature_flag_evaluated_at: l2, $feature_flag_bootstrapped_response: (null == (g2 = this._config.bootstrap) || null == (g2 = g2.featureFlags) ? void 0 : g2[e2]) || null, $feature_flag_bootstrapped_payload: (null == (v2 = this._config.bootstrap) || null == (v2 = v2.featureFlagPayloads) ? void 0 : v2[e2]) || null, $used_bootstrap_value: !this._flagsLoadedFromRemote };
            rt(null == x2 || null == (f2 = x2.metadata) ? void 0 : f2.has_experiment) || (P2.$feature_flag_has_experiment = x2.metadata.has_experiment), rt(null == x2 || null == (m2 = x2.metadata) ? void 0 : m2.version) || (P2.$feature_flag_version = x2.metadata.version);
            var I2, C2 = null !== (y2 = null == x2 || null == (b2 = x2.reason) ? void 0 : b2.description) && void 0 !== y2 ? y2 : null == x2 || null == (w2 = x2.reason) ? void 0 : w2.code;
            C2 && (P2.$feature_flag_reason = C2), null != x2 && null != (S2 = x2.metadata) && S2.id && (P2.$feature_flag_id = x2.metadata.id), rt(null == x2 ? void 0 : x2.original_variant) && rt(null == x2 ? void 0 : x2.original_enabled) || (P2.$feature_flag_original_response = rt(x2.original_variant) ? x2.original_enabled : x2.original_variant), null != x2 && null != (E2 = x2.metadata) && E2.original_payload && (P2.$feature_flag_original_payload = null == x2 || null == (I2 = x2.metadata) ? void 0 : I2.original_payload), k2.length && (P2.$feature_flag_error = k2.join(",")), this._instance.capture("$feature_flag_called", P2);
          }
          if (r2) return { key: e2, enabled: !!s2, variant: "string" == typeof s2 ? s2 : void 0, payload: Te(n2) };
        }
      } else dl.warn('getFeatureFlagResult for key "' + e2 + hl);
    }
    getRemoteConfigPayload(e2, t2) {
      var i2 = this._config.token, r2 = { distinct_id: this._instance.get_distinct_id(), token: i2 };
      this._shouldIncludeEvaluationEnvironments() && (r2.evaluation_contexts = this._getValidEvaluationEnvironments());
      var s2 = this._getValidFlagKeys();
      rt(s2) || (r2.flag_keys = s2), this._instance._send_request({ method: "POST", url: this._instance.requestRouter.endpointFor("flags", "/flags/?v=2"), data: r2, compression: this._config.disable_compression ? void 0 : Wn.Base64, timeout: this._config.feature_flag_request_timeout_ms, callback(i3) {
        var r3, s3 = null == (r3 = i3.json) ? void 0 : r3.featureFlagPayloads;
        t2((null == s3 ? void 0 : s3[e2]) || void 0);
      } });
    }
    isFeatureEnabled(e2, t2) {
      if (void 0 === t2 && (t2 = {}), !t2.fresh || this._flagsLoadedFromRemote) {
        if (this._hasLoadedFlags || this.getFlags() && this.getFlags().length > 0) {
          var i2 = this.getFeatureFlag(e2, t2);
          return rt(i2) ? void 0 : !!i2;
        }
        dl.warn('isFeatureEnabled for key "' + e2 + hl);
      }
    }
    addFeatureFlagsHandler(e2) {
      this.featureFlagEventHandlers.push(e2);
    }
    removeFeatureFlagsHandler(e2) {
      this.featureFlagEventHandlers = this.featureFlagEventHandlers.filter(((t2) => t2 !== e2));
    }
    receivedFeatureFlags(e2, t2, r2) {
      if (this._persistence) {
        this._hasLoadedFlags = true;
        var s2 = this.getFlagVariants(), n2 = this.getFlagPayloads(), o2 = this.getFlagsWithDetails();
        !(function(e3, t3, r3, s3, n3, o3) {
          void 0 === r3 && (r3 = {}), void 0 === s3 && (s3 = {}), void 0 === n3 && (n3 = {});
          var a2 = ((e4) => {
            var t4 = e4.flags;
            return t4 ? (e4.featureFlags = Object.fromEntries(Object.keys(t4).map(((e5) => {
              var i2;
              return [e5, null !== (i2 = t4[e5].variant) && void 0 !== i2 ? i2 : t4[e5].enabled];
            }))), e4.featureFlagPayloads = Object.fromEntries(Object.keys(t4).filter(((e5) => t4[e5].enabled)).filter(((e5) => {
              var i2;
              return null == (i2 = t4[e5].metadata) ? void 0 : i2.payload;
            })).map(((e5) => {
              var i2;
              return [e5, null == (i2 = t4[e5].metadata) ? void 0 : i2.payload];
            })))) : e4.featureFlags && dl.warn("Using an older version of the feature flags endpoint. Please upgrade your PostHog server to the latest version"), e4;
          })(e3), l2 = a2.flags, u2 = a2.featureFlags, c2 = a2.featureFlagPayloads;
          if (u2) {
            var d2 = e3.requestId, _2 = e3.evaluatedAt;
            if (Xe(u2)) {
              dl.warn("v1 of the feature flags endpoint is deprecated. Please use the latest version.");
              var h2 = {};
              if (u2) for (var p2 = 0; u2.length > p2; p2++) h2[u2[p2]] = true;
              t3 && t3.register({ [T]: u2, [C]: h2 });
            } else {
              var g2 = u2, v2 = c2, f2 = l2;
              if (null != o3 && o3.partialResponse) g2 = i({}, r3, g2), v2 = i({}, s3, v2), f2 = i({}, n3, f2);
              else if (e3.errorsWhileComputingFlags) if (l2) {
                var m2 = new Set(Object.keys(l2).filter(((e4) => {
                  var t4;
                  return !(null != (t4 = l2[e4]) && t4.failed);
                })));
                g2 = i({}, r3, Object.fromEntries(Object.entries(g2).filter(((e4) => m2.has(e4[0]))))), v2 = i({}, s3, Object.fromEntries(Object.entries(v2 || {}).filter(((e4) => m2.has(e4[0]))))), f2 = i({}, n3, Object.fromEntries(Object.entries(f2 || {}).filter(((e4) => m2.has(e4[0])))));
              } else g2 = i({}, r3, g2), v2 = i({}, s3, v2), f2 = i({}, n3, f2);
              t3 && t3.register(i({ [T]: Object.keys(gl(g2)), [C]: g2 || {}, [L]: v2 || {}, [R]: f2 || {} }, d2 ? { [M]: d2 } : {}, _2 ? { [W]: _2 } : {}));
            }
          }
        })(e2, this._persistence, s2, n2, o2, r2), t2 || (this._staleCacheRefreshTriggered = false), this._fireFeatureFlagsCallbacks(t2);
      }
    }
    override(e2, t2) {
      void 0 === t2 && (t2 = false), dl.warn("override is deprecated. Please use overrideFeatureFlags instead."), this.overrideFeatureFlags({ flags: e2, suppressWarning: t2 });
    }
    overrideFeatureFlags(e2) {
      if (!this._instance.__loaded || !this._persistence) return dl.uninitializedWarning("posthog.featureFlags.overrideFeatureFlags");
      if (false === e2) return this._persistence.unregister(A), this._persistence.unregister(O), this._fireFeatureFlagsCallbacks(), _l.info("All overrides cleared");
      if (Xe(e2)) {
        var t2 = pl(e2);
        return this._persistence.register({ [A]: t2 }), this._fireFeatureFlagsCallbacks(), _l.info("Flag overrides set", { flags: e2 });
      }
      if (e2 && "object" == typeof e2 && ("flags" in e2 || "payloads" in e2)) {
        var i2, r2 = e2;
        if (this._override_warning = Boolean(null !== (i2 = r2.suppressWarning) && void 0 !== i2 && i2), "flags" in r2) {
          if (false === r2.flags) this._persistence.unregister(A), _l.info("Flag overrides cleared");
          else if (r2.flags) {
            if (Xe(r2.flags)) {
              var s2 = pl(r2.flags);
              this._persistence.register({ [A]: s2 });
            } else this._persistence.register({ [A]: r2.flags });
            _l.info("Flag overrides set", { flags: r2.flags });
          }
        }
        return "payloads" in r2 && (false === r2.payloads ? (this._persistence.unregister(O), _l.info("Payload overrides cleared")) : r2.payloads && (this._persistence.register({ [O]: r2.payloads }), _l.info("Payload overrides set", { payloads: r2.payloads }))), void this._fireFeatureFlagsCallbacks();
      }
      if (e2 && "object" == typeof e2) return this._persistence.register({ [A]: e2 }), this._fireFeatureFlagsCallbacks(), _l.info("Flag overrides set", { flags: e2 });
      dl.warn("Invalid overrideOptions provided to overrideFeatureFlags", { overrideOptions: e2 });
    }
    onFeatureFlags(e2) {
      if (this.addFeatureFlagsHandler(e2), this._hasLoadedFlags) {
        var t2 = this._prepareFeatureFlagsForCallbacks(), i2 = t2.flags, r2 = t2.flagVariants;
        try {
          e2(i2, r2);
        } catch (e3) {
          dl.error("Error while running feature flags callback", e3);
        }
      }
      return () => this.removeFeatureFlagsHandler(e2);
    }
    updateEarlyAccessFeatureEnrollment(e2, t2, r2) {
      var s2, n2 = (this._prop(F) || []).find(((t3) => t3.flagKey === e2)), o2 = { ["$feature_enrollment/" + e2]: t2 }, a2 = { $feature_flag: e2, $feature_enrollment: t2, $set: o2 };
      n2 && (a2.$early_access_feature_name = n2.name), r2 && (a2.$feature_enrollment_stage = r2), this._instance.capture("$feature_enrollment_update", a2), this.setPersonPropertiesForFlags(o2, false);
      var l2 = i({}, this.getFlagVariants(), { [e2]: t2 });
      null == (s2 = this._persistence) || s2.register({ [T]: Object.keys(gl(l2)), [C]: l2 }), this._fireFeatureFlagsCallbacks();
    }
    getEarlyAccessFeatures(e2, t2, i2) {
      void 0 === t2 && (t2 = false);
      var r2 = this._prop(F), s2 = i2 ? "&" + i2.map(((e3) => "stage=" + e3)).join("&") : "";
      if (r2 && !t2) return e2(r2);
      this._instance._send_request({ url: this._instance.requestRouter.endpointFor("api", "/api/early_access_features/?token=" + this._config.token + s2), method: "GET", callback: (t3) => {
        var i3, r3;
        if (t3.json) {
          var s3 = t3.json.earlyAccessFeatures;
          return null == (i3 = this._persistence) || i3.unregister(F), null == (r3 = this._persistence) || r3.register({ [F]: s3 }), e2(s3);
        }
      } });
    }
    _prepareFeatureFlagsForCallbacks() {
      var e2 = this.getFlags(), t2 = this.getFlagVariants();
      return { flags: e2.filter(((e3) => t2[e3])), flagVariants: Object.keys(t2).filter(((e3) => t2[e3])).reduce(((e3, i2) => (e3[i2] = t2[i2], e3)), {}) };
    }
    _fireFeatureFlagsCallbacks(e2) {
      var t2 = this._prepareFeatureFlagsForCallbacks(), i2 = t2.flags, r2 = t2.flagVariants;
      this.featureFlagEventHandlers.forEach(((t3) => {
        try {
          t3(i2, r2, { errorsLoading: e2 });
        } catch (e3) {
          dl.error("Error while running feature flags callback", e3);
        }
      }));
    }
    setPersonPropertiesForFlags(e2, t2) {
      void 0 === t2 && (t2 = true);
      var r2 = this._prop(D) || {}, s2 = (null == e2 ? void 0 : e2.$set) || (null != e2 && e2.$set_once ? {} : e2), n2 = null == e2 ? void 0 : e2.$set_once, o2 = {};
      if (n2) for (var a2 in n2) ({}).hasOwnProperty.call(n2, a2) && (a2 in r2 || (o2[a2] = n2[a2]));
      this._instance.register({ [D]: i({}, r2, o2, s2) }), t2 && this._instance.reloadFeatureFlags();
    }
    unsetPersonPropertiesForFlags(e2, t2) {
      void 0 === t2 && (t2 = true);
      var r2 = i({}, this._prop(D) || {});
      e2.forEach(((e3) => {
        delete r2[e3];
      })), this._instance.register({ [D]: r2 }), t2 && this._instance.reloadFeatureFlags();
    }
    resetPersonPropertiesForFlags(e2) {
      void 0 === e2 && (e2 = true), this._instance.unregister(D), e2 && this._instance.reloadFeatureFlags();
    }
    setGroupPropertiesForFlags(e2, t2) {
      void 0 === t2 && (t2 = true);
      var r2 = this._prop(N) || {};
      0 !== Object.keys(r2).length && Object.keys(r2).forEach(((t3) => {
        r2[t3] = i({}, r2[t3], e2[t3]), delete e2[t3];
      })), this._instance.register({ [N]: i({}, r2, e2) }), t2 && this._instance.reloadFeatureFlags();
    }
    resetGroupPropertiesForFlags(e2) {
      if (e2) {
        var t2 = this._prop(N) || {};
        this._instance.register({ [N]: i({}, t2, { [e2]: {} }) });
      } else this._instance.unregister(N);
    }
    reset() {
      this._hasLoadedFlags = false, this._requestInFlight = false, this._reloadingDisabled = false, this._additionalReloadRequested = false, this._flagsLoadedFromRemote = false, this.$anon_distinct_id = void 0, this._clearDebouncer(), this._override_warning = false, this._consecutiveStatusZeroFailures = 0;
    }
  } };
  var xl = { sessionRecording: class {
    get _config() {
      return this._instance.config;
    }
    get _persistence() {
      return this._instance.persistence;
    }
    get started() {
      var e2;
      return !(null == (e2 = this._lazyLoadedSessionRecording) || !e2.isStarted);
    }
    get status() {
      var e2, t2;
      return this._recordingStatus === Va || this._recordingStatus === Wa ? this._recordingStatus : null !== (e2 = null == (t2 = this._lazyLoadedSessionRecording) ? void 0 : t2.status) && void 0 !== e2 ? e2 : this._recordingStatus;
    }
    constructor(e2) {
      if (this._forceAllowLocalhostNetworkCapture = false, this._recordingStatus = za, this._persistFlagsOnSessionListener = void 0, this._instance = e2, !this._instance.sessionManager) throw Qa.error("started without valid sessionManager"), new Error(Ga + " started without valid sessionManager. This is a bug.");
      if (this._config.cookieless_mode === ae) throw new Error(Ga + ' cannot be used with cookieless_mode="always"');
    }
    initialize() {
      this.startIfEnabledOrStop();
    }
    get _isRecordingEnabled() {
      var e2, t2 = !(null == (e2 = this._instance.get_property(b)) || !e2.enabled), i2 = !this._config.disable_session_recording, r2 = this._config.disable_session_recording || this._instance.consent.isOptedOut();
      return fe && t2 && i2 && !r2;
    }
    startIfEnabledOrStop(e2) {
      var t2;
      if (!this._isRecordingEnabled || null == (t2 = this._lazyLoadedSessionRecording) || !t2.isStarted) {
        var i2 = !rt(Object.assign) && !rt(Array.from);
        this._isRecordingEnabled && i2 ? (this._lazyLoadAndStart(e2), Qa.info("starting")) : (this._recordingStatus = za, this.stopRecording());
      }
    }
    _lazyLoadAndStart(e2) {
      var t2, i2, r2;
      this._isRecordingEnabled && (this._recordingStatus !== Va && this._recordingStatus !== Wa && (this._recordingStatus = ja), null != Ie && null != (t2 = Ie.__PosthogExtensions__) && null != (t2 = t2.rrweb) && t2.record && null != (i2 = Ie.__PosthogExtensions__) && i2.initSessionRecording ? this._onScriptLoaded(e2) : null == (r2 = Ie.__PosthogExtensions__) || null == r2.loadExternalDependency || r2.loadExternalDependency(this._instance, this._scriptName, ((t3) => {
        if (t3) return Qa.error("could not load recorder", t3);
        this._onScriptLoaded(e2);
      })));
    }
    stopRecording() {
      var e2, t2;
      null == (e2 = this._persistFlagsOnSessionListener) || e2.call(this), this._persistFlagsOnSessionListener = void 0, null == (t2 = this._lazyLoadedSessionRecording) || t2.stop();
    }
    _discardRecording() {
      var e2, t2;
      null == (e2 = this._persistFlagsOnSessionListener) || e2.call(this), this._persistFlagsOnSessionListener = void 0, null == (t2 = this._lazyLoadedSessionRecording) || t2.discard();
    }
    _resetSampling() {
      var e2, t2;
      null == (e2 = this._persistence) || e2.unregister(I), null == (t2 = this._persistence) || t2.unregister(w);
    }
    _validateSampleRate(e2, t2) {
      if (at(e2)) return null;
      var i2, r2 = lt(e2) ? e2 : parseFloat(e2);
      return "number" != typeof (i2 = r2) || !Number.isFinite(i2) || 0 > i2 || i2 > 1 ? (Qa.warn(t2 + " must be between 0 and 1. Ignoring invalid value:", e2), null) : r2;
    }
    _persistRemoteConfig(e2) {
      if (this._persistence) {
        var t2, r2, s2 = this._persistence, n2 = () => {
          var t3, r3 = false === e2.sessionRecording ? void 0 : e2.sessionRecording, n3 = this._validateSampleRate(null == (t3 = this._config.session_recording) ? void 0 : t3.sampleRate, "session_recording.sampleRate"), o2 = this._validateSampleRate(null == r3 ? void 0 : r3.sampleRate, "remote config sampleRate"), a2 = null != n3 ? n3 : o2;
          at(a2) && this._resetSampling();
          var l2 = null == r3 ? void 0 : r3.minimumDurationMilliseconds;
          s2.register({ [b]: i({ cache_timestamp: Date.now(), enabled: !!r3 }, r3, { networkPayloadCapture: i({ capturePerformance: e2.capturePerformance }, null == r3 ? void 0 : r3.networkPayloadCapture), canvasRecording: { enabled: null == r3 ? void 0 : r3.recordCanvas, fps: null == r3 ? void 0 : r3.canvasFps, quality: null == r3 ? void 0 : r3.canvasQuality }, sampleRate: a2, minimumDurationMilliseconds: rt(l2) ? null : l2, endpoint: null == r3 ? void 0 : r3.endpoint, triggerMatchType: null == r3 ? void 0 : r3.triggerMatchType, masking: null == r3 ? void 0 : r3.masking, urlTriggers: null == r3 ? void 0 : r3.urlTriggers, version: null == r3 ? void 0 : r3.version, triggerGroups: null == r3 ? void 0 : r3.triggerGroups }) });
        };
        n2(), null == (t2 = this._persistFlagsOnSessionListener) || t2.call(this), this._persistFlagsOnSessionListener = null == (r2 = this._instance.sessionManager) ? void 0 : r2.onSessionId(n2);
      }
    }
    onRemoteConfig(e2) {
      return "sessionRecording" in e2 ? false === e2.sessionRecording ? (this._persistRemoteConfig(e2), void this._discardRecording()) : (this._persistRemoteConfig(e2), void this.startIfEnabledOrStop()) : (this._recordingStatus === Va && (this._recordingStatus = Wa, Qa.warn("config refresh failed, recording will not start until page reload")), void this.startIfEnabledOrStop());
    }
    log(e2, t2) {
      var i2;
      void 0 === t2 && (t2 = "log"), null != (i2 = this._lazyLoadedSessionRecording) && i2.log ? this._lazyLoadedSessionRecording.log(e2, t2) : Qa.warn("log called before recorder was ready");
    }
    get _scriptName() {
      var e2, t2, i2 = null == (e2 = this._instance) || null == (e2 = e2.persistence) ? void 0 : e2.get_property(b);
      return (null == i2 || null == (t2 = i2.scriptConfig) ? void 0 : t2.script) || "lazy-recorder";
    }
    _isRemoteConfigFresh() {
      var e2, t2, i2 = this._instance.get_property(b);
      if (!i2) return false;
      try {
        t2 = "object" == typeof i2 ? i2 : JSON.parse(i2);
      } catch (e3) {
        return Qa.warn("persisted remote config for session recording is invalid and will be ignored", e3), false;
      }
      var r2 = null !== (e2 = t2.cache_timestamp) && void 0 !== e2 ? e2 : Date.now();
      return 36e5 >= Date.now() - r2;
    }
    _onScriptLoaded(e2) {
      var t2, i2;
      if (null == (t2 = Ie.__PosthogExtensions__) || !t2.initSessionRecording) return Qa.warn("Called on script loaded before session recording is available. This can be caused by adblockers."), void this._instance.register_for_session({ [se]: true });
      if (this._lazyLoadedSessionRecording || (this._lazyLoadedSessionRecording = null == (i2 = Ie.__PosthogExtensions__) ? void 0 : i2.initSessionRecording(this._instance), this._lazyLoadedSessionRecording._forceAllowLocalhostNetworkCapture = this._forceAllowLocalhostNetworkCapture), !this._isRemoteConfigFresh()) {
        if (this._recordingStatus === Wa || this._recordingStatus === Va) return;
        return this._recordingStatus = Va, Qa.info("persisted remote config is stale, requesting fresh config before starting"), void new jn(this._instance).load();
      }
      this._recordingStatus = ja, this._lazyLoadedSessionRecording.start(e2);
    }
    onRRwebEmit(e2) {
      var t2;
      null == (t2 = this._lazyLoadedSessionRecording) || null == t2.onRRwebEmit || t2.onRRwebEmit(e2);
    }
    overrideLinkedFlag() {
      var e2, t2;
      this._lazyLoadedSessionRecording || null == (t2 = this._persistence) || t2.register({ [E]: true }), null == (e2 = this._lazyLoadedSessionRecording) || e2.overrideLinkedFlag();
    }
    overrideSampling() {
      var e2, t2;
      this._lazyLoadedSessionRecording || null == (t2 = this._persistence) || t2.register({ [S]: true }), null == (e2 = this._lazyLoadedSessionRecording) || e2.overrideSampling();
    }
    overrideTrigger(e2) {
      var t2, i2;
      this._lazyLoadedSessionRecording || null == (i2 = this._persistence) || i2.register({ ["url" === e2 ? x : k]: true }), null == (t2 = this._lazyLoadedSessionRecording) || t2.overrideTrigger(e2);
    }
    get sdkDebugProperties() {
      var e2;
      return (null == (e2 = this._lazyLoadedSessionRecording) ? void 0 : e2.sdkDebugProperties) || { $recording_status: this.status };
    }
    tryAddCustomEvent(e2, t2) {
      var i2;
      return !(null == (i2 = this._lazyLoadedSessionRecording) || !i2.tryAddCustomEvent(e2, t2));
    }
  } };
  var kl = { autocapture: class {
    constructor(e2) {
      this._initialized = false, this._isDisabledServerSide = null, this._elementsChainAsString = false, this.instance = e2, this.rageclicks = new La(e2.config.rageclick), this._elementSelectors = null;
    }
    initialize() {
      this.startIfEnabled();
    }
    get _config() {
      var e2, t2, i2 = tt(this.instance.config.autocapture) ? this.instance.config.autocapture : {};
      return i2.url_allowlist = null == (e2 = i2.url_allowlist) ? void 0 : e2.map(((e3) => new RegExp(e3))), i2.url_ignorelist = null == (t2 = i2.url_ignorelist) ? void 0 : t2.map(((e3) => new RegExp(e3))), i2;
    }
    _addDomEventHandlers() {
      if (this.isBrowserSupported()) {
        if (fe && be) {
          var e2 = (e3) => {
            e3 = e3 || (null == fe ? void 0 : fe.event);
            try {
              this._captureEvent(e3);
            } catch (e4) {
              Aa.error("Failed to capture event", e4);
            }
          };
          if (Or(be, "submit", e2, { capture: true }), Or(be, "change", e2, { capture: true }), Or(be, "click", e2, { capture: true }), this._config.capture_copied_text) {
            var t2 = (e3) => {
              e3 = e3 || (null == fe ? void 0 : fe.event);
              try {
                this._captureEvent(e3, Ma);
              } catch (e4) {
                Aa.error("Failed to capture copy/cut event", e4);
              }
            };
            Or(be, "copy", t2, { capture: true }), Or(be, "cut", t2, { capture: true });
          }
        }
      } else Aa.info("Disabling Automatic Event Collection because this browser is not supported");
    }
    startIfEnabled() {
      this.isEnabled && !this._initialized && (this._addDomEventHandlers(), this._initialized = true);
    }
    onRemoteConfigFailed() {
      this.startIfEnabled();
    }
    onRemoteConfig(e2) {
      e2.elementsChainAsString && (this._elementsChainAsString = e2.elementsChainAsString), this.instance.persistence && this.instance.persistence.register({ [d]: !!e2.autocapture_opt_out }), this._isDisabledServerSide = !!e2.autocapture_opt_out, this.startIfEnabled();
    }
    setElementSelectors(e2) {
      this._elementSelectors = e2;
    }
    getElementSelectors(e2) {
      var t2, i2 = [];
      return null == (t2 = this._elementSelectors) || t2.forEach(((t3) => {
        var r2 = null == be ? void 0 : be.querySelectorAll(t3);
        null == r2 || r2.forEach(((r3) => {
          e2 === r3 && i2.push(t3);
        }));
      })), i2;
    }
    get isEnabled() {
      var e2, t2, i2 = null == (e2 = this.instance.persistence) ? void 0 : e2.props[d];
      if (ot(this._isDisabledServerSide) && !ct(i2) && !this.instance._shouldDisableFlags()) return false;
      var r2 = null !== (t2 = this._isDisabledServerSide) && void 0 !== t2 ? t2 : !!i2;
      return !!this.instance.config.autocapture && !r2;
    }
    _captureEvent(e2, t2) {
      if (void 0 === t2 && (t2 = "$autocapture"), this.isEnabled) {
        var i2, r2 = vs(e2);
        ls(r2) && (r2 = r2.parentNode || null), "$autocapture" === t2 && "click" === e2.type && e2 instanceof MouseEvent && this.instance.config.rageclick && null != (i2 = this.rageclicks) && i2.isRageClick(e2.clientX, e2.clientY, e2.timeStamp || (/* @__PURE__ */ new Date()).getTime()) && Ps(r2, this.instance.config.rageclick) && this._captureEvent(e2, "$rageclick");
        var s2 = t2 === Ma;
        if (r2 && (function(e3, t3, i3, r3, s3, n3) {
          var o3, a3, l3, u3, c3, d2;
          if (void 0 === i3 && (i3 = void 0), !fe || Is(e3)) return false;
          if (null != (o3 = i3) && o3.url_allowlist && !_s(i3.url_allowlist, n3)) return false;
          if (null != (a3 = i3) && a3.url_ignorelist && _s(i3.url_ignorelist, n3)) return false;
          if (null != (l3 = i3) && l3.dom_event_allowlist) {
            var _2 = i3.dom_event_allowlist;
            if (_2 && !_2.some(((e4) => t3.type === e4))) return false;
          }
          var h2 = Cs(e3, r3), p2 = h2.parentIsUsefulElement, g2 = h2.targetElementList;
          if (!(function(e4, t4) {
            var i4 = null == t4 ? void 0 : t4.element_allowlist;
            if (rt(i4)) return true;
            var r4, s4 = function(e5) {
              if (i4.some(((t5) => e5.tagName.toLowerCase() === t5))) return { v: true };
            };
            for (var n4 of e4) if (r4 = s4(n4)) return r4.v;
            return false;
          })(g2, i3)) return false;
          if (!ms(g2, null == (u3 = i3) ? void 0 : u3.css_selector_allowlist)) return false;
          if (ms(g2, null !== (c3 = null == (d2 = i3) ? void 0 : d2.css_selector_ignorelist) && void 0 !== c3 ? c3 : bs)) return false;
          try {
            var v2 = fe.getComputedStyle(e3);
            if (v2 && "pointer" === v2.getPropertyValue("cursor") && "click" === t3.type) return true;
          } catch (e4) {
          }
          var f2 = e3.tagName.toLowerCase();
          switch (f2) {
            case "html":
              return false;
            case "form":
              return (s3 || ["submit"]).indexOf(t3.type) >= 0;
            case "input":
            case "select":
            case "textarea":
              return (s3 || ["change", "click"]).indexOf(t3.type) >= 0;
            default:
              return p2 ? (s3 || ["click"]).indexOf(t3.type) >= 0 : (s3 || ["click"]).indexOf(t3.type) >= 0 && (fs.indexOf(f2) > -1 || "true" === e3.getAttribute("contenteditable"));
          }
        })(r2, e2, this._config, s2, s2 ? ["copy", "cut"] : void 0, this.instance)) {
          var n2 = Da(r2, { e: e2, maskAllElementAttributes: this.instance.config.mask_all_element_attributes, maskAllText: this.instance.config.mask_all_text, elementAttributeIgnoreList: this._config.element_attribute_ignorelist, elementsChainAsString: this._elementsChainAsString, disableCaptureUrlHashes: this.instance.config.disable_capture_url_hashes }), o2 = n2.props;
          if (n2.explicitNoCapture) return false;
          var a2 = this.getElementSelectors(r2);
          if (a2 && a2.length > 0 && (o2.$element_selectors = a2), t2 === Ma) {
            var l2, u2 = ps(null == fe || null == (l2 = fe.getSelection()) ? void 0 : l2.toString()), c2 = e2.type || "clipboard";
            if (!u2) return false;
            o2.$selected_content = u2, o2.$copy_type = c2;
          }
          return this.instance.capture(t2, o2), true;
        }
      }
    }
    isBrowserSupported() {
      return et(null == be ? void 0 : be.querySelectorAll);
    }
  }, historyAutocapture: class {
    constructor(e2) {
      var t2;
      this._instance = e2, this._lastPathname = (null == fe || null == (t2 = fe.location) ? void 0 : t2.pathname) || "";
    }
    initialize() {
      this.startIfEnabled();
    }
    get isEnabled() {
      return "history_change" === this._instance.config.capture_pageview;
    }
    startIfEnabled() {
      this.isEnabled && (xr.info("History API monitoring enabled, starting..."), this.monitorHistoryChanges());
    }
    stop() {
      this._popstateListener && this._popstateListener(), this._popstateListener = void 0, xr.info("History API monitoring stopped");
    }
    monitorHistoryChanges() {
      fe && fe.history && (this._patchHistoryMethod("pushState"), this._patchHistoryMethod("replaceState"), this._setupPopstateListener());
    }
    _patchHistoryMethod(e2) {
      var t2;
      if (fe && (null == (t2 = fe.history[e2]) || !t2.__posthog_wrapped__)) {
        var i2 = this;
        !(function(e3, t3, i3) {
          try {
            if (!(t3 in e3)) return Ba;
            var r2 = { next: e3[t3] }, s2 = i3((function() {
              for (var e4 = arguments.length, t4 = new Array(e4), i4 = 0; e4 > i4; i4++) t4[i4] = arguments[i4];
              return r2.next.apply(this, t4);
            }));
            return et(s2) && (s2.prototype = s2.prototype || {}, Object.defineProperties(s2, { __posthog_wrapped__: { enumerable: false, value: true }, __posthog_layer__: { enumerable: false, value: r2 } })), e3[t3] = s2, () => {
              if (e3[t3] !== s2) for (var i4 = e3[t3]; et(i4) && i4.__posthog_layer__; ) {
                var n2 = i4.__posthog_layer__;
                if (n2.next === s2) return void (n2.next = r2.next);
                i4 = n2.next;
              }
              else e3[t3] = r2.next;
            };
          } catch (e4) {
            return Ba;
          }
        })(fe.history, e2, ((t3) => function(r2, s2, n2) {
          t3.call(this, r2, s2, n2), i2._capturePageview(e2);
        }));
      }
    }
    _capturePageview(e2) {
      try {
        var t2, i2 = null == fe || null == (t2 = fe.location) ? void 0 : t2.pathname;
        if (!i2) return;
        i2 !== this._lastPathname && this.isEnabled && this._instance.capture(he, { navigation_type: e2 }), this._lastPathname = i2;
      } catch (t3) {
        xr.error("Error capturing " + e2 + " pageview", t3);
      }
    }
    _setupPopstateListener() {
      if (!this._popstateListener) {
        var e2 = () => {
          this._capturePageview("popstate");
        };
        Or(fe, "popstate", e2), this._popstateListener = () => {
          fe && fe.removeEventListener("popstate", e2);
        };
      }
    }
  }, heatmaps: class {
    get _config() {
      return this.instance.config;
    }
    constructor(e2) {
      var t2;
      this._enabledServerSide = false, this._initialized = false, this._flushInterval = null, this.instance = e2, this._enabledServerSide = !(null == (t2 = this.instance.persistence) || !t2.props[_]), this.rageclicks = new La(e2.config.rageclick);
    }
    initialize() {
      this.startIfEnabled();
    }
    get flushIntervalMilliseconds() {
      var e2 = 5e3;
      return tt(this._config.capture_heatmaps) && this._config.capture_heatmaps.flush_interval_milliseconds && (e2 = this._config.capture_heatmaps.flush_interval_milliseconds), e2;
    }
    get isEnabled() {
      return at(this._config.capture_heatmaps) ? at(this._config.enable_heatmaps) ? this._enabledServerSide : this._config.enable_heatmaps : false !== this._config.capture_heatmaps;
    }
    startIfEnabled() {
      if (this.isEnabled) {
        if (this._initialized) return;
        Ka.info("starting..."), this._setupListeners(), this._onVisibilityChange();
      } else {
        var e2;
        clearInterval(null !== (e2 = this._flushInterval) && void 0 !== e2 ? e2 : void 0), this._removeListeners(), this.getAndClearBuffer();
      }
    }
    onRemoteConfig(e2) {
      if ("heatmaps" in e2) {
        var t2 = !!e2.heatmaps;
        this.instance.persistence && this.instance.persistence.register({ [_]: t2 }), this._enabledServerSide = t2, this.startIfEnabled();
      }
    }
    getAndClearBuffer() {
      var e2 = this._buffer;
      return this._buffer = void 0, e2;
    }
    _onDeadClick(e2) {
      Ya(e2.originalEvent) && this._onClick(e2.originalEvent, "deadclick");
    }
    _onVisibilityChange() {
      this._flushInterval && clearInterval(this._flushInterval), this._flushInterval = "visible" === (null == be ? void 0 : be.visibilityState) ? setInterval(this._flush.bind(this), this.flushIntervalMilliseconds) : null;
    }
    _setupListeners() {
      fe && be && (this._flushHandler = this._flush.bind(this), Or(fe, _e, this._flushHandler), this._onClickHandler = (e2) => this._onClick(e2 || (null == fe ? void 0 : fe.event)), Or(be, "click", this._onClickHandler, { capture: true }), this._onMouseMoveHandler = (e2) => this._onMouseMove(e2 || (null == fe ? void 0 : fe.event)), Or(be, "mousemove", this._onMouseMoveHandler, { capture: true }), this._deadClicksCapture = new Vs(this.instance, zs, this._onDeadClick.bind(this)), this._deadClicksCapture.startIfEnabledOrStop(), this._onVisibilityChange_handler = this._onVisibilityChange.bind(this), Or(be, de, this._onVisibilityChange_handler), this._initialized = true);
    }
    _removeListeners() {
      var e2;
      fe && be && (this._flushHandler && fe.removeEventListener(_e, this._flushHandler), this._onClickHandler && be.removeEventListener("click", this._onClickHandler, { capture: true }), this._onMouseMoveHandler && be.removeEventListener("mousemove", this._onMouseMoveHandler, { capture: true }), this._onVisibilityChange_handler && be.removeEventListener(de, this._onVisibilityChange_handler), clearTimeout(this._mouseMoveTimeout), null == (e2 = this._deadClicksCapture) || e2.stop(), this._initialized = false);
    }
    _getProperties(e2, t2) {
      var i2 = this.instance.scrollManager.scrollY(), r2 = this.instance.scrollManager.scrollX(), s2 = this.instance.scrollManager.scrollElement(), n2 = (function(e3, t3, i3) {
        for (var r3 = e3; r3 && os(r3) && !as(r3, "body"); ) {
          if (r3 === i3) return false;
          var s3 = void 0;
          try {
            var n3, o2, a2;
            s3 = null == (n3 = null !== (o2 = null == (a2 = r3.ownerDocument) ? void 0 : a2.defaultView) && void 0 !== o2 ? o2 : fe) ? void 0 : n3.getComputedStyle(r3).position;
          } catch (e4) {
            return false;
          }
          if (We(t3, s3)) return true;
          r3 = ys(r3);
        }
        return false;
      })(vs(e2), ["fixed", "sticky"], s2);
      return { x: e2.clientX + (n2 ? 0 : r2), y: e2.clientY + (n2 ? 0 : i2), target_fixed: n2, type: t2 };
    }
    _onClick(e2, t2) {
      var r2;
      if (void 0 === t2 && (t2 = "click"), !ns(e2.target) && Ya(e2)) {
        var s2 = this._getProperties(e2, t2);
        null != (r2 = this.rageclicks) && r2.isRageClick(e2.clientX, e2.clientY, (/* @__PURE__ */ new Date()).getTime()) && Ps(vs(e2), this.instance.config.rageclick) && this._capture(i({}, s2, { type: "rageclick" })), this._capture(s2);
      }
    }
    _onMouseMove(e2) {
      !ns(e2.target) && Ya(e2) && (clearTimeout(this._mouseMoveTimeout), this._mouseMoveTimeout = setTimeout((() => {
        this._capture(this._getProperties(e2, "mousemove"));
      }), 500));
    }
    _capture(e2) {
      if (fe) {
        var t2 = this._config.disable_capture_url_hashes ? Ci(fe.location.href) : fe.location.href, i2 = this._config.custom_personal_data_properties, r2 = this._config.mask_personal_data_properties ? [...un, ...i2 || []] : [], s2 = sn(t2, r2, dn);
        this._buffer = this._buffer || {}, this._buffer[s2] || (this._buffer[s2] = []), this._buffer[s2].push(e2);
      }
    }
    _flush() {
      this._buffer && !it(this._buffer) && this.instance.capture("$$heatmap", { $heatmap_data: this.getAndClearBuffer() });
    }
  }, deadClicksAutocapture: Vs, webVitalsAutocapture: class {
    constructor(e2) {
      var t2;
      this._enabledServerSide = false, this._initialized = false, this._buffer = { url: void 0, metrics: [], firstMetricTimestamp: void 0 }, this._flushToCapture = () => {
        clearTimeout(this._delayedFlushTimer), 0 !== this._buffer.metrics.length && (this._instance.capture("$web_vitals", this._buffer.metrics.reduce(((e3, t3) => i({}, e3, { ["$web_vitals_" + t3.name + "_event"]: i({}, t3), ["$web_vitals_" + t3.name + "_value"]: t3.value })), {})), this._buffer = { url: void 0, metrics: [], firstMetricTimestamp: void 0 });
      }, this._addToBuffer = (e3) => {
        var t3;
        this._buffer = this._buffer || { url: void 0, metrics: [], firstMetricTimestamp: void 0 };
        var r2 = this._currentURL();
        if (!rt(r2)) if (at(null == e3 ? void 0 : e3.name) || at(null == e3 ? void 0 : e3.value)) qa.error("Invalid metric received", e3);
        else if (!this._maxAllowedValue || this._maxAllowedValue > e3.value) {
          this._buffer.url !== r2 && (this._flushToCapture(), this._delayedFlushTimer = setTimeout(this._flushToCapture, this.flushToCaptureTimeoutMs)), rt(this._buffer.url) && (this._buffer.url = r2), this._buffer.firstMetricTimestamp = rt(this._buffer.firstMetricTimestamp) ? Date.now() : this._buffer.firstMetricTimestamp, e3.attribution && e3.attribution.interactionTargetElement && (e3.attribution.interactionTargetElement = void 0);
          var s2 = null == (t3 = this._instance.sessionManager) ? void 0 : t3.checkAndGetSessionAndWindowId(true), n2 = i({}, e3, { $current_url: r2, timestamp: Date.now() });
          rt(s2) || (n2.$session_id = s2.sessionId, n2.$window_id = s2.windowId), this._buffer.metrics.push(n2), this._buffer.metrics.length === this.allowedMetrics.length && this._flushToCapture();
        } else qa.error("Ignoring metric with value >= " + this._maxAllowedValue, e3);
      }, this._startCapturing = () => {
        if (!this._initialized) {
          var e3, t3, i2, r2, s2 = Ie.__PosthogExtensions__;
          if (!rt(s2) && !rt(s2.postHogWebVitalsCallbacks)) {
            var n2 = s2.postHogWebVitalsCallbacks;
            e3 = n2.onLCP, t3 = n2.onCLS, i2 = n2.onFCP, r2 = n2.onINP;
          }
          e3 && t3 && i2 && r2 ? (this.allowedMetrics.indexOf("LCP") > -1 && e3(this._addToBuffer.bind(this)), this.allowedMetrics.indexOf("CLS") > -1 && t3(this._addToBuffer.bind(this)), this.allowedMetrics.indexOf("FCP") > -1 && i2(this._addToBuffer.bind(this)), this.allowedMetrics.indexOf("INP") > -1 && r2(this._addToBuffer.bind(this)), this._initialized = true) : qa.error("web vitals callbacks not loaded - not starting");
        }
      }, this._instance = e2, this._enabledServerSide = !(null == (t2 = this._instance.persistence) || !t2.props[v]), this.startIfEnabled();
    }
    get _perfConfig() {
      return this._instance.config.capture_performance;
    }
    get allowedMetrics() {
      var e2, t2, i2 = tt(this._perfConfig) ? null == (e2 = this._perfConfig) ? void 0 : e2.web_vitals_allowed_metrics : void 0;
      return at(i2) ? (null == (t2 = this._instance.persistence) ? void 0 : t2.props[y]) || ["CLS", "FCP", "INP", "LCP"] : i2;
    }
    get flushToCaptureTimeoutMs() {
      return (tt(this._perfConfig) ? this._perfConfig.web_vitals_delayed_flush_ms : void 0) || 5e3;
    }
    get useAttribution() {
      var e2 = tt(this._perfConfig) ? this._perfConfig.web_vitals_attribution : void 0;
      return null != e2 && e2;
    }
    get _maxAllowedValue() {
      var e2 = tt(this._perfConfig) && lt(this._perfConfig.__web_vitals_max_value) ? this._perfConfig.__web_vitals_max_value : Ha;
      return e2 > 0 && 6e4 >= e2 ? Ha : e2;
    }
    get isEnabled() {
      var e2 = null == we ? void 0 : we.protocol;
      if ("http:" !== e2 && "https:" !== e2) return qa.info("Web Vitals are disabled on non-http/https protocols"), false;
      var t2 = tt(this._perfConfig) ? this._perfConfig.web_vitals : ct(this._perfConfig) ? this._perfConfig : void 0;
      return ct(t2) ? t2 : this._enabledServerSide;
    }
    startIfEnabled() {
      this.isEnabled && !this._initialized && (qa.info("enabled, starting..."), this._loadScript(this._startCapturing));
    }
    onRemoteConfig(e2) {
      if ("capturePerformance" in e2) {
        var t2 = tt(e2.capturePerformance) && !!e2.capturePerformance.web_vitals, i2 = tt(e2.capturePerformance) ? e2.capturePerformance.web_vitals_allowed_metrics : void 0;
        this._instance.persistence && (this._instance.persistence.register({ [v]: t2 }), this._instance.persistence.register({ [y]: i2 })), this._enabledServerSide = t2, this.startIfEnabled();
      }
    }
    _loadScript(e2) {
      var t2, i2;
      null != (t2 = Ie.__PosthogExtensions__) && t2.postHogWebVitalsCallbacks ? e2() : null == (i2 = Ie.__PosthogExtensions__) || null == i2.loadExternalDependency || i2.loadExternalDependency(this._instance, this.useAttribution ? "web-vitals-with-attribution" : "web-vitals", ((t3) => {
        t3 ? qa.error("failed to load script", t3) : e2();
      }));
    }
    _currentURL() {
      var e2 = fe ? this._instance.config.disable_capture_url_hashes ? Ci(fe.location.href) : fe.location.href : void 0;
      if (e2) {
        var t2 = this._instance.config.custom_personal_data_properties, i2 = this._instance.config.mask_personal_data_properties ? [...un, ...t2 || []] : [];
        return sn(e2, i2, dn);
      }
      qa.error("Could not determine current URL");
    }
  } };
  var Pl = { exceptionObserver: class {
    constructor(e2) {
      var t2, r2, s2, n2, o2, a2;
      this._startCapturing = () => {
        var e3;
        if (fe && this.isEnabled && null != (e3 = Ie.__PosthogExtensions__) && e3.errorWrappingFunctions) {
          var t3 = Ie.__PosthogExtensions__.errorWrappingFunctions.wrapOnError, i2 = Ie.__PosthogExtensions__.errorWrappingFunctions.wrapUnhandledRejection, r3 = Ie.__PosthogExtensions__.errorWrappingFunctions.wrapConsoleError;
          try {
            !this._unwrapOnError && this._config.capture_unhandled_errors && (this._unwrapOnError = t3(this.captureException.bind(this))), !this._unwrapUnhandledRejection && this._config.capture_unhandled_rejections && (this._unwrapUnhandledRejection = i2(this.captureException.bind(this))), !this._unwrapConsoleError && this._config.capture_console_errors && (this._unwrapConsoleError = r3(this.captureException.bind(this)));
          } catch (e4) {
            Na.error("failed to start", e4), this._stopCapturing();
          }
        }
      }, this._instance = e2, this._remoteEnabled = !(null == (t2 = this._instance.persistence) || !t2.props[h]), this._rateLimiter = new wt(i({}, (void 0 === (r2 = this._instance.config.error_tracking) && (r2 = {}), { refillRate: null !== (s2 = null !== (n2 = r2.exceptionRateLimiterRefillRate) && void 0 !== n2 ? n2 : r2.__exceptionRateLimiterRefillRate) && void 0 !== s2 ? s2 : 1, bucketSize: null !== (o2 = null !== (a2 = r2.exceptionRateLimiterBucketSize) && void 0 !== a2 ? a2 : r2.__exceptionRateLimiterBucketSize) && void 0 !== o2 ? o2 : 10 }), { refillInterval: 1e4, _logger: Na })), this._config = this._requiredConfig(), this.startIfEnabledOrStop();
    }
    _requiredConfig() {
      var e2 = this._instance.config.capture_exceptions, t2 = { capture_unhandled_errors: false, capture_unhandled_rejections: false, capture_console_errors: false };
      return tt(e2) ? t2 = i({}, t2, e2) : (rt(e2) ? this._remoteEnabled : e2) && (t2 = i({}, t2, { capture_unhandled_errors: true, capture_unhandled_rejections: true })), t2;
    }
    get isEnabled() {
      return this._config.capture_console_errors || this._config.capture_unhandled_errors || this._config.capture_unhandled_rejections;
    }
    startIfEnabledOrStop() {
      this.isEnabled ? (Na.info("enabled"), this._stopCapturing(), this._loadScript(this._startCapturing)) : this._stopCapturing();
    }
    _loadScript(e2) {
      var t2, i2;
      null != (t2 = Ie.__PosthogExtensions__) && t2.errorWrappingFunctions ? e2() : null == (i2 = Ie.__PosthogExtensions__) || null == i2.loadExternalDependency || i2.loadExternalDependency(this._instance, "exception-autocapture", ((t3) => {
        if (t3) return Na.error("failed to load script", t3);
        e2();
      }));
    }
    _stopCapturing() {
      var e2, t2, i2;
      null == (e2 = this._unwrapOnError) || e2.call(this), this._unwrapOnError = void 0, null == (t2 = this._unwrapUnhandledRejection) || t2.call(this), this._unwrapUnhandledRejection = void 0, null == (i2 = this._unwrapConsoleError) || i2.call(this), this._unwrapConsoleError = void 0;
    }
    onRemoteConfig(e2) {
      "autocaptureExceptions" in e2 && (this._remoteEnabled = !!e2.autocaptureExceptions || false, this._instance.persistence && this._instance.persistence.register({ [h]: this._remoteEnabled }), this._config = this._requiredConfig(), this.startIfEnabledOrStop());
    }
    onConfigChange() {
      this._config = this._requiredConfig();
    }
    captureException(e2) {
      var t2, i2, r2, s2 = null !== (t2 = null == e2 || null == (i2 = e2.$exception_list) || null == (i2 = i2[0]) ? void 0 : i2.type) && void 0 !== t2 ? t2 : "Exception";
      this._rateLimiter.consumeRateLimit(s2) ? Na.info("Skipping exception capture because of client rate limiting.", { exception: s2 }) : null == (r2 = this._instance.exceptions) || r2.sendExceptionEvent(e2);
    }
  }, exceptions: class {
    constructor(e2) {
      var t2, r2;
      this._suppressionRules = [], this._errorPropertiesBuilder = new Gi([new nr(), new gr(), new ar(), new or(), new hr(), new _r(), new ur(), new pr()], (function(e3) {
        for (var t3 = arguments.length, r3 = new Array(t3 > 1 ? t3 - 1 : 0), s2 = 1; t3 > s2; s2++) r3[s2 - 1] = arguments[s2];
        return function(t4, s3) {
          void 0 === s3 && (s3 = 0);
          for (var n2 = [], o2 = t4.split("\n"), a2 = s3; o2.length > a2; a2++) {
            var l2 = o2[a2];
            if (1024 >= l2.length) {
              var u2 = sr.test(l2) ? l2.replace(sr, "$1") : l2;
              if (!u2.match(/\S*Error: /)) {
                for (var c2 of r3) {
                  var d2 = c2(u2, e3);
                  if (d2) {
                    n2.push(d2);
                    break;
                  }
                }
                if (n2.length >= 50) break;
              }
            }
          }
          return (function(e4) {
            if (!e4.length) return [];
            var t5 = Array.from(e4);
            return t5.reverse(), t5.slice(0, 50).map(((e5) => {
              return i({}, e5, { filename: e5.filename || (r4 = t5, r4[r4.length - 1] || {}).filename, function: e5.function || Qi });
              var r4;
            }));
          })(n2);
        };
      })("web:javascript", er, rr)), this._instance = e2, this._suppressionRules = null !== (t2 = null == (r2 = this._instance.persistence) ? void 0 : r2.get_property(p)) && void 0 !== t2 ? t2 : [], this._exceptionStepsConfig = br(this._getExceptionStepsConfig()), this._exceptionStepsBuffer = new wr(this._exceptionStepsConfig);
    }
    onConfigChange() {
      this._exceptionStepsConfig = br(this._getExceptionStepsConfig()), this._exceptionStepsBuffer.setConfig(this._exceptionStepsConfig);
    }
    onRemoteConfig(e2) {
      var t2, i2, r2;
      if ("errorTracking" in e2) {
        var s2 = null !== (t2 = null == (i2 = e2.errorTracking) ? void 0 : i2.suppressionRules) && void 0 !== t2 ? t2 : [], n2 = null == (r2 = e2.errorTracking) ? void 0 : r2.captureExtensionExceptions;
        this._suppressionRules = s2, this._instance.persistence && this._instance.persistence.register({ [p]: this._suppressionRules, [g]: n2 });
      }
    }
    get _captureExtensionExceptions() {
      var e2, t2 = !!this._instance.get_property(g), i2 = this._instance.config.error_tracking.captureExtensionExceptions;
      return null !== (e2 = null != i2 ? i2 : t2) && void 0 !== e2 && e2;
    }
    buildProperties(e2, t2) {
      return this._errorPropertiesBuilder.buildFromUnknown(e2, { syntheticException: null == t2 ? void 0 : t2.syntheticException, mechanism: { handled: null == t2 ? void 0 : t2.handled } });
    }
    addExceptionStep(e2, t2) {
      if (this._exceptionStepsConfig.enabled) try {
        if (!st(e2) || 0 === e2.trim().length) return void vl.warn("Ignoring exception step because message must be a non-empty string");
        var r2 = (function(e3) {
          if (!e3) return { sanitizedProperties: {}, droppedKeys: [] };
          var t3 = [];
          return { sanitizedProperties: Object.keys(e3).reduce(((i2, r3) => mr.has(r3) ? (t3.push(r3), i2) : (i2[r3] = e3[r3], i2)), {}), droppedKeys: t3 };
        })(this._coerceExceptionStepProperties(t2)), s2 = r2.sanitizedProperties, n2 = r2.droppedKeys;
        n2.length > 0 && vl.warn("Ignoring reserved exception step fields", { droppedKeys: n2 }), this._exceptionStepsBuffer.add(i({ [vr]: e2, [fr]: (/* @__PURE__ */ new Date()).toISOString() }, s2));
      } catch (e3) {
        vl.error("Failed to add exception step. Ignoring breadcrumb.", e3);
      }
    }
    sendExceptionEvent(e2) {
      try {
        var t2 = e2.$exception_list;
        if (this._isExceptionList(t2)) {
          if (this._matchesSuppressionRule(t2)) return this._addDroppedExceptionStep("Exception dropped: matched a suppression rule"), void vl.info("Skipping exception capture because a suppression rule matched");
          if (!this._captureExtensionExceptions && this._isExtensionException(t2)) return this._addDroppedExceptionStep("Exception dropped: thrown by a browser extension"), void vl.info("Skipping exception capture because it was thrown by an extension");
          if (!this._instance.config.error_tracking.__capturePostHogExceptions && this._isPostHogException(t2)) return this._addDroppedExceptionStep("Exception dropped: thrown by the PostHog SDK"), void vl.info("Skipping exception capture because it was thrown by the PostHog SDK");
        }
        var i2 = this._exceptionStepsConfig.enabled && at(e2.$exception_steps) ? this._addBufferedExceptionSteps(e2) : e2;
        try {
          var r2 = this._instance.capture("$exception", i2, { _noTruncate: true, _batchKey: "exceptionEvent", _originatedFromCaptureException: true });
          return r2 && this._exceptionStepsBuffer.clear(), r2;
        } catch (e3) {
          return vl.error("Failed to capture exception event. Dropping this exception.", e3), void this._exceptionStepsBuffer.clear();
        }
      } catch (e3) {
        return void vl.error("Failed to process exception event. Ignoring this exception.", e3);
      }
    }
    _addBufferedExceptionSteps(e2) {
      try {
        var t2 = this._exceptionStepsBuffer.getAttachable();
        return 0 === t2.length ? e2 : i({}, e2, { $exception_steps: t2 });
      } catch (t3) {
        return vl.error("Failed to read buffered exception steps. Capturing exception without steps.", t3), e2;
      }
    }
    _addDroppedExceptionStep(e2) {
      this._exceptionStepsConfig.enabled && this._exceptionStepsBuffer.add({ [vr]: e2, [fr]: (/* @__PURE__ */ new Date()).toISOString() });
    }
    _coerceExceptionStepProperties(e2) {
      return tt(e2) ? i({}, e2) : {};
    }
    _getExceptionStepsConfig() {
      var e2, t2;
      return null !== (e2 = null == (t2 = this._instance.config.error_tracking) ? void 0 : t2.exception_steps) && void 0 !== e2 ? e2 : {};
    }
    _matchesSuppressionRule(e2) {
      if (0 === e2.length) return false;
      var t2 = e2.reduce(((e3, t3) => {
        var i2 = t3.type, r2 = t3.value;
        return st(i2) && i2.length > 0 && e3.$exception_types.push(i2), st(r2) && r2.length > 0 && e3.$exception_values.push(r2), e3;
      }), { $exception_types: [], $exception_values: [] });
      return this._suppressionRules.some(((e3) => {
        var i2 = e3.values.map(((e4) => {
          var i3, r2 = ia[e4.operator], s2 = Xe(e4.value) ? e4.value : [e4.value], n2 = null !== (i3 = t2[e4.key]) && void 0 !== i3 ? i3 : [];
          return s2.length > 0 && r2(s2, n2);
        }));
        return "OR" === e3.type ? i2.some(Boolean) : i2.every(Boolean);
      }));
    }
    _isExtensionException(e2) {
      return e2.flatMap(((e3) => {
        var t2, i2;
        return null !== (t2 = null == (i2 = e3.stacktrace) ? void 0 : i2.frames) && void 0 !== t2 ? t2 : [];
      })).some(((e3) => e3.filename && e3.filename.startsWith("chrome-extension://")));
    }
    _isPostHogException(e2) {
      if (e2.length > 0) {
        var t2, i2, r2, s2, n2 = null !== (t2 = null == (i2 = e2[0].stacktrace) ? void 0 : i2.frames) && void 0 !== t2 ? t2 : [], o2 = n2[n2.length - 1];
        return null !== (r2 = null == o2 || null == (s2 = o2.filename) ? void 0 : s2.includes("posthog.com/static")) && void 0 !== r2 && r2;
      }
      return false;
    }
    _isExceptionList(e2) {
      return !at(e2) && Xe(e2);
    }
  } };
  var Il = i({ productTours: class {
    get _persistence() {
      return this._instance.persistence;
    }
    constructor(e2) {
      this._productTourManager = null, this._cachedTours = null, this._instance = e2;
    }
    initialize() {
      this.loadIfEnabled();
    }
    onRemoteConfig(e2) {
      if ("productTours" in e2) {
        var t2, i2;
        if (this._persistence && this._persistence.register({ [m]: !!e2.productTours }), !Za(this._instance)) return !this._productTourManager && at(null == (t2 = this._persistence) ? void 0 : t2.props[H]) || Ja.info("product tours disabled; stopping and clearing cached tours"), null == (i2 = this._productTourManager) || i2.stop(), this._productTourManager = null, void this.clearCache();
        this.loadIfEnabled();
      }
    }
    loadIfEnabled() {
      !this._productTourManager && Za(this._instance) && this._loadScript((() => this._startProductTours()));
    }
    _loadScript(e2) {
      var t2, i2;
      null != (t2 = Ie.__PosthogExtensions__) && t2.generateProductTours ? e2() : null == (i2 = Ie.__PosthogExtensions__) || null == i2.loadExternalDependency || i2.loadExternalDependency(this._instance, "product-tours", ((t3) => {
        t3 ? Ja.error("Could not load product tours script", t3) : e2();
      }));
    }
    _startProductTours() {
      var e2;
      !this._productTourManager && null != (e2 = Ie.__PosthogExtensions__) && e2.generateProductTours && (this._productTourManager = Ie.__PosthogExtensions__.generateProductTours(this._instance, true));
    }
    getProductTours(e2, t2) {
      if (void 0 === t2 && (t2 = false), !Xe(this._cachedTours) || t2) {
        var i2 = this._persistence;
        if (i2) {
          var r2 = i2.props[H];
          if (Xe(r2) && !t2) return this._cachedTours = r2, void e2(r2, { isLoaded: true });
        }
        this._instance._send_request({ url: this._instance.requestRouter.endpointFor("api", "/api/product_tours/?token=" + this._instance.config.token), method: "GET", callback: (t3) => {
          if (Za(this._instance)) {
            var r3 = t3.statusCode;
            if (200 !== r3 || !t3.json) {
              var s2 = "Product Tours API could not be loaded, status: " + r3;
              return Ja.error(s2), void e2([], { isLoaded: false, error: s2 });
            }
            var n2 = Xe(t3.json.product_tours) ? t3.json.product_tours : [];
            this._cachedTours = n2, i2 && i2.register({ [H]: n2 }), e2(n2, { isLoaded: true });
          } else e2([], { isLoaded: true });
        } });
      } else e2(this._cachedTours, { isLoaded: true });
    }
    getActiveProductTours(e2) {
      at(this._productTourManager) ? e2([], { isLoaded: false, error: "Product tours not loaded" }) : this._productTourManager.getActiveProductTours(e2);
    }
    showProductTour(e2) {
      var t2;
      null == (t2 = this._productTourManager) || t2.showTourById(e2);
    }
    previewTour(e2) {
      this._productTourManager ? this._productTourManager.previewTour(e2) : this._loadScript((() => {
        var t2;
        this._startProductTours(), null == (t2 = this._productTourManager) || t2.previewTour(e2);
      }));
    }
    dismissProductTour() {
      var e2;
      null == (e2 = this._productTourManager) || e2.dismissTour("user_clicked_skip");
    }
    nextStep() {
      var e2;
      null == (e2 = this._productTourManager) || e2.nextStep();
    }
    previousStep() {
      var e2;
      null == (e2 = this._productTourManager) || e2.previousStep();
    }
    clearCache() {
      var e2;
      this._cachedTours = null, null == (e2 = this._persistence) || e2.unregister(H);
    }
    resetTour(e2) {
      var t2;
      null == (t2 = this._productTourManager) || t2.resetTour(e2);
    }
    resetAllTours() {
      var e2;
      null == (e2 = this._productTourManager) || e2.resetAllTours();
    }
    cancelPendingTour(e2) {
      var t2;
      null == (t2 = this._productTourManager) || t2.cancelPendingTour(e2);
    }
  } }, El);
  var Cl = { siteApps: class {
    constructor(e2) {
      this._siteAppElementPatchCount = 0, this._instance = e2, this._bufferedInvocations = [], this.apps = {};
    }
    get isEnabled() {
      return !!this._instance.config.opt_in_site_apps;
    }
    _eventCollector(e2, t2) {
      if (t2) {
        var i2 = this.globalsForEvent(t2);
        this._bufferedInvocations.push(i2), this._bufferedInvocations.length > 1e3 && (this._bufferedInvocations = this._bufferedInvocations.slice(10));
      }
    }
    get siteAppLoaders() {
      var e2;
      return null == (e2 = Ie._POSTHOG_REMOTE_CONFIG) || null == (e2 = e2[this._instance.config.token]) ? void 0 : e2.siteApps;
    }
    initialize() {
      if (this.isEnabled) {
        var e2 = this._instance._addCaptureHook(this._eventCollector.bind(this));
        this._stopBuffering = () => {
          e2(), this._bufferedInvocations = [], this._stopBuffering = void 0;
        };
      }
    }
    globalsForEvent(e2) {
      var t2, s2, n2, o2, a2, l2, u2;
      if (!e2) throw new Error("Event payload is required");
      var c2 = {}, d2 = this._instance.get_property("$groups") || [], _2 = this._instance.get_property("$stored_group_properties") || {};
      for (var h2 of Object.entries(_2)) {
        var p2 = h2[0];
        c2[p2] = { id: d2[p2], type: p2, properties: h2[1] };
      }
      var g2 = e2.$set_once, v2 = e2.$set;
      return { event: i({}, r(e2, Xa), { properties: i({}, e2.properties, v2 ? { $set: i({}, null !== (t2 = null == (s2 = e2.properties) ? void 0 : s2.$set) && void 0 !== t2 ? t2 : {}, v2) } : {}, g2 ? { $set_once: i({}, null !== (n2 = null == (o2 = e2.properties) ? void 0 : o2.$set_once) && void 0 !== n2 ? n2 : {}, g2) } : {}), elements_chain: null !== (a2 = null == (l2 = e2.properties) ? void 0 : l2.$elements_chain) && void 0 !== a2 ? a2 : "", distinct_id: null == (u2 = e2.properties) ? void 0 : u2.distinct_id }), person: { properties: this._instance.get_property("$stored_person_properties") }, groups: c2 };
    }
    _prepareElementForSiteApp(e2) {
      var t2, i2 = null == (t2 = e2.tagName) ? void 0 : t2.toLowerCase();
      return "style" === i2 && this._instance.config.prepare_external_dependency_stylesheet ? this._instance.config.prepare_external_dependency_stylesheet(e2) || (el.error("prepare_external_dependency_stylesheet returned null"), null) : "script" === i2 && this._instance.config.prepare_external_dependency_script ? this._instance.config.prepare_external_dependency_script(e2) || (el.error("prepare_external_dependency_script returned null"), null) : e2;
    }
    _patchSiteAppElementInsertionMethods() {
      var e2, t2, i2, r2, s2, n2, o2, a2;
      if (!this._instance.config.prepare_external_dependency_stylesheet && !this._instance.config.prepare_external_dependency_script) return () => {
      };
      var l2 = null == be ? void 0 : be.defaultView, u2 = null == l2 || null == (e2 = l2.Node) ? void 0 : e2.prototype;
      if (!l2 || !u2) return () => {
      };
      if (this._siteAppElementPatchCount++, this._restoreSiteAppElementPatches) return this._releaseSiteAppElementPatches();
      var c2 = [], d2 = this, _2 = /* @__PURE__ */ new WeakSet(), h2 = (e3, t3, i3) => {
        if (null != e3 && e3[t3]) {
          var r3 = e3[t3];
          e3[t3] = i3(r3), c2.push((() => {
            e3[t3] = r3;
          }));
        }
      }, p2 = (e3) => {
        if (_2.has(e3)) return e3;
        var t3 = d2._prepareElementForSiteApp(e3);
        return t3 && _2.add(t3), t3;
      }, g2 = (e3) => e3.map(((e4) => "string" == typeof e4 ? e4 : p2(e4))).filter(((e4) => !ot(e4)));
      return h2(u2, "appendChild", ((e3) => function(t3) {
        var i3 = p2(t3);
        return i3 ? e3.call(this, i3) : t3;
      })), h2(u2, "insertBefore", ((e3) => function(t3, i3) {
        var r3 = p2(t3);
        return r3 ? e3.call(this, r3, i3) : t3;
      })), h2(u2, "replaceChild", ((e3) => function(t3, i3) {
        var r3 = p2(t3);
        return r3 ? e3.call(this, r3, i3) : i3;
      })), [null == (t2 = l2.Element) ? void 0 : t2.prototype, null == (i2 = l2.Document) ? void 0 : i2.prototype, null == (r2 = l2.DocumentFragment) ? void 0 : r2.prototype].forEach(((e3) => {
        h2(e3, "append", ((e4) => function() {
          for (var t3 = arguments.length, i3 = new Array(t3), r3 = 0; t3 > r3; r3++) i3[r3] = arguments[r3];
          return e4.apply(this, g2(i3));
        })), h2(e3, "prepend", ((e4) => function() {
          for (var t3 = arguments.length, i3 = new Array(t3), r3 = 0; t3 > r3; r3++) i3[r3] = arguments[r3];
          return e4.apply(this, g2(i3));
        }));
      })), [null == (s2 = l2.Element) ? void 0 : s2.prototype, null == (n2 = l2.CharacterData) ? void 0 : n2.prototype, null == (o2 = l2.DocumentType) ? void 0 : o2.prototype].forEach(((e3) => {
        h2(e3, "before", ((e4) => function() {
          for (var t3 = arguments.length, i3 = new Array(t3), r3 = 0; t3 > r3; r3++) i3[r3] = arguments[r3];
          return e4.apply(this, g2(i3));
        })), h2(e3, "after", ((e4) => function() {
          for (var t3 = arguments.length, i3 = new Array(t3), r3 = 0; t3 > r3; r3++) i3[r3] = arguments[r3];
          return e4.apply(this, g2(i3));
        })), h2(e3, "replaceWith", ((e4) => function() {
          for (var t3 = arguments.length, i3 = new Array(t3), r3 = 0; t3 > r3; r3++) i3[r3] = arguments[r3];
          var s3 = g2(i3);
          return i3.length && !s3.length ? void 0 : e4.apply(this, s3);
        }));
      })), h2(null == (a2 = l2.Element) ? void 0 : a2.prototype, "insertAdjacentElement", ((e3) => function(t3, i3) {
        var r3 = p2(i3);
        return r3 ? e3.call(this, t3, r3) : null;
      })), this._restoreSiteAppElementPatches = () => {
        c2.forEach(((e3) => e3())), this._restoreSiteAppElementPatches = void 0;
      }, this._releaseSiteAppElementPatches();
    }
    _releaseSiteAppElementPatches() {
      var e2 = false;
      return () => {
        var t2;
        e2 || (e2 = true, this._siteAppElementPatchCount--, 0 === this._siteAppElementPatchCount && (null == (t2 = this._restoreSiteAppElementPatches) || t2.call(this)));
      };
    }
    _runWithPreparedSiteAppElements(e2, t2) {
      void 0 === t2 && (t2 = true);
      var i2 = this._patchSiteAppElementInsertionMethods();
      try {
        var r2 = e2(i2);
        return t2 && i2(), r2;
      } catch (e3) {
        throw i2(), e3;
      }
    }
    setupSiteApp(e2) {
      var t2 = this.apps[e2.id], i2 = () => {
        var i3;
        !t2.errored && this._bufferedInvocations.length && (el.info("Processing " + this._bufferedInvocations.length + " events for site app with id " + e2.id), this._bufferedInvocations.forEach(((e3) => this._runWithPreparedSiteAppElements((() => null == t2.processEvent ? void 0 : t2.processEvent(e3))))), t2.processedBuffer = true), Object.values(this.apps).every(((e3) => e3.processedBuffer || e3.errored)) && (null == (i3 = this._stopBuffering) || i3.call(this));
      }, r2 = false, s2 = (s3) => {
        t2.errored = !s3, t2.loaded = true, el.info("Site app with id " + e2.id + " " + (s3 ? "loaded" : "errored")), r2 && i2();
      };
      try {
        var n2 = this._runWithPreparedSiteAppElements(((t3) => e2.init({ posthog: this._instance, callback(e3) {
          t3(), s2(e3);
        } })), false).processEvent;
        n2 && (t2.processEvent = n2), r2 = true;
      } catch (t3) {
        el.error(tl + e2.id, t3), s2(false);
      }
      if (r2 && t2.loaded) try {
        i2();
      } catch (i3) {
        el.error("Error while processing buffered events PostHog app with config id " + e2.id, i3), t2.errored = true;
      }
    }
    _setupSiteApps() {
      var e2 = this.siteAppLoaders || [];
      for (var t2 of e2) this.apps[t2.id] = { id: t2.id, loaded: false, errored: false, processedBuffer: false };
      for (var i2 of e2) this.setupSiteApp(i2);
    }
    _onCapturedEvent(e2) {
      var t2 = this;
      if (0 !== Object.keys(this.apps).length) {
        var i2 = this.globalsForEvent(e2), r2 = function(r3) {
          try {
            t2._runWithPreparedSiteAppElements((() => null == r3.processEvent ? void 0 : r3.processEvent(i2)));
          } catch (t3) {
            el.error("Error while processing event " + e2.event + " for site app " + r3.id, t3);
          }
        };
        for (var s2 of Object.values(this.apps)) r2(s2);
      }
    }
    onRemoteConfig(e2) {
      var t2, i2, r2, s2 = this;
      if (null != (t2 = this.siteAppLoaders) && t2.length) return this.isEnabled ? (this._setupSiteApps(), void this._instance.on("eventCaptured", ((e3) => this._onCapturedEvent(e3)))) : void el.error('PostHog site apps are disabled. Enable the "opt_in_site_apps" config to proceed.');
      if (null == (i2 = this._stopBuffering) || i2.call(this), null != (r2 = e2.siteApps) && r2.length) if (this.isEnabled) {
        var n2 = function() {
          var e3, t3 = o2.id, i3 = o2.url;
          Ie["__$$ph_site_app_" + t3] = s2._instance, null == (e3 = Ie.__PosthogExtensions__) || null == e3.loadSiteApp || e3.loadSiteApp(s2._instance, i3, ((e4) => {
            if (e4) return el.error(tl + t3, e4);
          }));
        };
        for (var o2 of e2.siteApps) n2();
      } else el.error('PostHog site apps are disabled. Enable the "opt_in_site_apps" config to proceed.');
    }
  } };
  var Tl = { tracingHeaders: class {
    constructor(e2) {
      this._restoreXHRPatch = void 0, this._restoreFetchPatch = void 0, this._hostnamesForPatch = void 0, this._startCapturing = () => {
        var e3, t2, i2 = this._syncHostnamesForPatch();
        i2 ? (rt(this._restoreXHRPatch) && (this._restoreXHRPatch = null == (e3 = Ie.__PosthogExtensions__) || null == (e3 = e3.tracingHeadersPatchFns) ? void 0 : e3._patchXHR(i2, (() => this._instance.get_distinct_id()), this._instance.sessionManager)), rt(this._restoreFetchPatch) && (this._restoreFetchPatch = null == (t2 = Ie.__PosthogExtensions__) || null == (t2 = t2.tracingHeadersPatchFns) ? void 0 : t2._patchFetch(i2, (() => this._instance.get_distinct_id()), this._instance.sessionManager))) : this._stopCapturing();
      }, this._instance = e2;
    }
    initialize() {
      this.startIfEnabledOrStop();
    }
    _loadScript(e2) {
      var t2, i2;
      null != (t2 = Ie.__PosthogExtensions__) && t2.tracingHeadersPatchFns ? e2() : null == (i2 = Ie.__PosthogExtensions__) || null == i2.loadExternalDependency || i2.loadExternalDependency(this._instance, "tracing-headers", ((t3) => {
        if (t3) return Ua.error("failed to load script", t3);
        e2();
      }));
    }
    _getConfiguredHostnames() {
      var e2, t2;
      return null !== (e2 = null !== (t2 = this._instance.config.tracing_headers) && void 0 !== t2 ? t2 : this._instance.config.addTracingHeaders) && void 0 !== e2 ? e2 : this._instance.config.__add_tracing_headers;
    }
    _syncHostnamesForPatch() {
      var e2 = this._getConfiguredHostnames();
      return Xe(e2) ? (Xe(this._hostnamesForPatch) ? this._hostnamesForPatch.splice(0, this._hostnamesForPatch.length, ...e2) : this._hostnamesForPatch = [...e2], e2.length > 0 ? this._hostnamesForPatch : void 0) : (Xe(this._hostnamesForPatch) && this._hostnamesForPatch.splice(0), this._hostnamesForPatch = e2 || void 0, this._hostnamesForPatch);
    }
    _stopCapturing() {
      var e2, t2;
      null == (e2 = this._restoreXHRPatch) || e2.call(this), null == (t2 = this._restoreFetchPatch) || t2.call(this), this._restoreXHRPatch = void 0, this._restoreFetchPatch = void 0;
    }
    startIfEnabledOrStop() {
      this._syncHostnamesForPatch() ? this._loadScript(this._startCapturing) : this._stopCapturing();
    }
  } };
  var Fl = i({ surveys: class {
    get _config() {
      return this._instance.config;
    }
    constructor(e2) {
      this._isSurveysEnabled = void 0, this._surveyManager = null, this._isInitializingSurveys = false, this._surveyCallbacks = [], this._getSurveysInFlightPromise = null, this._lastSurveyRefreshFailedAt = null, this._instance = e2, this._surveyEventReceiver = null;
    }
    initialize() {
      this.loadIfEnabled();
    }
    onRemoteConfig(e2) {
      if (!this._config.disable_surveys) {
        var t2 = e2.surveys;
        if (at(t2)) return ca.warn("Flags not loaded yet. Not loading surveys.");
        var i2 = Xe(t2);
        this._isSurveysEnabled = i2 ? t2.length > 0 : t2, ca.info("flags response received, isSurveysEnabled: " + this._isSurveysEnabled), this.loadIfEnabled();
      }
    }
    reset() {
      try {
        var e2;
        null == (e2 = this._surveyEventReceiver) || e2.reset(), localStorage.removeItem("lastSeenSurveyDate");
        for (var t2 = [], i2 = 0; i2 < localStorage.length; i2++) {
          var r2 = localStorage.key(i2);
          (null != r2 && r2.startsWith(da) || null != r2 && r2.startsWith("inProgressSurvey_")) && t2.push(r2);
        }
        t2.forEach(((e3) => localStorage.removeItem(e3)));
      } catch (e3) {
      }
    }
    loadIfEnabled() {
      if (!this._surveyManager) if (this._isInitializingSurveys) ca.info("Already initializing surveys, skipping...");
      else if (this._config.disable_surveys) ca.info(al);
      else if (this._config.cookieless_mode && this._instance.consent.isOptedOut()) ca.info("Not loading surveys in cookieless mode without consent.");
      else {
        var e2 = null == Ie ? void 0 : Ie.__PosthogExtensions__;
        if (e2) {
          if (!rt(this._isSurveysEnabled) || this._config.advanced_enable_surveys) {
            var t2 = this._isSurveysEnabled || this._config.advanced_enable_surveys;
            this._isInitializingSurveys = true;
            try {
              var i2 = e2.generateSurveys;
              if (i2) return void this._completeSurveyInitialization(i2, t2);
              var r2 = e2.loadExternalDependency;
              if (!r2) return void this._handleSurveyLoadError(ne);
              r2(this._instance, "surveys", ((i3) => {
                i3 || !e2.generateSurveys ? this._handleSurveyLoadError("Could not load surveys script", i3) : this._completeSurveyInitialization(e2.generateSurveys, t2);
              }));
            } catch (e3) {
              throw this._handleSurveyLoadError("Error initializing surveys", e3), e3;
            } finally {
              this._isInitializingSurveys = false;
            }
          }
        } else ca.error("PostHog Extensions not found.");
      }
    }
    _completeSurveyInitialization(e2, t2) {
      this._surveyManager = e2(this._instance, t2), this._surveyEventReceiver = new nl(this._instance), ca.info("Surveys loaded successfully"), this._notifySurveyCallbacks({ isLoaded: true });
    }
    _handleSurveyLoadError(e2, t2) {
      ca.error(e2, t2), this._notifySurveyCallbacks({ isLoaded: false, error: e2 });
    }
    onSurveysLoaded(e2) {
      return this._surveyCallbacks.push(e2), this._surveyManager && this._notifySurveyCallbacks({ isLoaded: true }), () => {
        this._surveyCallbacks = this._surveyCallbacks.filter(((t2) => t2 !== e2));
      };
    }
    getSurveys(e2, t2) {
      if (void 0 === t2 && (t2 = false), this._config.disable_surveys) return ca.info(al), e2([]);
      var i2, r2 = this._instance.get_property(B);
      if (r2 && !t2) return e2(r2, { isLoaded: true }), void (this._shouldBackgroundRefreshSurveys() && this.getSurveys((() => {
      }), true));
      "undefined" != typeof Promise && this._getSurveysInFlightPromise ? this._getSurveysInFlightPromise.then(((t3) => e2(t3.surveys, t3.context))) : ("undefined" != typeof Promise && (this._getSurveysInFlightPromise = new Promise(((e3) => {
        i2 = e3;
      }))), this._instance._send_request({ url: this._instance.requestRouter.endpointFor("api", "/api/surveys/?token=" + this._config.token), method: "GET", timeout: this._config.surveys_request_timeout_ms, callback: (t3) => {
        var r3;
        this._getSurveysInFlightPromise = null;
        var s2 = t3.statusCode;
        if (200 !== s2 || !t3.json) {
          var n2 = "Surveys API could not be loaded, status: " + s2;
          ca.error(n2), this._lastSurveyRefreshFailedAt = Date.now();
          var o2 = { isLoaded: false, error: n2 };
          return e2([], o2), void (null == i2 || i2({ surveys: [], context: o2 }));
        }
        this._lastSurveyRefreshFailedAt = null;
        var a2, l2 = t3.json.surveys || [], u2 = l2.filter(((e3) => (function(e4) {
          return !(!e4.start_date || e4.end_date);
        })(e3) && (ua(e3) || (function(e4) {
          var t4;
          return !(null == (t4 = e4.conditions) || null == (t4 = t4.actions) || null == (t4 = t4.values) || !t4.length);
        })(e3))));
        u2.length > 0 && (null == (a2 = this._surveyEventReceiver) || a2.register(u2)), null == (r3 = this._instance.persistence) || r3.register({ [B]: l2, [U]: Date.now() });
        var c2 = { isLoaded: true };
        e2(l2, c2), null == i2 || i2({ surveys: l2, context: c2 });
      } }));
    }
    _shouldBackgroundRefreshSurveys() {
      return this._isSurveyCacheStale() && !this._getSurveysInFlightPromise && !this._isSurveyRefreshBackingOff();
    }
    _isSurveyCacheStale() {
      var e2 = this._instance.get_property(U);
      return lt(e2) && Date.now() - e2 > 3e5;
    }
    _isSurveyRefreshBackingOff() {
      return lt(this._lastSurveyRefreshFailedAt) && 3e5 > Date.now() - this._lastSurveyRefreshFailedAt;
    }
    markSurveyAsSeen(e2, t2) {
      var i2, r2 = { id: e2, current_iteration: null !== (i2 = null == t2 ? void 0 : t2.iteration) && void 0 !== i2 ? i2 : null };
      _a(r2);
      try {
        localStorage.setItem("lastSeenSurveyDate", (/* @__PURE__ */ new Date()).toISOString());
      } catch (e3) {
      }
    }
    _notifySurveyCallbacks(e2) {
      for (var t2 of this._surveyCallbacks) try {
        if (!e2.isLoaded) return t2([], e2);
        this.getSurveys(t2);
      } catch (e3) {
        ca.error("Error in survey callback", e3);
      }
    }
    getActiveMatchingSurveys(e2, t2) {
      if (void 0 === t2 && (t2 = false), !at(this._surveyManager)) return this._surveyManager.getActiveMatchingSurveys(e2, t2);
      ca.warn("init was not called");
    }
    _getSurveyById(e2) {
      var t2 = null;
      return this.getSurveys(((i2) => {
        var r2;
        t2 = null !== (r2 = i2.find(((t3) => t3.id === e2))) && void 0 !== r2 ? r2 : null;
      })), t2;
    }
    _checkSurveyEligibility(e2) {
      if (at(this._surveyManager)) return { eligible: false, reason: ol };
      var t2 = "string" == typeof e2 ? this._getSurveyById(e2) : e2;
      return t2 ? this._surveyManager.checkSurveyEligibility(t2) : { eligible: false, reason: "Survey not found" };
    }
    canRenderSurvey(e2) {
      if (at(this._surveyManager)) return ca.warn("init was not called"), { visible: false, disabledReason: ol };
      var t2 = this._checkSurveyEligibility(e2);
      return { visible: t2.eligible, disabledReason: t2.reason };
    }
    canRenderSurveyAsync(e2, t2) {
      return at(this._surveyManager) ? (ca.warn("init was not called"), Promise.resolve({ visible: false, disabledReason: ol })) : new Promise(((i2) => {
        this.getSurveys(((t3) => {
          var r2, s2 = null !== (r2 = t3.find(((t4) => t4.id === e2))) && void 0 !== r2 ? r2 : null;
          if (s2) {
            var n2 = this._checkSurveyEligibility(s2);
            i2({ visible: n2.eligible, disabledReason: n2.reason });
          } else i2({ visible: false, disabledReason: "Survey not found" });
        }), t2);
      }));
    }
    renderSurvey(e2, t2, i2) {
      var r2;
      if (at(this._surveyManager)) ca.warn("init was not called");
      else {
        var s2 = "string" == typeof e2 ? this._getSurveyById(e2) : e2;
        if (null != s2 && s2.id) if (ha.includes(s2.type)) {
          var n2 = null == be ? void 0 : be.querySelector(t2);
          if (n2) return null != (r2 = s2.appearance) && r2.surveyPopupDelaySeconds ? (ca.info("Rendering survey " + s2.id + " with delay of " + s2.appearance.surveyPopupDelaySeconds + " seconds"), void setTimeout((() => {
            var e3, t3;
            ca.info("Rendering survey " + s2.id + " with delay of " + (null == (e3 = s2.appearance) ? void 0 : e3.surveyPopupDelaySeconds) + " seconds"), null == (t3 = this._surveyManager) || t3.renderSurvey(s2, n2, i2), ca.info("Survey " + s2.id + " rendered");
          }), 1e3 * s2.appearance.surveyPopupDelaySeconds)) : void this._surveyManager.renderSurvey(s2, n2, i2);
          ca.warn("Survey element not found");
        } else ca.warn("Surveys of type " + s2.type + " cannot be rendered in the app");
        else ca.warn("Survey not found");
      }
    }
    displaySurvey(e2, t2) {
      var r2;
      if (at(this._surveyManager)) ca.warn("init was not called");
      else {
        var s2 = this._getSurveyById(e2);
        if (s2) {
          var n2 = s2;
          if (null != (r2 = s2.appearance) && r2.surveyPopupDelaySeconds && t2.ignoreDelay && (n2 = i({}, s2, { appearance: i({}, s2.appearance, { surveyPopupDelaySeconds: 0 }) })), t2.displayType !== Dn.Popover && t2.initialResponses && ca.warn("initialResponses is only supported for popover surveys. prefill will not be applied."), false === t2.ignoreConditions) {
            var o2 = this.canRenderSurvey(s2);
            if (!o2.visible) return void ca.warn("Survey is not eligible to be displayed: ", o2.disabledReason);
          }
          t2.displayType !== Dn.Inline ? this._surveyManager.handlePopoverSurvey(n2, t2) : this.renderSurvey(n2, t2.selector, t2.properties);
        } else ca.warn("Survey not found");
      }
    }
    cancelPendingSurvey(e2) {
      at(this._surveyManager) ? ca.warn("init was not called") : this._surveyManager.cancelSurvey(e2);
    }
    handlePageUnload() {
      var e2;
      null == (e2 = this._surveyManager) || null == e2.handlePageUnload || e2.handlePageUnload();
    }
  } }, El);
  var Rl = { toolbar: class {
    constructor(e2) {
      this.instance = e2;
    }
    _setToolbarState(e2) {
      Ie.ph_toolbar_state = e2;
    }
    _getToolbarState() {
      var e2;
      return null !== (e2 = Ie.ph_toolbar_state) && void 0 !== e2 ? e2 : 0;
    }
    initialize() {
      return this.maybeLoadToolbar();
    }
    maybeLoadToolbar(e2, t2, i2) {
      if (void 0 === e2 && (e2 = void 0), void 0 === t2 && (t2 = void 0), void 0 === i2 && (i2 = void 0), $r(this.instance.config)) return false;
      if (!fe || !be) return false;
      e2 = null != e2 ? e2 : fe.location, i2 = null != i2 ? i2 : fe.history;
      try {
        if (!t2) {
          try {
            fe.localStorage.setItem("test", "test"), fe.localStorage.removeItem("test");
          } catch (e3) {
            return false;
          }
          t2 = null == fe ? void 0 : fe.localStorage;
        }
        var r2, s2 = ll || nn(e2.hash, "__posthog") || nn(e2.hash, "state"), n2 = s2 ? Fr((() => JSON.parse(atob(decodeURIComponent(s2))))) || Fr((() => JSON.parse(decodeURIComponent(s2)))) : null;
        return n2 && "ph_authorize" === n2.action ? ((r2 = n2).source = "url", r2 && Object.keys(r2).length > 0 && (n2.desiredHash ? e2.hash = n2.desiredHash : i2 ? i2.replaceState(i2.state, "", e2.pathname + e2.search) : e2.hash = "")) : ((r2 = JSON.parse(t2.getItem(ul) || "{}")).source = "localstorage", delete r2.userIntent), !(!r2.token || this.instance.config.token !== r2.token || (this.loadToolbar(r2), 0));
      } catch (e3) {
        return false;
      }
    }
    _callLoadToolbar(e2) {
      var t2 = Ie.ph_load_toolbar || Ie.ph_load_editor;
      !at(t2) && et(t2) ? t2(e2, this.instance) : cl.warn("No toolbar load function found");
    }
    loadToolbar(e2) {
      var t2 = !(null == be || !be.getElementById(ee));
      if (!fe || t2) return false;
      var r2 = "custom" === this.instance.requestRouter.region && this.instance.config.advanced_disable_toolbar_metrics, s2 = i({ token: this.instance.config.token }, e2, { apiURL: this.instance.requestRouter.endpointFor("ui") }, r2 ? { instrument: false } : {});
      if (fe.localStorage.setItem(ul, JSON.stringify(i({}, s2, { source: void 0 }))), 2 === this._getToolbarState()) this._callLoadToolbar(s2);
      else if (0 === this._getToolbarState()) {
        var n2;
        this._setToolbarState(1), null == (n2 = Ie.__PosthogExtensions__) || null == n2.loadExternalDependency || n2.loadExternalDependency(this.instance, "toolbar", ((e3) => {
          if (e3) return cl.error("[Toolbar] Failed to load", e3), void this._setToolbarState(0);
          this._setToolbarState(2), this._callLoadToolbar(s2);
        })), Or(fe, "turbolinks:load", (() => {
          this._setToolbarState(0), this.loadToolbar(s2);
        }));
      }
      return true;
    }
    _loadEditor(e2) {
      return this.loadToolbar(e2);
    }
    maybeLoadEditor(e2, t2, i2) {
      return void 0 === e2 && (e2 = void 0), void 0 === t2 && (t2 = void 0), void 0 === i2 && (i2 = void 0), this.maybeLoadToolbar(e2, t2, i2);
    }
  } };
  var Ll = i({ experiments: yl }, El);
  var Ml = { conversations: class {
    constructor(e2) {
      this._isConversationsEnabled = void 0, this._conversationsManager = null, this._isInitializing = false, this._remoteConfig = null, this._instance = e2;
    }
    initialize() {
      this.loadIfEnabled();
    }
    onRemoteConfig(e2) {
      if (!this._instance.config.disable_conversations) {
        var t2 = e2.conversations;
        at(t2) || (ct(t2) ? this._isConversationsEnabled = t2 : (this._isConversationsEnabled = t2.enabled, this._remoteConfig = t2), this.loadIfEnabled());
      }
    }
    reset() {
      var e2;
      null == (e2 = this._conversationsManager) || e2.reset(), this._conversationsManager = null, this._isConversationsEnabled = void 0, this._remoteConfig = null;
    }
    loadIfEnabled() {
      if (!(this._conversationsManager || this._isInitializing || this._instance.config.disable_conversations || $r(this._instance.config) || this._instance.config.cookieless_mode && this._instance.consent.isOptedOut())) {
        var e2 = null == Ie ? void 0 : Ie.__PosthogExtensions__;
        if (e2 && !rt(this._isConversationsEnabled) && this._isConversationsEnabled) if (this._remoteConfig && this._remoteConfig.token) {
          this._isInitializing = true;
          try {
            var t2 = e2.initConversations;
            if (t2) return this._completeInitialization(t2), void (this._isInitializing = false);
            var i2 = e2.loadExternalDependency;
            if (!i2) return void this._handleLoadError(ne);
            i2(this._instance, "conversations", ((t3) => {
              t3 || !e2.initConversations ? this._handleLoadError("Could not load conversations script", t3) : this._completeInitialization(e2.initConversations), this._isInitializing = false;
            }));
          } catch (e3) {
            this._handleLoadError("Error initializing conversations", e3), this._isInitializing = false;
          }
        } else bl.error("Conversations enabled but missing token in remote config.");
      }
    }
    _completeInitialization(e2) {
      if (this._remoteConfig) try {
        this._conversationsManager = e2(this._remoteConfig, this._instance), bl.info("Conversations loaded successfully");
      } catch (e3) {
        this._handleLoadError("Error completing conversations initialization", e3);
      }
      else bl.error("Cannot complete initialization: remote config is null");
    }
    _handleLoadError(e2, t2) {
      bl.error(e2, t2), this._conversationsManager = null, this._isInitializing = false;
    }
    show() {
      this._conversationsManager ? this._conversationsManager.show() : bl.warn("Conversations not loaded yet.");
    }
    hide() {
      this._conversationsManager && this._conversationsManager.hide();
    }
    isAvailable() {
      return true === this._isConversationsEnabled && !ot(this._conversationsManager);
    }
    isVisible() {
      var e2, t2;
      return null !== (e2 = null == (t2 = this._conversationsManager) ? void 0 : t2.isVisible()) && void 0 !== e2 && e2;
    }
    sendMessage(e2, i2, r2) {
      var s2 = this;
      return t((function* () {
        return s2._conversationsManager ? s2._conversationsManager.sendMessage(e2, i2, r2) : (bl.warn(wl), null);
      }))();
    }
    getMessages(e2, i2) {
      var r2 = this;
      return t((function* () {
        return r2._conversationsManager ? r2._conversationsManager.getMessages(e2, i2) : (bl.warn(wl), null);
      }))();
    }
    markAsRead(e2) {
      var i2 = this;
      return t((function* () {
        return i2._conversationsManager ? i2._conversationsManager.markAsRead(e2) : (bl.warn(wl), null);
      }))();
    }
    getTickets(e2) {
      var i2 = this;
      return t((function* () {
        return i2._conversationsManager ? i2._conversationsManager.getTickets(e2) : (bl.warn(wl), null);
      }))();
    }
    requestRestoreLink(e2) {
      var i2 = this;
      return t((function* () {
        return i2._conversationsManager ? i2._conversationsManager.requestRestoreLink(e2) : (bl.warn(wl), null);
      }))();
    }
    restoreFromToken(e2) {
      var i2 = this;
      return t((function* () {
        return i2._conversationsManager ? i2._conversationsManager.restoreFromToken(e2) : (bl.warn(wl), null);
      }))();
    }
    restoreFromUrlToken() {
      var e2 = this;
      return t((function* () {
        return e2._conversationsManager ? e2._conversationsManager.restoreFromUrlToken() : (bl.warn(wl), null);
      }))();
    }
    getCurrentTicketId() {
      var e2, t2;
      return null !== (e2 = null == (t2 = this._conversationsManager) ? void 0 : t2.getCurrentTicketId()) && void 0 !== e2 ? e2 : null;
    }
    getWidgetSessionId() {
      var e2, t2;
      return null !== (e2 = null == (t2 = this._conversationsManager) ? void 0 : t2.getWidgetSessionId()) && void 0 !== e2 ? e2 : null;
    }
    _onIdentityChanged() {
      var e2;
      null == (e2 = this._conversationsManager) || e2.setIdentity();
    }
    _onIdentityCleared() {
      var e2;
      null == (e2 = this._conversationsManager) || e2.clearIdentity();
    }
  } };
  var Al = { logs: class {
    constructor(e2) {
      var t2;
      this._isLogsEnabled = false, this._isLoaded = false, this._logger = kr("[logs]"), this._queue = [], this._consoleQueue = [], this._consecutiveStatusZeroFailures = 0, this._onReconnect = () => {
        var e3, t3;
        this._consecutiveStatusZeroFailures = 0, null == (e3 = this._core) || e3.onReconnect(), null == (t3 = this._consoleCore) || t3.onReconnect();
      }, this._instance = e2, this._instance && null != (t2 = this._instance.config.logs) && t2.captureConsoleLogs && (this._isLogsEnabled = true), fe && Or(fe, "online", this._onReconnect);
    }
    _buildCore(e2, t2, i2, r2) {
      var s2, n2 = (function(e3, t3) {
        var i3, r3, s3, n3, o2, a2, l2, u2 = null !== (i3 = null == e3 ? void 0 : e3.flushIntervalMs) && void 0 !== i3 ? i3 : 3e3, c2 = null !== (r3 = null == e3 ? void 0 : e3.maxBufferSize) && void 0 !== r3 ? r3 : 100, d2 = null != t3 && t3.consoleCapture ? void 0 : null !== (s3 = null == e3 ? void 0 : e3.maxLogsPerInterval) && void 0 !== s3 ? s3 : 1e3, _2 = rt(d2) ? Math.max(c2, 2048) : Math.max(c2, d2), h2 = null == e3 ? void 0 : e3.resourceAttributes;
        return { serviceName: null !== (n3 = null !== (o2 = null == h2 ? void 0 : h2["service.name"]) && void 0 !== o2 ? o2 : null == e3 ? void 0 : e3.serviceName) && void 0 !== n3 ? n3 : null == t3 ? void 0 : t3.serviceNameDefault, serviceVersion: null !== (a2 = null == h2 ? void 0 : h2["service.version"]) && void 0 !== a2 ? a2 : null == e3 ? void 0 : e3.serviceVersion, environment: null !== (l2 = null == h2 ? void 0 : h2["deployment.environment"]) && void 0 !== l2 ? l2 : null == e3 ? void 0 : e3.environment, resourceAttributes: h2, beforeSend: null == e3 ? void 0 : e3.beforeSend, flushIntervalMs: u2, maxBufferSize: c2, maxQueueSize: _2, maxBatchRecordsPerPost: 100, rateCapWindowMs: u2, maxLogsPerInterval: d2, backgroundFlushBudgetMs: 0, terminationFlushBudgetMs: 0 };
      })(null == (s2 = this._instance) || null == (s2 = s2.config) ? void 0 : s2.logs, i2);
      return [new Ni(this._createHost(e2, t2), n2, this._logger, (() => this._getSdkContext()), ((e3) => e3()), void 0, r2), n2];
    }
    _getCore() {
      var e2, t2 = null == (e2 = this._instance) || null == (e2 = e2.config) ? void 0 : e2.logs;
      if (!this._core || this._resolvedFrom !== t2) {
        var i2;
        null == (i2 = this._core) || i2.reset(), this._resolvedFrom = t2;
        var r2 = this._buildCore((() => this._queue), ((e3) => {
          this._queue = e3;
        }));
        this._core = r2[0], this._resolvedConfig = r2[1];
      }
      return this._core;
    }
    _getConsoleCore() {
      var e2, t2 = null == (e2 = this._instance) || null == (e2 = e2.config) ? void 0 : e2.logs;
      if (!this._consoleCore || this._consoleResolvedFrom !== t2) {
        var i2;
        null == (i2 = this._consoleCore) || i2.reset(), this._consoleResolvedFrom = t2;
        var r2 = this._buildCore((() => this._consoleQueue), ((e3) => {
          this._consoleQueue = e3;
        }), { serviceNameDefault: "posthog-browser-logs", consoleCapture: true }, Sl);
        this._consoleCore = r2[0], this._consoleResolvedConfig = r2[1];
      }
      return this._consoleCore;
    }
    initialize() {
      this.loadIfEnabled();
    }
    onRemoteConfig(e2) {
      var t2, i2 = null == (t2 = e2.logs) ? void 0 : t2.captureConsoleLogs;
      !at(i2) && i2 && (this._isLogsEnabled = true, this.loadIfEnabled());
    }
    reset() {
      var e2, t2;
      this._queue = [], null == (e2 = this._core) || e2.reset(), this._consoleQueue = [], null == (t2 = this._consoleCore) || t2.reset(), this._consecutiveStatusZeroFailures = 0;
    }
    captureLog(e2) {
      this._getCore().captureLog(e2);
    }
    _captureConsoleLog(e2) {
      this._getConsoleCore().captureLog(e2);
    }
    get logger() {
      return this._capture_logger || (this._capture_logger = { trace: (e2, t2) => this.captureLog({ body: e2, level: "trace", attributes: t2 }), debug: (e2, t2) => this.captureLog({ body: e2, level: "debug", attributes: t2 }), info: (e2, t2) => this.captureLog({ body: e2, level: "info", attributes: t2 }), warn: (e2, t2) => this.captureLog({ body: e2, level: "warn", attributes: t2 }), error: (e2, t2) => this.captureLog({ body: e2, level: "error", attributes: t2 }), fatal: (e2, t2) => this.captureLog({ body: e2, level: "fatal", attributes: t2 }) }), this._capture_logger;
    }
    flushLogs(e2) {
      e2 ? this._flushViaTransport(e2) : (this._core && this._core.flush().catch(((e3) => this._logger.error("PostHog logs flush failed:", e3))), this._consoleCore && this._consoleCore.flush().catch(((e3) => this._logger.error("PostHog logs flush failed:", e3))));
    }
    loadIfEnabled() {
      if (this._isLogsEnabled && !this._isLoaded) {
        var e2 = null == Ie ? void 0 : Ie.__PosthogExtensions__;
        if (e2) {
          var t2 = e2.loadExternalDependency;
          t2 ? t2(this._instance, "logs", ((t3) => {
            var i2;
            t3 || null == (i2 = e2.logs) || !i2.initializeLogs ? this._logger.error("Could not load logs script", t3) : (e2.logs.initializeLogs(this._instance), this._isLoaded = true);
          })) : this._logger.error(ne);
        } else this._logger.error("PostHog Extensions not found.");
      }
    }
    _createHost(e2, t2) {
      var i2 = this._instance;
      return { get isDisabled() {
        return false;
      }, get optedOut() {
        return !i2.is_capturing();
      }, getPersistedProperty: (t3) => t3 === Me.LogsQueue ? e2() : void 0, setPersistedProperty(e3, i3) {
        var r2;
        e3 === Me.LogsQueue && t2(null !== (r2 = i3) && void 0 !== r2 ? r2 : []);
      }, _sendLogsBatch: (e3) => this._sendLogsBatch(e3), getLibraryId: () => n.LIB_NAME, getLibraryVersion: () => n.LIB_VERSION };
    }
    _sendLogsBatch(e2) {
      return new Promise(((t2) => {
        if (on(this._consecutiveStatusZeroFailures, 3)) t2({ kind: "fatal", error: new Error("logs endpoint is unreachable, dropping batch") });
        else {
          var i2 = false, r2 = (e3) => {
            i2 || (i2 = true, clearTimeout(s2), t2(e3));
          }, s2 = setTimeout((() => r2({ kind: "retry-later", error: new Error("logs request timed out") })), 9e4);
          this._instance._send_request({ method: "POST", url: this._logsUrl(), data: e2, compression: "best-available", batchKey: "logs", fireCallbackOnDrop: true, callback: (e3) => {
            var t3 = e3.statusCode;
            if (this._trackEndpointReachability(t3), t3 >= 200 && 300 > t3) r2({ kind: "ok" });
            else if (413 === t3) r2({ kind: "too-large" });
            else if (0 !== t3 && 429 !== t3 && 500 > t3) r2({ kind: "fatal", error: new Error("logs request failed with status " + t3) });
            else {
              var i3;
              r2({ kind: "retry-later", error: null !== (i3 = e3.error) && void 0 !== i3 ? i3 : new Error("logs request failed with status " + t3) });
            }
          } });
        }
      }));
    }
    _trackEndpointReachability(e2) {
      (0 !== e2 || this._instance.__loaded) && (this._consecutiveStatusZeroFailures = an(e2, this._consecutiveStatusZeroFailures, 3, (() => this._logger.warn("Log requests are failing before receiving an HTTP response; this can happen due to network issues, CORS, browser blocking, or ad blockers. Stopped sending logs; will try again when connectivity changes."))));
    }
    _flushViaTransport(e2) {
      this._queue.length > 0 && this._drainQueueViaTransport(e2, this._queue, this._resolvedConfig, n.LIB_NAME, ((e3) => {
        this._queue = e3;
      })), this._consoleQueue.length > 0 && this._drainQueueViaTransport(e2, this._consoleQueue, this._consoleResolvedConfig, Sl, ((e3) => {
        this._consoleQueue = e3;
      }));
    }
    _drainQueueViaTransport(e2, t2, i2, r2, s2) {
      if (0 !== t2.length) {
        var o2 = t2.map(((e3) => e3.record));
        s2([]);
        var a2 = Di(o2, $i(i2, n.LIB_NAME, n.LIB_VERSION), r2, n.LIB_VERSION);
        this._instance._send_request({ method: "POST", url: this._logsUrl(), data: a2, compression: "best-available", batchKey: "logs", transport: e2 });
      }
    }
    _logsUrl() {
      return this._instance.requestRouter.endpointFor("api", "/i/v1/logs") + "?token=" + encodeURIComponent(this._instance.config.token);
    }
    _getSdkContext() {
      var e2, t2 = {};
      if (t2.distinctId = this._instance.get_distinct_id(), this._instance.sessionManager) {
        var i2 = this._instance.sessionManager.checkAndGetSessionAndWindowId(true), r2 = i2.windowId, s2 = i2.sessionStartTimestamp, n2 = i2.lastActivityTimestamp;
        t2.sessionId = i2.sessionId, t2.windowId = r2, at(s2) || (t2.sessionStartTimestamp = s2), at(n2) || (t2.lastActivityTimestamp = n2);
      }
      if (null != Ie && null != (e2 = Ie.location) && e2.href && (t2.currentUrl = this._instance.config.disable_capture_url_hashes ? Ci(Ie.location.href) : Ie.location.href), this._instance.featureFlags) {
        var o2 = this._instance.featureFlags.getFlags();
        o2 && o2.length > 0 && (t2.activeFeatureFlags = o2);
      }
      return t2;
    }
  } };
  var Ol = { metrics: class {
    constructor(e2) {
      this._logger = kr("[metrics]"), this._instance = e2;
    }
    initialize() {
    }
    _getCore() {
      var e2, t2, i2, r2, s2, n2, o2, a2, l2, u2 = null == (e2 = this._instance) || null == (e2 = e2.config) ? void 0 : e2.metrics;
      return this._core && this._resolvedFrom === u2 || (null == (t2 = this._core) || t2.reset(), this._resolvedFrom = u2, this._core = new Hi(this._createHost(), { serviceName: null !== (r2 = null == (l2 = null == (i2 = u2) ? void 0 : i2.resourceAttributes) ? void 0 : l2["service.name"]) && void 0 !== r2 ? r2 : null == i2 ? void 0 : i2.serviceName, serviceVersion: null !== (s2 = null == l2 ? void 0 : l2["service.version"]) && void 0 !== s2 ? s2 : null == i2 ? void 0 : i2.serviceVersion, environment: null !== (n2 = null == l2 ? void 0 : l2["deployment.environment"]) && void 0 !== n2 ? n2 : null == i2 ? void 0 : i2.environment, resourceAttributes: l2, beforeSend: null == i2 ? void 0 : i2.beforeSend, flushIntervalMs: null !== (o2 = null == i2 ? void 0 : i2.flushIntervalMs) && void 0 !== o2 ? o2 : 1e4, maxSeriesPerFlush: null !== (a2 = null == i2 ? void 0 : i2.maxSeriesPerFlush) && void 0 !== a2 ? a2 : 1e3 }, this._logger)), this._core;
    }
    count(e2, t2, i2) {
      void 0 === t2 && (t2 = 1), this._getCore().count(e2, t2, i2);
    }
    gauge(e2, t2, i2) {
      this._getCore().gauge(e2, t2, i2);
    }
    histogram(e2, t2, i2) {
      this._getCore().histogram(e2, t2, i2);
    }
    flush(e2) {
      if (!this._core) return Promise.resolve();
      if (e2) {
        var t2 = this._core.drainWindow();
        return t2 && this._sendMetricsBatch(t2, e2), Promise.resolve();
      }
      return this._core.flush().catch(((e3) => this._logger.error("PostHog metrics flush failed:", e3)));
    }
    reset() {
      var e2;
      null == (e2 = this._core) || e2.reset();
    }
    _createHost() {
      var e2 = this._instance, t2 = this;
      return { get isDisabled() {
        return false;
      }, get optedOut() {
        return !e2.is_capturing();
      }, _sendMetricsBatch: (e3) => t2._sendMetricsBatch(e3), getLibraryId: () => n.LIB_NAME, getLibraryVersion: () => n.LIB_VERSION };
    }
    _sendMetricsBatch(e2, t2) {
      return new Promise(((r2) => {
        var s2 = false, n2 = (e3) => {
          s2 || (s2 = true, clearTimeout(o2), r2(e3));
        }, o2 = setTimeout((() => n2({ kind: "retry-later", error: new Error("metrics request timed out") })), 9e4);
        this._instance._send_request(i({ method: "POST", url: this._metricsUrl(), data: e2, compression: "best-available", batchKey: "metrics" }, t2 && { transport: t2 }, { fireCallbackOnDrop: true, callback(e3) {
          var t3 = e3.statusCode;
          if (t3 >= 200 && 300 > t3) n2({ kind: "ok" });
          else if (413 === t3) n2({ kind: "too-large" });
          else if (0 !== t3 && 429 !== t3 && 500 > t3) n2({ kind: "fatal", error: new Error("metrics request failed with status " + t3) });
          else {
            var i2;
            n2({ kind: "retry-later", error: null !== (i2 = e3.error) && void 0 !== i2 ? i2 : new Error("metrics request failed with status " + t3) });
          }
        } }));
      }));
    }
    _metricsUrl() {
      return this._instance.requestRouter.endpointFor("api", "/i/v1/metrics") + "?token=" + encodeURIComponent(this._instance.config.token);
    }
  } };
  var $l = i({}, El, xl, kl, Pl, Il, Cl, Fl, Tl, Rl, Ll, Ml, Al, Ol);
  Ra.__defaultExtensionClasses = i({}, $l);
  var Dl = (function() {
    n.SDK_DIST_CHANNEL = "npm";
    var e2 = ma[ka] = new Ra();
    return (function() {
      function e3() {
        e3.done || (e3.done = true, Pa = false, Ir(ma, (function(e4) {
          e4._dom_loaded();
        })));
      }
      null != be && be.addEventListener ? "complete" === be.readyState ? e3() : Or(be, "DOMContentLoaded", e3, { capture: false }) : fe && xr.error("Browser doesn't support `document.addEventListener` so PostHog couldn't be initialized");
    })(), e2;
  })();

  // src/lib/analytics.ts
  var AID_KEY = "_avc_aid";
  async function getOrCreateAnalyticsId() {
    const r2 = await chrome.storage.local.get([AID_KEY]);
    if (r2[AID_KEY]) return r2[AID_KEY];
    const id = crypto.randomUUID();
    await chrome.storage.local.set({ [AID_KEY]: id });
    return id;
  }
  var _initialized = false;
  async function initAnalytics() {
    if (_initialized || false) return;
    _initialized = true;
    const id = await getOrCreateAnalyticsId();
    Dl.init("phc_sPDsk7pujyJYEh3rNKJjtxxQNfEH9VHRGZyq7vTxFipT", {
      api_host: "https://us.i.posthog.com",
      defaults: "2026-05-30",
      bootstrap: { distinctID: id, isIdentifiedID: false },
      // Extension pages don't have meaningful URLs for pageview tracking.
      capture_pageview: false
    });
    const data = await chrome.storage.local.get(["syncProfile"]);
    const profile = data.syncProfile;
    if (profile?.email || profile?.name) {
      Dl.identify(id, {
        ...profile.email ? { email: profile.email } : {},
        ...profile.name ? { name: profile.name } : {}
      });
    }
  }

  // src/entries/popup.ts
  var DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  function todayKey() {
    return (/* @__PURE__ */ new Date()).toLocaleDateString("sv");
  }
  function esc(s2) {
    return s2.replace(/[&<>"']/g, (c2) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c2]);
  }
  function byId(id) {
    return document.getElementById(id);
  }
  function weekStamps(daily) {
    const now = /* @__PURE__ */ new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() + 6) % 7);
    const byDay = new Map(Object.entries(daily || {}));
    return DAY_LABELS.map((label, i2) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i2);
      const key = date.toLocaleDateString("sv");
      const stats = byDay.get(key);
      const hit = !!stats && (stats.judged > 0 || stats.reviews > 0 || stats.watchMin > 0);
      const isToday = date.toDateString() === now.toDateString();
      return { label, hit, isToday };
    });
  }
  function renderStampRally(daily) {
    const week = weekStamps(daily);
    const today = week.find((d2) => d2.isToday);
    const todayHit = today?.hit;
    const todayLabel = today?.label ?? "today";
    const grid = week.map(
      (d2) => `<div class="${d2.hit ? "av-stamp av-stamp-hit" : "av-stamp"}">${d2.hit ? "\u6E08" : esc(d2.label)}</div>`
    ).join("");
    const note = todayHit ? `<b>${esc(todayLabel)} is stamped.</b> Come back tomorrow.` : `Practice today to stamp <b>${esc(todayLabel)}</b>.`;
    byId("stamp-rally").innerHTML = `<div class="av-stamp-head"><span>STAMP RALLY</span><span class="av-stamp-head-jp">\u30B9\u30BF\u30F3\u30D7</span></div><div class="av-stamp-grid">${grid}</div><p class="av-stamp-note">${note}</p>`;
  }
  function initTheme() {
    const btn = byId("theme-toggle");
    const icon = document.getElementById("theme-icon");
    const apply = (theme) => {
      document.documentElement.setAttribute("data-theme", theme);
      if (!icon) return;
      if (theme === "dark") {
        icon.innerHTML = '<circle cx="12" cy="12" r="4"></circle><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"></path>';
        btn.setAttribute("aria-label", "Switch to light mode");
        btn.title = "Switch to light mode";
      } else {
        icon.innerHTML = '<path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5z"></path>';
        btn.setAttribute("aria-label", "Switch to dark mode");
        btn.title = "Switch to dark mode";
      }
    };
    const current = document.documentElement.getAttribute("data-theme");
    apply(current === "light" ? "light" : "dark");
    btn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      apply(next);
      try {
        localStorage.setItem("av-theme", next);
      } catch {
      }
    });
  }
  async function renderAccount() {
    const el2 = byId("account");
    const token = await getSyncToken();
    if (!token) {
      const relink = await getRelinkNeeded();
      const title = relink ? "Sign-in expired" : "Not signed in";
      const sub = relink ? "Re-link to resume cloud sync" : "Progress stays on this device only";
      const cta = relink ? "Re-link \u2014 animevocab.com" : "Sign in to sync \u2014 animevocab.com";
      const dot = relink ? "av-dot av-dot-warn" : "av-dot av-dot-off";
      el2.innerHTML = `<div class="av-account-row"><span class="${dot}"></span><div><b>${title}</b><span class="av-account-sub">${sub}</span></div></div><button id="signin-btn" class="av-btn av-btn-primary av-btn-block" type="button">${cta}</button>`;
      byId("signin-btn").addEventListener("click", () => {
        Dl.capture("sign_in_clicked", { relink });
        chrome.tabs.create({ url: `${WEB_URL}/app` });
      });
      return;
    }
    const profile = await getSyncProfile();
    const who = profile?.email || profile?.name || "your account";
    el2.innerHTML = `<div class="av-account-row"><span class="av-dot"></span><div><b>Cloud sync on</b><span class="av-account-sub">Synced as ${esc(who)}</span></div></div>`;
  }
  async function render() {
    const vocab = await getVocab();
    const stats = await getStats();
    const due = dueCount(vocab);
    renderStampRally(stats.daily || {});
    const reviewBtn = byId("review-due");
    if (due > 0) {
      reviewBtn.hidden = false;
      reviewBtn.textContent = `Review ${due} due word${due > 1 ? "s" : ""}`;
    } else {
      reviewBtn.hidden = true;
    }
    await mountReviewPrompt({ host: byId("review-prompt"), variant: "popup" });
  }
  async function activeTabId() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id ?? null;
  }
  async function initCopilotToggle() {
    const btn = byId("copilot-btn");
    const errEl = byId("listen-error");
    const tabId = await activeTabId();
    if (tabId == null) {
      btn.disabled = true;
      btn.textContent = "Open Copilot (no active tab)";
      return;
    }
    const refresh = () => {
      chrome.runtime.sendMessage({ type: "avc-agent-status", tabId }, (res) => {
        const on2 = !!res?.visible;
        btn.textContent = on2 ? "Stop Copilot & Listening" : "Open Copilot on this tab";
        btn.classList.toggle("active", on2);
      });
    };
    btn.addEventListener("click", () => {
      errEl.hidden = true;
      chrome.runtime.sendMessage({ type: "avc-agent-status", tabId }, (res) => {
        const action = res?.visible ? "avc-agent-hide" : "avc-agent-show";
        chrome.runtime.sendMessage({ type: action, tabId }, (r2) => {
          if (r2 && r2.ok === false && r2.error) {
            errEl.textContent = r2.error;
            errEl.hidden = false;
          } else {
            Dl.capture(action === "avc-agent-show" ? "copilot_opened" : "copilot_closed");
          }
          refresh();
        });
      });
    });
    refresh();
  }
  document.addEventListener("DOMContentLoaded", () => {
    void initAnalytics();
    initTheme();
    void render();
    void renderAccount();
    void initCopilotToggle();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && (changes.syncToken || changes.syncProfile || changes.relinkNeeded)) void renderAccount();
    });
    byId("cloud-link").addEventListener("click", (e2) => {
      e2.preventDefault();
      chrome.tabs.create({ url: `${WEB_URL}/app` });
    });
    byId("review-due").addEventListener("click", () => {
      Dl.capture("review_due_opened");
      chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html#review") });
    });
    byId("settings-link").addEventListener("click", async (e2) => {
      e2.preventDefault();
      const token = await getSyncToken();
      if (token) {
        chrome.tabs.create({ url: `${WEB_URL}/app#settings` });
      } else {
        chrome.runtime.openOptionsPage();
      }
    });
    byId("export-link").addEventListener("click", async (e2) => {
      e2.preventDefault();
      const data = await exportAll();
      Dl.capture("data_exported", { source: "popup" });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a2 = document.createElement("a");
      a2.href = url;
      a2.download = `animevocab-export-${todayKey()}.json`;
      a2.click();
      URL.revokeObjectURL(url);
    });
  });
})();
