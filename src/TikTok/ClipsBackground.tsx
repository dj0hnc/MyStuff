import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// inicio: segundo del archivo donde empieza la toma (para usar tramos de un video largo).
// archivo puede ser una foto (.jpg/.png/.webp): se ve completa sobre una copia desenfocada.
export type Clip = { archivo: string; duracion: number; inicio?: number };

type Props = {
  readonly clips: Clip[];
  readonly segundosPorClip?: number; // cada cuánto se corta al siguiente clip
  readonly from: string;
  readonly to: string;
};

// Secuencia de clips de fondo: va cortando de uno a otro cada N segundos con un
// fundido corto y un zoom lento en cada uno. Si el video dura más que la suma
// de los clips, vuelve a empezar. Sirve igual para clips de Pexels que para
// clips generados con IA.
export const ClipsBackground: React.FC<Props> = ({ clips, segundosPorClip = 3.5, from, to }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  if (clips.length === 0) return null;

  const cutF = Math.round(segundosPorClip * fps);
  const fadeF = Math.round(fps * 0.35);
  const cortes = Math.ceil(durationInFrames / cutF);

  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${from} 0%, ${to} 100%)` }}>
      {Array.from({ length: cortes }).map((_, i) => {
        const clip = clips[i % clips.length];
        const start = i * cutF;
        // Arrancar el clip en un punto distinto cada vez que se repite.
        const vuelta = Math.floor(i / clips.length);
        const maxOffset = Math.max(0, clip.duracion - segundosPorClip - 0.5);
        const offset = Math.min(maxOffset, vuelta * segundosPorClip) % Math.max(0.1, maxOffset + 0.1);
        return (
          <Sequence key={i} from={start} durationInFrames={cutF + fadeF} layout="none">
            <ClipShot src={clip.archivo} startFrom={Math.round(((clip.inicio ?? 0) + offset) * fps)} fadeF={fadeF} cutF={cutF} width={width} height={height} zoomIn={i % 2 === 0} />
          </Sequence>
        );
      })}
      {/* Capa oscura para que el texto se lea siempre */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${from}B3 0%, rgba(0,0,0,0.35) 45%, ${to}B3 100%)` }} />
      <AbsoluteFill style={{ opacity: interpolate(frame, [0, 10], [1, 0], { extrapolateRight: "clamp" }), background: "black" }} />
    </AbsoluteFill>
  );
};

const ClipShot: React.FC<{ src: string; startFrom: number; fadeF: number; cutF: number; width: number; height: number; zoomIn: boolean }> = ({
  src,
  startFrom,
  fadeF,
  cutF,
  width,
  height,
  zoomIn,
}) => {
  const f = useCurrentFrame();
  const opacity = interpolate(f, [cutF, cutF + fadeF], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoom = interpolate(f, [0, cutF + fadeF], zoomIn ? [1.0, 1.12] : [1.12, 1.0]);
  return (
    <AbsoluteFill style={{ opacity, transform: `scale(${zoom})` }}>
      {/\.(jpe?g|png|webp)$/i.test(src) ? (
        <>
          <Img src={staticFile(src)} style={{ position: "absolute", width, height, objectFit: "cover", filter: "blur(40px) brightness(0.55)", transform: "scale(1.15)" }} />
          <Img src={staticFile(src)} style={{ position: "absolute", width, height, objectFit: "contain" }} />
        </>
      ) : (
        <OffthreadVideo src={staticFile(src)} muted startFrom={startFrom} style={{ width, height, objectFit: "cover" }} />
      )}
    </AbsoluteFill>
  );
};
