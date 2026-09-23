import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { montserrat } from "./fonts";

type Props = { readonly cta: string; readonly handle: string; readonly accent: string; readonly logo?: string };

// Cierre: botón de seguir que late, con anillo que se expande, y el usuario.
export const OutroPro: React.FC<Props> = ({ cta, handle, accent, logo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 11, stiffness: 150 } });
  const pulse = 1 + Math.sin(frame / 5) * 0.03;
  const ring = (frame % 30) / 30;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: montserrat }}>
      {logo ? (
        <Img
          src={staticFile(logo)}
          style={{ width: 420, height: 420, borderRadius: 210, marginBottom: 50, transform: `scale(${interpolate(enter, [0, 1], [0.5, 1])})`, boxShadow: `0 30px 80px rgba(0,0,0,0.5), 0 0 0 6px ${accent}` }}
        />
      ) : null}
      <div style={{ position: "relative", transform: `scale(${interpolate(enter, [0, 1], [0.4, 1]) * pulse})` }}>
        <div
          style={{
            position: "absolute",
            inset: -20,
            borderRadius: 80,
            border: `6px solid ${accent}`,
            opacity: 1 - ring,
            transform: `scale(${1 + ring * 0.35})`,
          }}
        />
        <div
          style={{
            background: accent,
            color: "#14121F",
            fontWeight: 900,
            fontSize: 62,
            padding: "30px 56px",
            whiteSpace: "nowrap",
            borderRadius: 60,
            textTransform: "uppercase",
            boxShadow: `0 24px 70px ${accent}66`,
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          <span style={{ fontSize: 56 }}>+</span>
          {cta}
        </div>
      </div>
      <div
        style={{
          marginTop: 60,
          opacity: interpolate(frame, [12, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          color: "white",
          fontWeight: 700,
          fontSize: 54,
        }}
      >
        {handle}
      </div>
    </AbsoluteFill>
  );
};
