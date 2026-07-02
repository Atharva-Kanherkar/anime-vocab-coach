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
        `Launch pricing — ${promo.promoLabel || cfg.promoLabel} · ${promo.daysLeft} ${dayWord} left`;
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

  if (cfg.apiBase && !cfg.apiBase.includes("example.workers.dev")) {
    fetch(cfg.apiBase + "/v1/public/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.promo) apply(data.promo); })
      .catch(() => {});
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
})();
