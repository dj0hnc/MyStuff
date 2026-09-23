import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { z } from "zod";
import { bebas, montserrat } from "../TikTok/fonts";
import type { Bloque, EDL, Word } from "./types";

export const reeditSchema = z.object({
  edl: z.string().describe("Archivo EDL en public/, ej. reedit/edl.json"),
  data: z.any().optional(),
});
type Props = z.infer<typeof reeditSchema>;

const FPS = 30;
const durBloque = (b: Bloque) => b.video.to - b.video.from;

export const calculateReeditMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const res = await fetch(staticFile(props.edl));
  if (!res.ok) throw new Error(`No existe public/${props.edl}`);
  const data = (await res.json()) as EDL;
  const total = data.bloques.reduce((s, b) => s + durBloque(b), 0);
  return { durationInFrames: Math.ceil(total * FPS) + 1, fps: FPS, props: { ...props, data } };
};

export const Reedit: React.FC<Props> = ({ data }) => {
  const edl = data as EDL | undefined;
  const { fps, width, height } = useVideoConfig();
  if (!edl) return null;

  let cursor = 0;
  const bloques = edl.bloques.map((b) => {
    const start = cursor;
    const frames = Math.round(durBloque(b) * fps);
    cursor += frames;
    return { b, start, frames };
  });

  return (
    <AbsoluteFill style={{ background: "#0B0912" }}>
      {bloques.map(({ b, start, frames }, i) => {
        const color = b.quien === "ella" ? edl.colores.ella : b.quien === "el" ? edl.colores.el : "#FFFFFF";
        const audioFrom = b.audio === "sync" ? b.video.from : b.audio === "none" ? null : b.audio.from;
        return (
          <Sequence key={i} from={start} durationInFrames={frames} layout="none">
            <Shot src={edl.src} from={b.video.from} to={b.video.to} width={width} height={height} tint={b.quien} colores={edl.colores} srcW={edl.srcWidth ?? 720} srcH={edl.srcHeight ?? 958} />
            {audioFrom !== null ? (
              <Audio
                src={staticFile(edl.audioSrc)}
                startFrom={Math.round(audioFrom * fps)}
                endAt={Math.round(audioFrom * fps) + frames}
                volume={(f) =>
                  b.gain *
                  interpolate(f, [-1, Math.max(0, b.fadeIn ?? 3), frames - Math.max(0, b.fadeOut ?? 3), frames + 1], [b.fadeIn === 0 ? 1 : b.fadeIn ? 0 : 0.6, 1, 1, b.fadeOut === 0 ? 1 : b.fadeOut ? 0 : 0.7], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })
                }
              />
            ) : null}
            {b.label ? <Label text={b.label} sub={b.sub} pos={b.labelPos ?? "top"} color={color} frames={frames} /> : null}
            {b.dialogo ? <Dialogo words={edl.words} from={b.video.from} to={b.video.to} color={color} bottom={edl.subsBottom ?? 44} /> : null}
          </Sequence>
        );
      })}
      <Marca handle={edl.handle} />
    </AbsoluteFill>
  );
};

// Video fuente (720x958) sobre 1080x1920: fondo del mismo video desenfocado y
// oscurecido, primer plano a todo el ancho. Tinte suave según quién manda.
const Shot: React.FC<{ src: string; from: number; to: number; width: number; height: number; tint: Bloque["quien"]; colores: EDL["colores"]; srcW: number; srcH: number }> = ({
  src,
  from,
  to,
  width,
  height,
  tint,
  colores,
  srcW,
  srcH,
}) => {
  const { fps } = useVideoConfig();
  const f = useCurrentFrame();
  const startFrom = Math.round(from * fps);
  const endAt = Math.round(to * fps);
  // Fuente vertical más alta que 9:16: llena todo. Si no, va a todo lo ancho con fondo desenfocado.
  const fgH = Math.min(height, Math.round((width * srcH) / srcW));
  const zoom = interpolate(f, [0, (to - from) * fps], [1, 1.04]);
  const tintColor = tint === "ella" ? colores.ella : tint === "el" ? colores.el : null;
  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={staticFile(src)}
        muted
        startFrom={startFrom}
        endAt={endAt}
        style={{ width, height, objectFit: "cover", filter: "blur(28px) brightness(0.45) saturate(1.3)", transform: "scale(1.15)" }}
      />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ width, height: fgH, overflow: "hidden", borderRadius: 28, boxShadow: "0 30px 90px rgba(0,0,0,0.6)", transform: `scale(${zoom})` }}>
          <OffthreadVideo src={staticFile(src)} muted startFrom={startFrom} endAt={endAt} style={{ width, height: fgH, objectFit: "cover" }} />
        </div>
      </AbsoluteFill>
      {tintColor ? <AbsoluteFill style={{ background: tintColor, opacity: 0.07, mixBlendMode: "color" }} /> : null}
    </AbsoluteFill>
  );
};

const Label: React.FC<{ text: string; sub?: string; pos: "top" | "center"; color: string; frames: number }> = ({ text, sub, pos, color, frames }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 13, stiffness: 180 } });
  const exit = interpolate(f, [frames - 8, frames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: pos === "top" ? "flex-start" : "center", alignItems: "center", paddingTop: pos === "top" ? 92 : 0, opacity: exit }}>
      <div style={{ transform: `translateY(${interpolate(enter, [0, 1], [-40, 0])}px) scale(${interpolate(enter, [0, 1], [0.8, 1])})`, textAlign: "center", padding: "0 60px" }}>
        <div
          style={{
            fontFamily: bebas,
            fontSize: pos === "top" ? 88 : 120,
            lineHeight: 0.95,
            whiteSpace: text.length > 18 ? "normal" : "nowrap",
            color: "white",
            textShadow: `0 0 30px ${color}AA, 0 10px 30px rgba(0,0,0,0.7)`,
            WebkitTextStroke: "2px rgba(0,0,0,0.35)",
          }}
        >
          {text}
        </div>
        {sub ? (
          <div style={{ marginTop: 10, fontFamily: montserrat, fontWeight: 700, fontSize: 30, color, letterSpacing: 2, textShadow: "0 6px 20px rgba(0,0,0,0.7)" }}>{sub}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// Subtítulos del diálogo: frases de hasta 4 palabras, la palabra que suena en color.
const Dialogo: React.FC<{ words: Word[]; from: number; to: number; color: string; bottom: number }> = ({ words, from, to, color, bottom }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = from + f / fps;
  const ws = words.filter((w) => w.end > from && w.start < to);
  // Grupos de hasta 4 palabras que no cruzan una puntuación de cierre.
  const groups: Word[][] = [];
  let cur: Word[] = [];
  for (const w of ws) {
    cur.push(w);
    if (cur.length >= 4 || /[.!?,]$/.test(w.text)) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  const g = groups.find((gr) => t >= gr[0].start - 0.1 && t < gr[gr.length - 1].end + 0.35);
  if (!g) return null;
  const enter = spring({ frame: f - Math.round((g[0].start - 0.1 - from) * fps), fps, config: { damping: 14, stiffness: 200 } });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: bottom }}>
      <div
        style={{
          transform: `translateY(${interpolate(enter, [0, 1], [30, 0])}px)`,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          padding: "0 70px",
          fontFamily: montserrat,
          fontWeight: 900,
          fontSize: 62,
          lineHeight: 1.0,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {g.map((w, i) => {
          const active = t >= w.start && t < w.end + 0.08;
          return (
            <span key={i} style={{ color: active ? color : "white", WebkitTextStroke: "2px rgba(0,0,0,0.5)", textShadow: "0 8px 24px rgba(0,0,0,0.8)", transform: `scale(${active ? 1.08 : 1})`, display: "inline-block", margin: "4px 10px" }}>
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Marca: React.FC<{ handle: string }> = ({ handle }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", top: 34, width: "100%", textAlign: "center", fontFamily: montserrat, fontWeight: 700, fontSize: 30, color: "rgba(255,255,255,0.8)", letterSpacing: 2, textShadow: "0 4px 16px rgba(0,0,0,0.7)" }}>
      {handle}
    </div>
  </AbsoluteFill>
);
