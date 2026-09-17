import "./index.css";
import { Composition } from "remotion";
import { TikTokVideo } from "./TikTok/TikTokVideo";
import { tiktokSchema } from "./TikTok/schema";
import { TikTokVoz, tiktokVozSchema, calculateVozMetadata } from "./TikTok/TikTokVoz";
import { TikTokPro, tiktokProSchema, calculateProMetadata } from "./TikTok/TikTokPro";

// Cada <Composition> aparece en la barra lateral de Remotion Studio.
// Para renderizar: npx remotion render TikTok out/tiktok.mp4

const ejemplo = {
  hook: "3 cosas que nadie te dice",
  phrases: [
    "La primera es que empezar",
    "es más fácil de lo que crees",
    "La segunda es que nadie",
    "está mirando tan de cerca",
    "Y la tercera",
    "es que ya vas tarde",
    "así que hazlo hoy",
  ],
  handle: "@juanjo",
  cta: "Sígueme para más",
  accent: "#FFE600",
  bgFrom: "#5B21B6",
  bgTo: "#EC4899",
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Versión completa: fuentes, fondo animado, transiciones, voz, música y efectos.
          Requiere `npm run voz` y `npm run sonidos`. Fondo de video opcional con `npm run fondo`. */}
      <Composition
        id="TikTokPro"
        component={TikTokPro}
        schema={tiktokProSchema}
        calculateMetadata={calculateProMetadata}
        durationInFrames={30 * 15}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          hook: ejemplo.hook,
          kicker: "ATENCIÓN",
          handle: ejemplo.handle,
          cta: ejemplo.cta,
          accent: ejemplo.accent,
          bgFrom: "#1E1B4B",
          bgTo: "#BE185D",
          musica: true,
          volumenMusica: 0.22,
          efectos: true,
          fondoVideo: "",
          fondoImagen: "",
          palabrasClave: [],
          words: [],
          voiceDuration: 0,
          fondoSegundos: 10,
        }}
      />

      {/* Vertical 9:16 para TikTok, Reels y Shorts */}
      <Composition
        id="TikTok"
        component={TikTokVideo}
        schema={tiktokSchema}
        durationInFrames={30 * 12}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={ejemplo}
      />

      {/* Con voz de ElevenLabs y subtítulos sincronizados. Requiere `npm run voz`. */}
      <Composition
        id="TikTokVoz"
        component={TikTokVoz}
        schema={tiktokVozSchema}
        calculateMetadata={calculateVozMetadata}
        durationInFrames={30 * 12}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          hook: ejemplo.hook,
          handle: ejemplo.handle,
          cta: ejemplo.cta,
          accent: ejemplo.accent,
          bgFrom: ejemplo.bgFrom,
          bgTo: ejemplo.bgTo,
          words: [],
          voiceDuration: 0,
        }}
      />

      {/* El mismo componente en 16:9 para YouTube */}
      <Composition
        id="YouTube"
        component={TikTokVideo}
        schema={tiktokSchema}
        durationInFrames={30 * 12}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={ejemplo}
      />
    </>
  );
};
