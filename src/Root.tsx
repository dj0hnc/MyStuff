import "./index.css";
import { Composition } from "remotion";
import { TikTokVideo } from "./TikTok/TikTokVideo";
import { tiktokSchema } from "./TikTok/schema";

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
