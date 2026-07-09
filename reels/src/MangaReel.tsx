import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadNoto } from "@remotion/google-fonts/NotoSansJP";
import { FPS, END_SECONDS, TITLE_SECONDS, sceneSecondsFallback, type ReelSpec, type Scene } from "./spec";

const anton = loadAnton();
const noto = loadNoto();

const PAPER = "#141210";
const INK = "#f6efe2";

// Halftone-ish paper texture, pure CSS so nothing external is fetched.
const grain: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1.4px), radial-gradient(rgba(0,0,0,0.35) 1px, transparent 1.6px)",
  backgroundSize: "7px 7px, 11px 11px",
  backgroundPosition: "0 0, 4px 6px",
};

function kenBurns(frame: number, duration: number, scene: Scene, index: number) {
  const zoomIn = scene.zoom ? scene.zoom === "in" : index % 2 === 0;
  const t = interpolate(frame, [0, duration], [0, 1], { extrapolateRight: "clamp" });
  const scale = zoomIn ? 1.06 + t * 0.14 : 1.2 - t * 0.14;
  const drift = (index % 2 === 0 ? 1 : -1) * t * 24;
  const focusY = scene.focus === "top" ? "20%" : scene.focus === "bottom" ? "80%" : "50%";
  return { scale, drift, focusY };
}

const Panel: React.FC<{ scene: Scene; index: number; duration: number; accent: string; credit?: string }> = ({
  scene,
  index,
  duration,
  accent,
  credit,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { scale, drift, focusY } = kenBurns(frame, duration, scene, index);

  const enter = spring({ frame, fps: FPS, config: { damping: 200 }, durationInFrames: 14 });
  const captionIn = spring({ frame: frame - 6, fps: FPS, config: { damping: 16, stiffness: 140 }, durationInFrames: 22 });

  return (
    <AbsoluteFill style={{ backgroundColor: PAPER }}>
      <AbsoluteFill style={grain} />
      {/* Framed panel, slight alternating tilt like a page on a desk. */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: width * 0.88,
            height: height * 0.66,
            transform: `rotate(${index % 2 === 0 ? -1.1 : 1.1}deg) scale(${0.96 + enter * 0.04})`,
            border: `10px solid ${INK}`,
            boxShadow: "0 30px 80px rgba(0,0,0,0.65)",
            overflow: "hidden",
            backgroundColor: "#fff",
          }}
        >
          <Img
            src={staticFile(scene.image)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: `50% ${focusY}`,
              transform: `scale(${scale}) translateX(${drift}px)`,
            }}
          />
        </div>
      </AbsoluteFill>

      {/* Narration caption. */}
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 170 }}>
        <div
          style={{
            maxWidth: width * 0.86,
            transform: `translateY(${(1 - captionIn) * 40}px)`,
            opacity: captionIn,
            backgroundColor: "rgba(10,9,8,0.82)",
            border: `3px solid ${INK}`,
            padding: "26px 34px",
            fontFamily: noto.fontFamily,
            fontWeight: 900,
            fontSize: 44,
            lineHeight: 1.35,
            color: INK,
            textAlign: "center",
          }}
        >
          <span style={{ color: accent, marginRight: 14 }}>▸</span>
          {scene.text}
        </div>
      </AbsoluteFill>

      {scene.audio ? <Audio src={staticFile(scene.audio)} /> : null}
      {index === 0 && credit ? (
        <div
          style={{
            position: "absolute",
            top: 120,
            width: "100%",
            textAlign: "center",
            fontFamily: noto.fontFamily,
            fontSize: 24,
            letterSpacing: "0.08em",
            color: "rgba(246,239,226,0.55)",
          }}
        >
          {credit}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const TitleCard: React.FC<{ spec: ReelSpec; accent: string }> = ({ spec, accent }) => {
  const frame = useCurrentFrame();
  const pop = spring({ frame, fps: FPS, config: { damping: 12, stiffness: 120 }, durationInFrames: 24 });
  const chipIn = spring({ frame: frame - 8, fps: FPS, config: { damping: 200 }, durationInFrames: 14 });
  return (
    <AbsoluteFill style={{ backgroundColor: PAPER, alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={grain} />
      <div
        style={{
          opacity: chipIn,
          backgroundColor: accent,
          color: PAPER,
          fontFamily: noto.fontFamily,
          fontWeight: 900,
          fontSize: 30,
          letterSpacing: "0.28em",
          padding: "12px 28px",
          transform: `rotate(-2deg)`,
          marginBottom: 42,
        }}
      >
        {spec.series}
      </div>
      <div
        style={{
          fontFamily: anton.fontFamily,
          fontSize: 108,
          lineHeight: 1.04,
          color: INK,
          textAlign: "center",
          width: "84%",
          transform: `scale(${0.8 + pop * 0.2})`,
          textShadow: `6px 6px 0 ${accent}`,
        }}
      >
        {spec.title}
      </div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ spec: ReelSpec; accent: string }> = ({ spec, accent }) => {
  const frame = useCurrentFrame();
  const inSpring = spring({ frame, fps: FPS, config: { damping: 14 }, durationInFrames: 20 });
  return (
    <AbsoluteFill style={{ backgroundColor: PAPER, alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={grain} />
      <div
        style={{
          transform: `scale(${0.85 + inSpring * 0.15})`,
          textAlign: "center",
          fontFamily: anton.fontFamily,
        }}
      >
        <div style={{ fontSize: 58, color: INK, marginBottom: 30 }}>make your own manga</div>
        <div
          style={{
            display: "inline-block",
            backgroundColor: accent,
            color: PAPER,
            fontSize: 54,
            padding: "20px 44px",
            transform: "rotate(-1.4deg)",
          }}
        >
          {spec.handle}
        </div>
        {spec.credit ? (
          <div style={{ marginTop: 60, fontFamily: noto.fontFamily, fontSize: 24, color: "rgba(246,239,226,0.5)" }}>
            {spec.credit}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const MangaReel: React.FC<{ spec: ReelSpec; sceneFrames: number[] }> = ({ spec, sceneFrames }) => {
  const accent = spec.accent ?? "#e4572e";
  const titleFrames = Math.round(TITLE_SECONDS * FPS);
  const endFrames = Math.round(END_SECONDS * FPS);
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  let cursor = titleFrames;
  const sequences = spec.scenes.map((scene, i) => {
    const from = cursor;
    const frames = sceneFrames[i] ?? Math.round(sceneSecondsFallback(scene) * FPS);
    cursor += frames;
    return (
      <Sequence key={i} from={from} durationInFrames={frames}>
        <Panel scene={scene} index={i} duration={frames} accent={accent} credit={spec.credit} />
      </Sequence>
    );
  });

  return (
    <AbsoluteFill>
      <Sequence durationInFrames={titleFrames}>
        <TitleCard spec={spec} accent={accent} />
      </Sequence>
      {sequences}
      <Sequence from={cursor} durationInFrames={endFrames}>
        <EndCard spec={spec} accent={accent} />
      </Sequence>
      {/* Progress bar on top of everything. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: 12,
          width: `${(frame / durationInFrames) * 100}%`,
          backgroundColor: accent,
        }}
      />
      {spec.music ? <Audio src={staticFile(spec.music)} volume={0.25} loop /> : null}
    </AbsoluteFill>
  );
};
