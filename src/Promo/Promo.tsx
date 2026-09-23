import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { z } from "zod";
import { zColor } from "@remotion/zod-types";
import { bebas, montserrat, script, serif } from "../TikTok/fonts";
import { ClipsBackground, type Clip } from "../TikTok/ClipsBackground";
import { CaptionsPro } from "../TikTok/CaptionsPro";
import type { Word } from "../TikTok/CaptionsVoz";

// Promo de marca: intro con logo y tagline → footage real con voz, subtítulos y
// tarjetas de servicios → cierre de marca. Paleta rosa / dorado / negro, pétalos.
export const promoSchema = z.object({
  marca: z.string(),
  sub: z.string(),
  tagline: z.string(),
  ciudad: z.string(),
  servicios: z.array(z.object({ icono: z.string(), texto: z.string() })),
  cta: z.string(),
  handle: z.string(),
  logo: z.string(),
  rosa: zColor(),
  rosaFuerte: zColor(),
  oro: zColor(),
  negro: zColor(),
  segundosPorClip: z.number(),
  titulo: z.string().default("").describe("Título del video, aparece sobre el footage los primeros segundos"),
  words: z.array(z.object({ text: z.string(), start: z.number(), end: z.number() })).default([]),
  voiceDuration: z.number().default(0),
  clips: z.array(z.object({ archivo: z.string(), duracion: z.number() })).default([]),
  palabrasClave: z.array(z.string()).default([]),
});
export type PromoProps = z.infer<typeof promoSchema>;

const FPS = 30, INTRO_S = 2.6, OUTRO_S = 3.0, TRANS_F = 12, LEAD_F = 6, TAIL_F = 10;

export const calculatePromoMetadata: CalculateMetadataFunction<PromoProps> = async ({ props }) => {
  const voz = (await (await fetch(staticFile("voz.json"))).json()) as { duration: number; words: Word[] };
  const c = await fetch(staticFile("clips.json")).catch(() => null);
  const clips: Clip[] = c?.ok ? ((await c.json()) as { clips: Clip[] }).clips : [];
  let palabrasClave = props.palabrasClave;
  const g = await fetch(staticFile("guion.json")).catch(() => null);
  if (g?.ok && !palabrasClave.length) palabrasClave = ((await g.json()) as { palabrasClave?: string[] }).palabrasClave ?? [];
  const voiceF = LEAD_F + Math.ceil(voz.duration * FPS) + TAIL_F;
  return {
    durationInFrames: Math.round(INTRO_S * FPS) + voiceF + Math.round(OUTRO_S * FPS) - 2 * TRANS_F,
    props: { ...props, words: voz.words, voiceDuration: voz.duration, clips, palabrasClave },
  };
};

export const Promo: React.FC<PromoProps> = (p) => {
  const { fps } = useVideoConfig();
  const introF = Math.round(INTRO_S * fps);
  const voiceF = LEAD_F + Math.ceil(p.voiceDuration * fps) + TAIL_F;
  const outroF = Math.round(OUTRO_S * fps);

  return (
    <AbsoluteFill style={{ background: p.rosa }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={introF}>
          <Intro {...p} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANS_F })} />
        <TransitionSeries.Sequence durationInFrames={voiceF}>
          <ClipsBackground clips={p.clips} segundosPorClip={p.segundosPorClip} from={p.negro} to={p.rosaFuerte} />
          <AbsoluteFill style={{ background: `linear-gradient(180deg, ${p.rosa}22, transparent 30%, transparent 70%, ${p.negro}99)` }} />
          <MarcoOro oro={p.oro} />
          {p.titulo ? <Titulo texto={p.titulo} oro={p.oro} negro={p.negro} rosa={p.rosa} /> : null}
          <Sequence from={LEAD_F} layout="none">
            <Audio src={staticFile("voz.mp3")} />
            <CaptionsPro words={p.words} accent={p.rosaFuerte} voiceSrc="voz.mp3" keywords={p.palabrasClave} />
            <Servicios servicios={p.servicios} words={p.words} oro={p.oro} negro={p.negro} rosa={p.rosa} />
          </Sequence>
          <Petalos rosa={p.rosa} rosaFuerte={p.rosaFuerte} cantidad={16} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANS_F })} />
        <TransitionSeries.Sequence durationInFrames={outroF}>
          <Outro {...p} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <div style={{ position: "absolute", top: 40, width: "100%", textAlign: "center", fontFamily: montserrat, fontWeight: 700, fontSize: 30, letterSpacing: 3, color: p.oro, textShadow: "0 2px 12px rgba(0,0,0,0.35)" }}>
        {p.handle}
      </div>
    </AbsoluteFill>
  );
};

// Los AbsoluteFill (fondo, pétalos, marco) son position:absolute y se pintan encima
// del flujo normal; el contenido va en una capa relativa con z-index para quedar arriba.
const CAPA: React.CSSProperties = { position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" };

const FondoRosa: React.FC<{ rosa: string; rosaFuerte: string }> = ({ rosa, rosaFuerte }) => (
  <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 35%, #FFFFFF 0%, ${rosa} 45%, ${rosaFuerte}66 100%)` }} />
);

const Intro: React.FC<PromoProps> = ({ marca, sub, tagline, logo, rosa, rosaFuerte, oro, negro }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 12, stiffness: 120 } });
  const t = spring({ frame: f - 14, fps, config: { damping: 14, stiffness: 140 } });
  const tag = spring({ frame: f - 26, fps, config: { damping: 14, stiffness: 140 } });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <FondoRosa rosa={rosa} rosaFuerte={rosaFuerte} />
      <Petalos rosa={rosa} rosaFuerte={rosaFuerte} cantidad={22} />
      <MarcoOro oro={oro} />
      <div style={CAPA}>
      <Img src={staticFile(logo)} style={{ width: 640, height: 640, borderRadius: 320, transform: `scale(${interpolate(s, [0, 1], [0.6, 1])})`, opacity: s, boxShadow: `0 40px 100px ${negro}55, 0 0 0 8px ${oro}` }} />
      <div style={{ marginTop: 50, opacity: t, transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)`, textAlign: "center" }}>
        <div style={{ fontFamily: serif, fontWeight: 700, fontSize: 88, color: negro, letterSpacing: 4 }}>{marca}</div>
        <div style={{ fontFamily: montserrat, fontWeight: 700, fontSize: 34, color: negro, letterSpacing: 10, marginTop: 6 }}>{sub}</div>
      </div>
      <div style={{ marginTop: 26, opacity: tag, transform: `scale(${interpolate(tag, [0, 1], [0.8, 1])})`, fontFamily: script, fontWeight: 700, fontSize: 92, color: rosaFuerte, textShadow: `0 4px 20px ${rosaFuerte}44` }}>
        {tagline}
      </div>
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC<PromoProps> = ({ marca, sub, ciudad, cta, handle, logo, rosa, rosaFuerte, oro, negro, tagline }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 12, stiffness: 130 } });
  const b = spring({ frame: f - 12, fps, config: { damping: 11, stiffness: 150 } });
  const pulse = 1 + Math.sin(f / 5) * 0.025;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <FondoRosa rosa={rosa} rosaFuerte={rosaFuerte} />
      <Petalos rosa={rosa} rosaFuerte={rosaFuerte} cantidad={22} />
      <MarcoOro oro={oro} />
      <div style={CAPA}>
      <Img src={staticFile(logo)} style={{ width: 460, height: 460, borderRadius: 230, transform: `scale(${interpolate(s, [0, 1], [0.6, 1])})`, opacity: s, boxShadow: `0 30px 80px ${negro}55, 0 0 0 8px ${oro}` }} />
      <div style={{ marginTop: 34, fontFamily: serif, fontWeight: 700, fontSize: 64, color: negro, letterSpacing: 3, opacity: s }}>{marca}</div>
      <div style={{ fontFamily: montserrat, fontWeight: 700, fontSize: 28, color: negro, letterSpacing: 8, opacity: s }}>{sub} · {ciudad}</div>
      <div style={{ marginTop: 44, transform: `scale(${interpolate(b, [0, 1], [0.5, 1]) * pulse})`, background: rosaFuerte, color: "white", fontFamily: montserrat, fontWeight: 900, fontSize: 58, padding: "28px 60px", borderRadius: 60, boxShadow: `0 24px 60px ${rosaFuerte}66, 0 0 0 5px ${oro}` }}>
        {cta}
      </div>
      <div style={{ marginTop: 30, fontFamily: script, fontWeight: 700, fontSize: 64, color: rosaFuerte, opacity: b }}>{tagline}</div>
      <div style={{ marginTop: 10, fontFamily: montserrat, fontWeight: 700, fontSize: 30, color: negro, opacity: b, letterSpacing: 2 }}>{handle}</div>
      </div>
    </AbsoluteFill>
  );
};

// Tarjetas de servicios: entran una por una a partir del momento en que la voz
// dice la primera palabra clave de servicios (o al 30% de la voz si no la hay).
const Servicios: React.FC<{ servicios: PromoProps["servicios"]; words: Word[]; oro: string; negro: string; rosa: string }> = ({ servicios, words, oro, negro, rosa }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const total = words.length ? words[words.length - 1].end : 10;
  const inicio = words.find((w) => /acr[ií]l|acryl|gel|servic/i.test(w.text))?.start ?? total * 0.3;
  const fin = inicio + 5.5;
  if (t < inicio - 0.2 || t > fin) return null;
  const out = interpolate(t, [fin - 0.35, fin], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 210, opacity: out }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {servicios.map((s, i) => {
          const e = spring({ frame: f - Math.round((inicio + i * 0.45) * fps), fps, config: { damping: 13, stiffness: 170 } });
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, transform: `translateX(${interpolate(e, [0, 1], [-80, 0])}px)`, opacity: e, background: `${rosa}EE`, border: `3px solid ${oro}`, borderRadius: 24, padding: "14px 30px", boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}>
              <span style={{ fontSize: 40, color: oro, width: 52, textAlign: "center" }}>{s.icono}</span>
              <span style={{ fontFamily: montserrat, fontWeight: 700, fontSize: 36, color: negro, letterSpacing: 1 }}>{s.texto}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// Título del video: entra con rebote, se queda 2.4 s y sube al salir.
const Titulo: React.FC<{ texto: string; oro: string; negro: string; rosa: string }> = ({ texto, oro, negro, rosa }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: f, fps, config: { damping: 12, stiffness: 150 } });
  const out = interpolate(f, [fps * 2.4, fps * 2.8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (out <= 0) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 200, opacity: out }}>
      <div style={{ transform: `translateY(${interpolate(e, [0, 1], [-40, 0]) - (1 - out) * 60}px) scale(${interpolate(e, [0, 1], [0.8, 1])})`, background: `${rosa}F2`, border: `4px solid ${oro}`, borderRadius: 28, padding: "22px 44px", fontFamily: bebas, fontSize: 92, lineHeight: 1, color: negro, textAlign: "center", maxWidth: 940, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        {texto}
      </div>
    </AbsoluteFill>
  );
};

const MarcoOro: React.FC<{ oro: string }> = ({ oro }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", inset: 26, border: `4px solid ${oro}`, borderRadius: 40, opacity: 0.9 }} />
    <div style={{ position: "absolute", inset: 36, border: `1.5px solid ${oro}`, borderRadius: 32, opacity: 0.6 }} />
  </AbsoluteFill>
);

// Pétalos de cerezo cayendo con giro suave.
const Petalos: React.FC<{ rosa: string; rosaFuerte: string; cantidad: number }> = ({ rosaFuerte, cantidad }) => {
  const f = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = f / fps;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: cantidad }).map((_, i) => {
        const speed = 90 + (i % 5) * 25;
        const y = ((t * speed + i * 173) % (height + 200)) - 100;
        const x = ((i * 191) % width) + Math.sin(t * 1.2 + i) * 40;
        const rot = t * 80 + i * 40;
        const size = 22 + (i % 4) * 8;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: size, height: size * 0.62, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%", background: `linear-gradient(135deg, #FFE1EC, ${rosaFuerte}AA)`, transform: `rotate(${rot}deg)`, opacity: 0.85, boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }} />
        );
      })}
    </AbsoluteFill>
  );
};
