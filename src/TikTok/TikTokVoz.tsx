import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { z } from "zod";
import { zColor } from "@remotion/zod-types";
import { Background } from "./Background";
import { Hook } from "./Hook";
import { Outro } from "./Outro";
import { Overlay } from "./Overlay";
import { CaptionsVoz, type Word } from "./CaptionsVoz";

export const tiktokVozSchema = z.object({
  hook: z.string(),
  handle: z.string(),
  cta: z.string(),
  accent: zColor(),
  bgFrom: zColor(),
  bgTo: zColor(),
  // Se llenan automáticamente desde public/voz.json
  words: z.array(z.object({ text: z.string(), start: z.number(), end: z.number() })).default([]),
  voiceDuration: z.number().default(0),
});

export type TikTokVozProps = z.infer<typeof tiktokVozSchema>;

const HOOK_SECONDS = 2;
const OUTRO_SECONDS = 1.5;

// Antes de renderizar, lee voz.json y ajusta la duración del video al audio.
export const calculateVozMetadata: CalculateMetadataFunction<TikTokVozProps> = async ({ props }) => {
  const res = await fetch(staticFile("voz.json"));
  if (!res.ok) {
    throw new Error("No existe public/voz.json. Corre `npm run voz` primero.");
  }
  const data = (await res.json()) as { duration: number; words: Word[] };
  const fps = 30;
  const total = HOOK_SECONDS + data.duration + OUTRO_SECONDS;
  return {
    durationInFrames: Math.ceil(total * fps),
    props: { ...props, words: data.words, voiceDuration: data.duration },
  };
};

export const TikTokVoz: React.FC<TikTokVozProps> = ({ hook, handle, cta, accent, bgFrom, bgTo, words, voiceDuration }) => {
  const { fps } = useVideoConfig();
  const hookFrames = Math.round(fps * HOOK_SECONDS);
  const voiceFrames = Math.ceil(fps * voiceDuration);
  const outroFrames = Math.round(fps * OUTRO_SECONDS);

  return (
    <AbsoluteFill>
      <Background from={bgFrom} to={bgTo} />

      <Sequence durationInFrames={hookFrames}>
        <Hook text={hook} accent={accent} />
      </Sequence>

      <Sequence from={hookFrames} durationInFrames={voiceFrames}>
        <Audio src={staticFile("voz.mp3")} />
        <CaptionsVoz words={words} accent={accent} />
      </Sequence>

      <Sequence from={hookFrames + voiceFrames} durationInFrames={outroFrames}>
        <Outro cta={cta} handle={handle} accent={accent} />
      </Sequence>

      <Overlay handle={handle} accent={accent} />
    </AbsoluteFill>
  );
};
