import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type Word = { text: string; start: number; end: number };

type Props = { readonly words: Word[]; readonly accent: string; readonly perLine?: number };

// Subtítulos sincronizados con la voz. Se muestran grupos de pocas palabras;
// la que está sonando se resalta con el color de acento.
export const CaptionsVoz: React.FC<Props> = ({ words, accent, perLine = 4 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Agrupar palabras en líneas de tamaño fijo.
  const groups: Word[][] = [];
  for (let i = 0; i < words.length; i += perLine) {
    groups.push(words.slice(i, i + perLine));
  }

  const group = groups.find((g) => t >= g[0].start - 0.15 && t < g[g.length - 1].end + 0.15);
  if (!group) return null;

  const groupStartFrame = Math.round((group[0].start - 0.15) * fps);
  const enter = spring({ frame: frame - groupStartFrame, fps, config: { damping: 14, stiffness: 160 } });
  const y = interpolate(enter, [0, 1], [50, 0]);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 70px" }}>
      <div
        style={{
          transform: `translateY(${y}px)`,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "10px 22px",
          fontFamily: "Inter, Helvetica, Arial, sans-serif",
          fontWeight: 900,
          fontSize: 96,
          lineHeight: 1.1,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {group.map((w) => {
          const isActive = t >= w.start && t < w.end + 0.05;
          const isPast = t >= w.end + 0.05;
          const pop = spring({ frame: frame - Math.round(w.start * fps), fps, config: { damping: 10, stiffness: 200 } });
          const scale = isActive ? interpolate(pop, [0, 1], [0.85, 1.12]) : 1;
          const color = isActive ? accent : isPast ? "white" : "rgba(255,255,255,0.35)";
          return (
            <span
              key={`${w.start}-${w.text}`}
              style={{
                display: "inline-block",
                transform: `scale(${scale})`,
                color,
                textShadow: isActive ? `0 0 40px ${accent}66, 0 10px 30px rgba(0,0,0,0.5)` : "0 10px 30px rgba(0,0,0,0.5)",
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
