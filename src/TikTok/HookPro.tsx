import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { bebas, montserrat } from "./fonts";

type Props = { readonly text: string; readonly accent: string; readonly kicker?: string; readonly logo?: string };

// Gancho: cada palabra cae desde arriba con rebote, una tras otra.
export const HookPro: React.FC<Props> = ({ text, accent, kicker = "ATENCIÓN", logo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  const kick = spring({ frame, fps, config: { damping: 14, stiffness: 200 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 70 }}>
      {logo ? (
        <Img
          src={staticFile(logo)}
          style={{
            width: 360,
            height: 360,
            borderRadius: 180,
            marginBottom: 40,
            transform: `scale(${interpolate(kick, [0, 1], [0.6, 1])})`,
            opacity: kick,
            boxShadow: `0 30px 80px rgba(0,0,0,0.5), 0 0 0 6px ${accent}`,
          }}
        />
      ) : null}
      <div
        style={{
          display: logo ? "none" : "block",
          transform: `scale(${interpolate(kick, [0, 1], [0.6, 1])})`,
          opacity: kick,
          fontFamily: montserrat,
          fontWeight: 700,
          fontSize: 38,
          letterSpacing: 8,
          color: "#14121F",
          background: accent,
          padding: "10px 28px",
          borderRadius: 14,
          marginBottom: 40,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 26px", maxWidth: 940,
          fontFamily: bebas,
          fontSize: 168,
          lineHeight: 0.95,
          color: "white",
          textAlign: "center",
          textShadow: "0 16px 50px rgba(0,0,0,0.5)",
        }}
      >
        {words.map((w, i) => {
          const s = spring({ frame: frame - 4 - i * 5, fps, config: { damping: 11, stiffness: 150 } });
          return (
            <span
              key={`${w}-${i}`}
              style={{
                display: "inline-block",
                transform: `translateY(${interpolate(s, [0, 1], [-300, 0])}px) rotate(${interpolate(s, [0, 1], [-8, 0])}deg)`,
                opacity: s,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
