import React from "react";
import { Composition } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { staticFile } from "remotion";
import { MangaReel } from "./MangaReel";
import { FPS, END_SECONDS, TITLE_SECONDS, demoSpec, sceneSecondsFallback, type ReelSpec } from "./spec";

// Scene length = narration audio length (+ a breath) when audio exists,
// otherwise reading-speed fallback. Total duration is derived, never guessed.
async function calculateMetadata({ props }: { props: { spec: ReelSpec; sceneFrames: number[] } }) {
  const spec = props.spec;
  const sceneFrames = await Promise.all(
    spec.scenes.map(async (scene) => {
      if (scene.audio) {
        const seconds = await getAudioDurationInSeconds(staticFile(scene.audio));
        return Math.round((seconds + 0.5) * FPS);
      }
      return Math.round(sceneSecondsFallback(scene) * FPS);
    })
  );
  const total =
    Math.round(TITLE_SECONDS * FPS) + sceneFrames.reduce((a, b) => a + b, 0) + Math.round(END_SECONDS * FPS);
  return { durationInFrames: total, props: { spec, sceneFrames } };
}

export const RemotionRoot: React.FC = () => (
  <Composition
    id="MangaReel"
    component={MangaReel}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={{ spec: demoSpec, sceneFrames: [] }}
    calculateMetadata={calculateMetadata}
  />
);
