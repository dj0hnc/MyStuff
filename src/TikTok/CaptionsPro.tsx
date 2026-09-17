import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { montserrat } from "./fonts";
import type { Word } from "./CaptionsVoz";
import { Visualizer } from "./Visualizer";

type Props = {
  readonly words: Word[];
  readonly accent: string;
  readonly perLine?: number;
  readonly voiceSrc: string;
  readonly keywords?: string[];
};

// Palabras sin peso: cuando están activas solo se encienden en blanco, sin pastilla.
const VACIAS = new Set(
  (
    "el la los las un una unos unas de del al a en con por para que se su sus lo le les y o u e ni es son era fue ser no si te me nos mi tu tus mis " +
    "the a an of to in on at for with and or but is are was were be been it its this that these those you your my me we our they them he she his her not so if as by from into than then"
  ).split(" "),
);
const limpia = (w: string) => w.toLowerCase().replace(/[^a-záéíóúñü]/g, "");

// Subtítulos "pro": Montserrat 900, la palabra activa va dentro de una pastilla
// de color que rota un poco, las demás en blanco con contorno. Debajo, el
// visualizador de la voz.
export const CaptionsPro: React.FC<Props> = ({ words, accent, perLine = 3, voiceSrc, keywords = [] }) => {
  const claves = new Set(keywords.map(limpia));
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const groups: Word[][] = [];
  for (let i = 0; i < words.length; i += perLine) groups.push(words.slice(i, i + perLine));

  const gi = groups.findIndex((g) => t >= g[0].start - 0.12 && t < g[g.length - 1].end + 0.12);
  const group = gi >= 0 ? groups[gi] : null;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 60px" }}>
      <div style={{ height: 420, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
        {group ? (
          <Line group={group} accent={accent} t={t} frame={frame} fps={fps} tilt={gi % 2 === 0 ? -2 : 2} claves={claves} />
        ) : null}
      </div>
      <div style={{ marginTop: 40 }}>
        <Visualizer src={voiceSrc} accent={accent} />
      </div>
    </AbsoluteFill>
  );
};

const Line: React.FC<{ group: Word[]; accent: string; t: number; frame: number; fps: number; tilt: number; claves: Set<string> }> = ({
  group,
  accent,
  t,
  frame,
  fps,
  tilt,
  claves,
}) => {
  const startFrame = Math.round((group[0].start - 0.12) * fps);
  const enter = spring({ frame: frame - startFrame, fps, config: { damping: 13, stiffness: 190 } });
  const scale = interpolate(enter, [0, 1], [0.7, 1]);
  const y = interpolate(enter, [0, 1], [40, 0]);

  return (
    <div
      style={{
        transform: `translateY(${y}px) scale(${scale}) rotate(${tilt * (1 - enter) + tilt * 0.3}deg)`,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: "14px 20px",
        fontFamily: montserrat,
        fontWeight: 900,
        fontSize: 92,
        lineHeight: 1.05,
        textTransform: "uppercase",
        textAlign: "center",
        letterSpacing: -1,
      }}
    >
      {group.map((w) => {
        const isActive = t >= w.start && t < w.end + 0.06;
        const isPast = t >= w.end + 0.06;
        const key = limpia(w.text);
        const esClave = claves.has(key);
        const conPastilla = isActive && (esClave || (!VACIAS.has(key) && key.length > 3));
        const pop = spring({ frame: frame - Math.round(w.start * fps), fps, config: { damping: 9, stiffness: 220 } });
        const s = isActive ? interpolate(pop, [0, 1], [0.8, esClave ? 1.14 : 1.06]) : 1;
        return (
          <span
            key={`${w.start}-${w.text}`}
            style={{
              display: "inline-block",
              transform: `scale(${s})`,
              padding: conPastilla ? "6px 26px" : "6px 0",
              borderRadius: 26,
              background: conPastilla ? accent : "transparent",
              color: conPastilla ? "#14121F" : isActive ? "white" : isPast ? (esClave ? accent : "white") : "rgba(255,255,255,0.45)",
              WebkitTextStroke: conPastilla ? "0px" : "2px rgba(0,0,0,0.35)",
              textShadow: conPastilla ? "none" : `0 10px 30px rgba(0,0,0,0.55)${esClave ? `, 0 0 30px ${accent}88` : ""}`,
              boxShadow: conPastilla ? `0 18px 50px ${accent}77` : "none",
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
