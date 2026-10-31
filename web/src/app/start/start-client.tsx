"use client";

import { GoogleOneTap, SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DEV_NO_CLERK } from "@/lib/dev-auth";
import { trackSignin } from "@/lib/signin-funnel";
import { useExtensionLink } from "@/lib/use-extension-link";
import { CHROME_STORE_URL } from "@/lib/site";
import styles from "./start.module.css";

const SCENES = [
  ["明日、また会おう。", "Ashita, mata aou.", "Let's meet again tomorrow.", "明日", "ashita · tomorrow"],
  ["約束だよ。", "Yakusoku da yo.", "It's a promise.", "約束", "yakusoku · promise"],
  ["一緒に帰ろう。", "Issho ni kaerou.", "Let's go home together.", "一緒", "issho · together"],
  ["またね。", "Mata ne.", "See you again.", "また", "mata · again"],
];

function SubtitleDemo() {
  const [scene, setScene] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // A 20-second preview, then hold the final line.
    const timer = window.setInterval(() => setScene(s => Math.min(s + 1, SCENES.length - 1)), 5000);
    const stop = window.setTimeout(() => window.clearInterval(timer), 20000);
    return () => { window.clearInterval(timer); window.clearTimeout(stop); };
  }, []);
  const [ja, romaji, en, word, gloss] = SCENES[scene];
  return <div className={styles.demo}>
    <span className={styles.scene} aria-hidden>夜の帰り道</span>
    <div className={styles.subtitles}><p>{ja}</p><p>{romaji}</p><p>{en}</p></div>
    <p className={styles.word}>{word} <span>{gloss}</span></p>
  </div>;
}

function Connection() {
  const link = useExtensionLink();
  return (
    <div aria-live="polite">
      <h1>You&apos;re in</h1>
      <p>{link.installed && (link.tokenState === "ok" || link.extensionLinked)
        ? "The extension is connected. Go back to your episode and start learning."
        : link.state === "missing"
          ? "Your free account is ready. Install the extension to start learning while you watch."
          : "Your free account is ready. Connecting the extension..."}</p>
      {link.state === "missing" && <p><a href={CHROME_STORE_URL}>Install the free Chrome extension</a> to learn while you watch.</p>}
      {link.tokenState === "failed" && <p>{link.tokenError?.message} <button type="button" onClick={link.retry}>Try connecting again</button></p>}
      <nav className={styles.links} aria-label="Start watching">
        <a href="https://www.youtube.com">YouTube</a>
        <a href="https://www.crunchyroll.com">Crunchyroll</a>
        <a href="https://www.netflix.com">Netflix</a>
        <Link href="/app">Your words and reviews</Link>
      </nav>
    </div>
  );
}

export function StartClient({ signedIn, name }: { signedIn: boolean; name: string }) {
  const started = useRef(false);
  useEffect(() => {
    if (!signedIn) trackSignin("signin_gate_shown", "start_page");
  }, [signedIn]);

  function onStart() {
    if (started.current) return;
    started.current = true;
    trackSignin("signin_started", "start_page");
  }

  return (
    <div className={styles.layout}>
      <section className={styles.intro} aria-label="Dual subtitle demo">
        <p className={styles.eyebrow}>YOUR NEXT EPISODE IS A JAPANESE LESSON</p>
        <h2>Watch a scene.<br />Keep a word.</h2>
        <p>Understand the line, save the words you love, and review them when they&apos;re ready.</p>
        <SubtitleDemo />
        <p className={styles.caption}>Dual subtitles and words that stay with you. A preview of your next episode.</p>
      </section>
      <section className={styles.account} aria-label="Free account">
        <p className={styles.eyebrow}>FREE FOREVER. NO CARD.</p>
        {signedIn ? <><p>Welcome, {name}.</p><Connection /></> : <>
          <h1>Start learning with the anime you already watch</h1>
          <p>One free account keeps your words, reviews and progress on every device.</p>
          <div onClickCapture={onStart} onFocusCapture={onStart}>
            {!DEV_NO_CLERK && <>
              <GoogleOneTap signInForceRedirectUrl="/start" signUpForceRedirectUrl="/start" />
              <SignIn routing="hash" forceRedirectUrl="/start" signUpForceRedirectUrl="/start" />
            </>}
          </div>
        </>}
      </section>
    </div>
  );
}
