import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { fade } from "@remotion/transitions/fade";
import { z } from "zod";
import { zColor } from "@remotion/zod-types";
import { BackgroundPro } from "./BackgroundPro";
import { HookPro } from "./HookPro";
import { CaptionsPro } from "./CaptionsPro";
import { OutroPro } from "./OutroPro";
import { Overlay } from "./Overlay";
import type { Word } from "./CaptionsVoz";

export const tiktokProSchema = z.object({
  hook: z.string(),
  kicker: z.string(),
  handle: z.string(),
  cta: z.string(),
  accent: zColor(),
  bgFrom: zColor(),
  bgTo: zColor(),
  musica: z.boolean().describe("Música de fondo (public/musica.mp3)"),
  volumenMusica: z.number().min(0).max(1),
  efectos: z.boolean().describe("Whoosh y ding en las transiciones"),
  fondoVideo: z.string().describe("Video en public/ para el fondo. Vacío = sin video"),
  fondoImagen: z.string().describe("Imagen en public/ para el fondo (ej. img/zorro.png). Vacío = gradiente"),
  // Se llenan solos desde public/voz.json y public/fondo.json
  words: z.array(z.object({ text: z.string(), start: z.number(), end: z.number() })).default([]),
  voiceDuration: z.number().default(0),
  fondoSegundos: z.number().default(10),
});

export type TikTokProProps = z.infer<typeof tiktokProSchema>;

const FPS = 30;
const HOOK_S = 2.2;
const OUTRO_S = 1.8;
const TRANS_F = 14; // frames que dura cada transición
const LEAD_F = 8; // silencio antes de que arranque la voz
const TAIL_F = 12; // silencio después de la voz

export const calculateProMetadata: CalculateMetadataFunction<TikTokProProps> = async ({ props }) => {
  const res = await fetch(staticFile("voz.json"));
  if (!res.ok) throw new Error("No existe public/voz.json. Corre `npm run voz` primero.");
  const voz = (await res.json()) as { duration: number; words: Word[] };

  let fondoSegundos = props.fondoSegundos;
  if (props.fondoVideo) {
    const f = await fetch(staticFile("fondo.json")).catch(() => null);
    if (f?.ok) fondoSegundos = ((await f.json()) as { duracion: number }).duracion;
  }

  const hookF = Math.round(HOOK_S * FPS);
  const voiceSeqF = LEAD_F + Math.ceil(voz.duration * FPS) + TAIL_F;
  const outroF = Math.round(OUTRO_S * FPS);
  return {
    durationInFrames: hookF + voiceSeqF + outroF - 2 * TRANS_F,
    props: { ...props, words: voz.words, voiceDuration: voz.duration, fondoSegundos },
  };
};

export const TikTokPro: React.FC<TikTokProProps> = (p) => {
  const { fps, durationInFrames } = useVideoConfig();
  const hookF = Math.round(HOOK_S * fps);
  const voiceSeqF = LEAD_F + Math.ceil(p.voiceDuration * fps) + TAIL_F;
  const outroF = Math.round(OUTRO_S * fps);
  const voiceStart = hookF - TRANS_F;
  const outroStart = voiceStart + voiceSeqF - TRANS_F;

  // Música: más presente en gancho y cierre, baja cuando habla la voz, fade final.
  const musicVolume = (f: number) => {
    const duck = interpolate(f, [voiceStart, voiceStart + 15, outroStart - 10, outroStart + 10], [1, 0.45, 0.45, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const fadeOut = interpolate(f, [durationInFrames - 25, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const fadeIn = interpolate(f, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return p.volumenMusica * duck * fadeOut * fadeIn;
  };

  return (
    <AbsoluteFill style={{ background: p.bgFrom }}>
      <BackgroundPro from={p.bgFrom} to={p.bgTo} accent={p.accent} video={p.fondoVideo || undefined} videoSeconds={p.fondoSegundos} imagen={p.fondoImagen || undefined} />

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={hookF}>
          <HookPro text={p.hook} accent={p.accent} kicker={p.kicker} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: TRANS_F })} />

        <TransitionSeries.Sequence durationInFrames={voiceSeqF}>
          <Sequence from={LEAD_F}>
            <Audio src={staticFile("voz.mp3")} />
            <CaptionsPro words={p.words} accent={p.accent} voiceSrc="voz.mp3" />
          </Sequence>
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANS_F })} />

        <TransitionSeries.Sequence durationInFrames={outroF}>
          <OutroPro cta={p.cta} handle={p.handle} accent={p.accent} />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      <Overlay handle={p.handle} accent={p.accent} />

      {p.musica ? <Audio src={staticFile("musica.mp3")} loop volume={musicVolume} /> : null}

      {p.efectos ? (
        <>
          <Sequence from={2} durationInFrames={20}>
            <Audio src={staticFile("sfx/pop.mp3")} volume={0.6} />
          </Sequence>
          <Sequence from={voiceStart} durationInFrames={30}>
            <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.5} />
          </Sequence>
          <Sequence from={outroStart + 4} durationInFrames={30}>
            <Audio src={staticFile("sfx/ding.mp3")} volume={0.5} />
          </Sequence>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
