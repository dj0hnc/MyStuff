import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

type Props = { readonly handle: string; readonly accent: string };

// Elementos fijos: usuario arriba y barra de progreso abajo.
export const Overlay: React.FC<Props> = ({ handle, accent }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames], [0, 100]);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 140,
          width: "100%",
          textAlign: "center",
          color: "rgba(255,255,255,0.85)",
          fontFamily: "Inter, Helvetica, Arial, sans-serif",
          fontWeight: 700,
          fontSize: 44,
          letterSpacing: 2,
        }}
      >
        {handle}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 220,
          left: 90,
          right: 90,
          height: 10,
          background: "rgba(255,255,255,0.2)",
          borderRadius: 5,
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${progress}%`, height: "100%", background: accent }} />
      </div>
    </AbsoluteFill>
  );
};
