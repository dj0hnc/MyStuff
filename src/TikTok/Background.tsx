import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

type Props = { readonly from: string; readonly to: string };

// Fondo con gradiente y dos manchas de luz que se mueven lento.
export const Background: React.FC<Props> = ({ from, to }) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 300], [0, 1]);
  const x1 = 20 + Math.sin(drift * Math.PI * 2) * 15;
  const y1 = 25 + Math.cos(drift * Math.PI * 2) * 10;
  const x2 = 80 - Math.sin(drift * Math.PI * 2) * 15;
  const y2 = 75 - Math.cos(drift * Math.PI * 2) * 10;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${from} 0%, ${to} 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${x1}% ${y1}%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 40%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${x2}% ${y2}%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 45%)`,
        }}
      />
    </AbsoluteFill>
  );
};
