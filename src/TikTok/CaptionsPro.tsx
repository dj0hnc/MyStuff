import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { montserrat } from "./fonts";
import type { Word } from "./CaptionsVoz";
import { Visualizer } from "./Visualizer";

type Props = { readonly words: Word[]; readonly accent: string; readonly perLine?: number; readonly voiceSrc: string };

// Subtítulos "pro": Montserrat 900, la palabra activa va dentro de una pastilla
// de color que rota un poco, las demás en blanco con contorno. Debajo, el
// visualizador de la voz.
export const CaptionsPro: React.FC<Props> = ({ words, accent, perLine = 3, voiceSrc }) => {
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
          <Line group={group} accent={accent} t={t} frame={frame} fps={fps} tilt={gi % 2 === 0 ? -2 : 2} />
        ) : null}
      </div>
      <div style={{ marginTop: 40 }}>
        <Visualizer src={voiceSrc} accent={accent} />
      </div>
    </AbsoluteFill>
  );
};

const Line: React.FC<{ group: Word[]; accent: string; t: number; frame: number; fps: number; tilt: number }> = ({
  group,
  accent,
  t,
  frame,
  fps,
  tilt,
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
        const pop = spring({ frame: frame - Math.round(w.start * fps), fps, config: { damping: 9, stiffness: 220 } });
        const s = isActive ? interpolate(pop, [0, 1], [0.8, 1.08]) : 1;
        return (
          <span
            key={`${w.start}-${w.text}`}
            style={{
              display: "inline-block",
              transform: `scale(${s})`,
              padding: isActive ? "6px 26px" : "6px 0",
              borderRadius: 26,
              background: isActive ? accent : "transparent",
              color: isActive ? "#14121F" : isPast ? "white" : "rgba(255,255,255,0.45)",
              WebkitTextStroke: isActive ? "0px" : "2px rgba(0,0,0,0.35)",
              textShadow: isActive ? "none" : "0 10px 30px rgba(0,0,0,0.55)",
              boxShadow: isActive ? `0 18px 50px ${accent}77` : "none",
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
