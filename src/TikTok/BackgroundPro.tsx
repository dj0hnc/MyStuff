import { AbsoluteFill, Img, Loop, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";

type Props = {
  readonly from: string;
  readonly to: string;
  readonly accent: string;
  readonly video?: string; // archivo en public/, vacío = sin video
  readonly videoSeconds?: number;
  readonly imagen?: string; // archivo en public/, vacío = sin imagen
};

const PARTICLES = 28;

// Fondo "pro": gradiente + manchas que flotan con ruido orgánico + partículas
// + grano fino. Si hay video de stock, va debajo con una capa oscura encima
// para que el texto siga legible.
export const BackgroundPro: React.FC<Props> = ({ from, to, accent, video, videoSeconds, imagen }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;

  const blob = (seed: string, base: [number, number], amp: number) => ({
    x: base[0] + noise2D(seed + "x", t * 0.12, 0) * amp,
    y: base[1] + noise2D(seed + "y", 0, t * 0.12) * amp,
  });
  const b1 = blob("a", [25, 25], 18);
  const b2 = blob("b", [78, 70], 18);
  const b3 = blob("c", [50, 95], 12);

  const grainShift = (frame % 7) * 37;
  // Cámara: zoom y paneo muy lentos, cambian de dirección cada ~4 s.
  const camScale = 1.04 + Math.sin(t * 0.8) * 0.03;
  const camX = noise2D("camx", t * 0.15, 0) * 18;
  const camY = noise2D("camy", 0, t * 0.15) * 18;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${from} 0%, ${to} 100%)` }}>
      <AbsoluteFill style={{ transform: `scale(${camScale}) translate(${camX}px, ${camY}px)` }}>
      {imagen && !video ? (
        <AbsoluteFill>
          <Img
            src={staticFile(imagen)}
            style={{
              width,
              height,
              objectFit: "cover",
              transform: `scale(${1.05 + t * 0.006})`, // zoom lento tipo Ken Burns
            }}
          />
          <AbsoluteFill style={{ background: `linear-gradient(180deg, ${from}99 0%, rgba(0,0,0,0.25) 45%, ${to}B3 100%)` }} />
        </AbsoluteFill>
      ) : null}

      {video ? (
        <AbsoluteFill>
          <Loop durationInFrames={Math.max(1, Math.round((videoSeconds ?? 10) * fps))}>
            <OffthreadVideo
              src={staticFile(video)}
              muted
              style={{ width, height, objectFit: "cover" }}
            />
          </Loop>
          <AbsoluteFill
            style={{
              background: `linear-gradient(180deg, ${from}CC 0%, rgba(0,0,0,0.35) 45%, ${to}CC 100%)`,
            }}
          />
        </AbsoluteFill>
      ) : null}

      <AbsoluteFill style={{ background: `radial-gradient(circle at ${b1.x}% ${b1.y}%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 38%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${b2.x}% ${b2.y}%, ${accent}55 0%, rgba(255,255,255,0) 40%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${b3.x}% ${b3.y}%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 45%)` }} />

      {Array.from({ length: PARTICLES }).map((_, i) => {
        const seed = `p${i}`;
        const baseX = ((i * 137.5) % 100);
        const speed = 18 + (i % 5) * 6;
        const y = ((height + 200) - ((t * speed + i * 140) % (height + 200)));
        const x = (baseX / 100) * width + noise2D(seed, t * 0.3, i) * 60;
        const size = 4 + (i % 4) * 3;
        const alpha = interpolate(y, [0, height * 0.15, height * 0.85, height], [0, 0.55, 0.55, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div
            key={seed}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: size,
              background: i % 3 === 0 ? accent : "white",
              opacity: alpha,
              filter: "blur(0.5px)",
            }}
          />
        );
      })}

      <AbsoluteFill style={{ opacity: 0.07, mixBlendMode: "overlay" }}>
        <svg width={width} height={height} style={{ transform: `translate(${-grainShift}px, ${-grainShift}px)`, width: width + 300, height: height + 300 }}>
          <filter id="grano">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grano)" />
        </svg>
      </AbsoluteFill>

      </AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)" }} />
    </AbsoluteFill>
  );
};
