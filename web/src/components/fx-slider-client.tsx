"use client";

import { useEffect } from "react";

export function FxSliderClient() {
  useEffect(() => {
    const roots = document.querySelectorAll<HTMLElement>(".fx-slider");
    const cleanups: (() => void)[] = [];

    roots.forEach((root) => {
      if (root.dataset.fxInit === "1") return;
      root.dataset.fxInit = "1";

      const slides = [...root.querySelectorAll<HTMLElement>(".fx-slide")];
      if (slides.length < 2) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const autoplayMs = parseInt(root.dataset.autoplay || "8000", 10);
      const progress = root.querySelector<HTMLElement>(".fx-slider__progress span");
      const countEl = root.querySelector<HTMLElement>(".fx-slider__count");
      const dotsHost = root.querySelector<HTMLElement>(".fx-slider__dots");
      const prevBtn = root.querySelector<HTMLButtonElement>(".fx-slider__nav--prev");
      const nextBtn = root.querySelector<HTMLButtonElement>(".fx-slider__nav--next");

      let index = slides.findIndex((s) => s.classList.contains("is-active"));
      if (index < 0) index = 0;
      let timer: ReturnType<typeof setInterval> | null = null;
      let progressRaf = 0;
      let progressStart = 0;

      slides.forEach((_, i) => {
        if (!dotsHost) return;
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "fx-slider__dot";
        dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
        dot.addEventListener("click", () => go(i, true));
        dotsHost.appendChild(dot);
      });

      const dots = dotsHost ? [...dotsHost.querySelectorAll<HTMLButtonElement>(".fx-slider__dot")] : [];

      const pad = (n: number) => String(n).padStart(2, "0");

      const setCount = () => {
        if (countEl) countEl.textContent = `${pad(index + 1)} / ${pad(slides.length)}`;
      };

      const setDots = () => {
        dots.forEach((d, i) => {
          d.classList.toggle("is-active", i === index);
          d.setAttribute("aria-current", i === index ? "true" : "false");
        });
      };

      const animateWords = (slide: HTMLElement) => {
        if (reduced) return;
        slide.querySelectorAll<HTMLElement>(".fx-slide__title .w").forEach((w, i) => {
          w.style.animationDelay = `${0.08 * i}s`;
          w.classList.remove("in");
          void w.offsetWidth;
          w.classList.add("in");
        });
      };

      const go = (next: number, user = false) => {
        if (next === index) return;
        if (next < 0) next = slides.length - 1;
        if (next >= slides.length) next = 0;

        const outgoing = slides[index];
        const incoming = slides[next];
        index = next;

        outgoing.classList.remove("is-active");
        outgoing.classList.add("is-leaving");
        outgoing.setAttribute("aria-hidden", "true");
        incoming.classList.add("is-active");
        incoming.setAttribute("aria-hidden", "false");

        setCount();
        setDots();
        animateWords(incoming);

        window.setTimeout(() => outgoing.classList.remove("is-leaving"), reduced ? 0 : 900);
        if (user) restartAutoplay();
      };

      const next = () => go(index + 1);
      const prev = () => go(index - 1);

      const stopProgress = () => {
        if (progressRaf) cancelAnimationFrame(progressRaf);
        progressRaf = 0;
        if (progress) progress.style.width = "0%";
      };

      const runProgress = () => {
        if (!progress || reduced || !autoplayMs) return;
        progressStart = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - progressStart) / autoplayMs);
          progress.style.width = `${t * 100}%`;
          if (t < 1) progressRaf = requestAnimationFrame(tick);
        };
        progressRaf = requestAnimationFrame(tick);
      };

      const stopAutoplay = () => {
        if (timer) clearInterval(timer);
        timer = null;
        stopProgress();
      };

      const startAutoplay = () => {
        stopAutoplay();
        if (reduced || !autoplayMs) return;
        runProgress();
        timer = setInterval(next, autoplayMs);
      };

      const restartAutoplay = () => startAutoplay();

      prevBtn?.addEventListener("click", prev);
      nextBtn?.addEventListener("click", next);

      const onClick = (e: MouseEvent) => {
        if ((e.target as Element).closest("a, button, .fx-slider__ui")) return;
        const rect = root.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < rect.width * 0.35) prev();
        else if (x > rect.width * 0.65) next();
      };

      const onKey = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft") prev();
        if (e.key === "ArrowRight") next();
      };

      root.addEventListener("click", onClick);
      root.addEventListener("keydown", onKey);
      root.addEventListener("mouseenter", stopAutoplay);
      root.addEventListener("mouseleave", startAutoplay);
      root.addEventListener("focusin", stopAutoplay);
      root.addEventListener("focusout", (e) => {
        if (!root.contains(e.relatedTarget as Node | null)) startAutoplay();
      });

      slides.forEach((s, i) => s.classList.toggle("is-active", i === index));
      setCount();
      setDots();
      animateWords(slides[index]);
      startAutoplay();

      cleanups.push(() => {
        stopAutoplay();
        root.removeEventListener("click", onClick);
        root.removeEventListener("keydown", onKey);
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
