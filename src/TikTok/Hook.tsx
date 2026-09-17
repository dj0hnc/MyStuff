import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type Props = { readonly text: string; readonly accent: string };

// Título gancho: entra con rebote, se queda, y sale hacia arriba.
export const Hook: React.FC<Props> = ({ text, accent }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const exit = spring({
    frame: frame - (durationInFrames - 20),
    fps,
    config: { damping: 200 },
  });

  const scale = interpolate(enter, [0, 1], [0.6, 1]);
  const y = interpolate(exit, [0, 1], [0, -400]);
  const opacity = interpolate(exit, [0, 1], [1, 0]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
      }}
    >
      <div
        style={{
          transform: `scale(${scale}) translateY(${y}px)`,
          opacity,
          fontFamily: "Inter, Helvetica, Arial, sans-serif",
          fontWeight: 900,
          fontSize: 120,
          lineHeight: 1.05,
          color: "white",
          textAlign: "center",
          textShadow: "0 12px 40px rgba(0,0,0,0.45)",
          textTransform: "uppercase",
          letterSpacing: -2,
        }}
      >
        {text}
        <div
          style={{
            marginTop: 30,
            height: 14,
            width: interpolate(enter, [0, 1], [0, 320]),
            background: accent,
            borderRadius: 7,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
