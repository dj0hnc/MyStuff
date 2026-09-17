import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type Props = { readonly cta: string; readonly handle: string; readonly accent: string };

// Cierre: llamado a la acción en una pastilla de color y el usuario debajo.
export const Outro: React.FC<Props> = ({ cta, handle, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 140 } });
  const scale = interpolate(enter, [0, 1], [0.5, 1]);
  const handleOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          transform: `scale(${scale})`,
          background: accent,
          color: "#111",
          fontFamily: "Inter, Helvetica, Arial, sans-serif",
          fontWeight: 900,
          fontSize: 84,
          padding: "36px 70px",
          borderRadius: 60,
          textTransform: "uppercase",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        {cta}
      </div>
      <div
        style={{
          marginTop: 50,
          opacity: handleOpacity,
          color: "white",
          fontFamily: "Inter, Helvetica, Arial, sans-serif",
          fontWeight: 700,
          fontSize: 56,
        }}
      >
        {handle}
      </div>
    </AbsoluteFill>
  );
};
