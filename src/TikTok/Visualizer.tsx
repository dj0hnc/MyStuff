import { staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";

type Props = { readonly src: string; readonly accent: string; readonly bars?: number };

// Barras que reaccionan a la voz. Se usa debajo de los subtítulos.
export const Visualizer: React.FC<Props> = ({ src, accent, bars = 32 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(staticFile(src));
  if (!audioData) return null;

  const raw = visualizeAudio({ fps, frame, audioData, numberOfSamples: bars, smoothing: true });
  // Normalizar por cuadro: las amplitudes crudas son diminutas. El piso evita
  // que el silencio se vea como ruido a tope.
  const max = Math.max(0.03, ...raw);
  // La energía de la voz vive en las frecuencias bajas (primeros bins). Se
  // toman esos y se reflejan para que el centro sea lo más alto.
  const half = raw.slice(0, bars / 2).map((v) => v / max);
  const values = [...half.slice().reverse(), ...half];

  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 8, height: 90 }}>
      {values.map((v, i) => {
        // Las frecuencias bajas dominan; comprimimos para que todas las barras se muevan.
        const h = 8 + Math.pow(v, 0.8) * 82;
        return (
          <div
            key={i}
            style={{
              width: 12,
              height: h,
              borderRadius: 6,
              background: i % 4 === 0 ? accent : "rgba(255,255,255,0.85)",
              boxShadow: `0 0 18px ${accent}66`,
            }}
          />
        );
      })}
    </div>
  );
};
