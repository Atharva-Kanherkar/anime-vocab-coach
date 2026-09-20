/**
 * Pure HTML/CSS mockup of the AnimeVocab extension mid-episode (issue #117):
 * the anime scene with a highlighted subtitle word, the floating word card
 * (word, kana, romaji, meaning, the exact line it was spoken in), and the
 * Copilot sidebar with an AI coach exchange. No screenshots — every element
 * is real text, so the mockup itself is crawlable content that shows how the
 * product works. Decorative controls are spans (no fake buttons in the a11y
 * tree); the whole figure carries one descriptive label.
 */
export function ProductShot() {
  return (
    <figure
      className="shot"
      aria-label="AnimeVocab running over an anime scene: the subtitle word 退屈 is highlighted, a card shows its romaji and meaning, and the AI coach explains the nuance"
    >
      <div className="shot__scene">
        {/* Own site art, not a real show frame — no third-party imagery. */}
        <img
          className="shot__art"
          src="/slides/05-torii-night.jpg"
          alt="Anime scene of a torii gate and lanterns at night, with a Japanese subtitle line under it"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
        <div className="shot__chips" aria-hidden="true">
          <span className="shot__chip">Netflix · 12:04</span>
          <span className="shot__chip shot__chip--live">Listening Mode</span>
        </div>
        <div className="shot__subs">
          <p className="shot__sub" lang="ja">
            こんな夜は、<mark>退屈</mark>でできている。
          </p>
          <p className="shot__sub shot__sub--romaji">
            Konna yoru wa, <mark>taikutsu</mark> de dekite iru.
          </p>
        </div>
        <div className="shot__card">
          <span className="shot__chip shot__card-chip">New word · 12:04</span>
          <div className="shot__word-row">
            <span className="shot__word" lang="ja">
              退屈
            </span>
            <span className="shot__speak" aria-hidden="true">
              ▸ hear
            </span>
          </div>
          <p className="shot__kana" lang="ja">
            たいくつ
          </p>
          <p className="shot__gloss">
            taikutsu — <strong>boredom</strong>
          </p>
          <div className="shot__ctx">
            <span className="shot__label">In this line</span>
            <p className="shot__ctx-ja" lang="ja">
              こんな夜は、退屈でできている。
            </p>
            <p className="shot__ctx-romaji">
              Konna yoru wa, <mark>taikutsu</mark> de dekite iru.
            </p>
          </div>
          <div className="shot__foot" aria-hidden="true">
            <span className="shot__know">Know it</span>
            <span className="shot__ignore">Ignore</span>
            <span className="shot__xp">+1 XP</span>
          </div>
        </div>
      </div>
      <aside className="shot__panel">
        <div className="shot__head">
          <span className="shot__brand">AnimeVocab</span>
          <span className="shot__mode">Copilot</span>
        </div>
        <div className="shot__chat">
          <p className="shot__msg shot__msg--user">What does 退屈 mean here?</p>
          <p className="shot__msg shot__msg--ai">
            <span className="shot__msg-word" lang="ja">
              退屈
            </span>{" "}
            (taikutsu) — “boredom”. Here it is resigned, not dramatic: the speaker expects nothing
            from tonight. 退屈な夜 = “a boring night”.
          </p>
        </div>
        <div className="shot__stats" aria-hidden="true">
          <span>Level 4</span>
          <span>12 cards tonight</span>
          <span>streak 5 days</span>
        </div>
        <div className="shot__composer" aria-hidden="true">
          <span className="shot__input">Ask about this word…</span>
          <span className="shot__send">Ask</span>
        </div>
      </aside>
      <figcaption className="shot__caption">
        One word per line, in romaji, with the meaning and the exact moment it was spoken — and an
        AI coach that knows the scene.
      </figcaption>
    </figure>
  );
}
