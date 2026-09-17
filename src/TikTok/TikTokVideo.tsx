import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import type { TikTokProps } from "./schema";
import { Background } from "./Background";
import { Hook } from "./Hook";
import { Captions } from "./Captions";
import { Outro } from "./Outro";
import { Overlay } from "./Overlay";

// Estructura del video:
//   [ gancho 2 s ] [ subtítulos palabra por palabra ] [ cierre 1.5 s ]
// Cada bloque es una <Sequence>, así que su frame interno empieza en 0.
export const TikTokVideo: React.FC<TikTokProps> = ({
  hook,
  phrases,
  handle,
  cta,
  accent,
  bgFrom,
  bgTo,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const hookFrames = Math.round(fps * 2);
  const outroFrames = Math.round(fps * 1.5);
  const captionFrames = durationInFrames - hookFrames - outroFrames;

  return (
    <AbsoluteFill>
      <Background from={bgFrom} to={bgTo} />

      <Sequence durationInFrames={hookFrames}>
        <Hook text={hook} accent={accent} />
      </Sequence>

      <Sequence from={hookFrames} durationInFrames={captionFrames}>
        <Captions phrases={phrases} accent={accent} />
      </Sequence>

      <Sequence from={hookFrames + captionFrames} durationInFrames={outroFrames}>
        <Outro cta={cta} handle={handle} accent={accent} />
      </Sequence>

      <Overlay handle={handle} accent={accent} />
    </AbsoluteFill>
  );
};
