(function () {
  const cfg = window.AVC_PROMO || {};
  const ends = Date.parse(cfg.endUtc || "1970-01-01");
  const now = Date.now();
  const active = now < ends;
  const daysLeft = active ? Math.max(0, Math.ceil((ends - now) / 86400000)) : 0;

  function apply(promo) {
    const bar = document.getElementById("promo-bar");
    const proPrice = document.getElementById("pro-price");
    const proStrike = document.getElementById("pro-strike");
    const proCta = document.getElementById("pro-cta");
    const heroNote = document.getElementById("hero-promo-note");
    if (!bar) return;

    if (promo.active) {
      bar.hidden = false;
      const dayWord = promo.daysLeft === 1 ? "day" : "days";
      bar.querySelector(".promo-text").textContent =
        `Launch pricing: ${promo.promoLabel || cfg.promoLabel} · ${promo.daysLeft} ${dayWord} left`;
      if (proStrike) {
        proStrike.hidden = false;
        proStrike.textContent = promo.regularLabel || cfg.regularLabel;
      }
      if (proPrice) proPrice.textContent = promo.promoLabel || cfg.promoLabel;
      if (proCta) proCta.href = promo.checkoutUrl || cfg.promoCheckoutUrl;
      if (heroNote) {
        heroNote.hidden = false;
        heroNote.textContent = `Pro is ${promo.promoLabel || cfg.promoLabel} during launch (${promo.daysLeft} ${dayWord} left).`;
      }
    } else {
      bar.hidden = true;
      if (proStrike) proStrike.hidden = true;
      if (proPrice) proPrice.textContent = promo.regularLabel || cfg.regularLabel;
      if (proCta) proCta.href = promo.checkoutUrl || cfg.checkoutUrl;
      if (heroNote) heroNote.hidden = true;
    }
  }

  function localPromo() {
    apply({
      active,
      daysLeft,
      checkoutUrl: active ? cfg.promoCheckoutUrl : cfg.checkoutUrl,
      priceLabel: active ? cfg.promoLabel : cfg.regularLabel,
      regularLabel: cfg.regularLabel,
      promoLabel: cfg.promoLabel
    });
  }

  localPromo();

  const attribution = new URLSearchParams(location.search);
  const funnelBody = (name) => JSON.stringify({
    kind: "feature",
    name,
    utm_source: attribution.get("utm_source") || "",
    utm_medium: attribution.get("utm_medium") || "",
    utm_campaign: attribution.get("utm_campaign") || ""
  });
  const track = (name) => {
    const body = funnelBody(name);
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
        return;
      }
    } catch (_) {}
    fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  };
  try {
    if (!sessionStorage.getItem("avc_landing_view_sent")) {
      sessionStorage.setItem("avc_landing_view_sent", "1");
      track("landing_view");
    }
  } catch (_) {
    track("landing_view");
  }

  document.addEventListener("click", (event) => {
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor) return;
    let url;
    try { url = new URL(anchor.href); } catch (_) { return; }
    if (url.hostname !== "chromewebstore.google.com") return;
    url.searchParams.set("utm_source", "animevocab");
    url.searchParams.set("utm_medium", "website");
    url.searchParams.set("utm_campaign", location.pathname.replace(/^\/+|\/+$/g, "").replaceAll("/", "_") || "homepage");
    anchor.href = url.toString();
    track("store_cta_click");
  }, true);

  if (cfg.apiBase && !cfg.apiBase.includes("example.workers.dev")) {
    fetch(cfg.apiBase + "/v1/public/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.promo) apply(data.promo); })
      .catch(() => {});
  }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  if (!reduced) {
    const heroCard = document.querySelector(".hero-card");
    if (heroCard) {
      window.addEventListener("scroll", () => {
        const y = Math.min(window.scrollY * 0.04, 24);
        heroCard.style.transform = `translateY(${y}px)`;
      }, { passive: true });
    }

    document.querySelectorAll(".top").forEach((nav) => {
      window.addEventListener("scroll", () => {
        nav.classList.toggle("top-scrolled", window.scrollY > 12);
      }, { passive: true });
    });
  }
})();
