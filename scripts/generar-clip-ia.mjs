// Genera un clip de video con IA (fal.ai): a partir de texto, o animando una
// imagen (por ejemplo una caricatura hecha con `npm run imagen`).
//
// Uso:  npm run clip -- "ciudad neon de noche, cámara lenta"
//       npm run clip -- "el zorro saluda y sonríe" --imagen public/img/zorro.png
// Crea: public/clip.mp4  y  public/clip.json
//
// Modelos (cámbialos en .env):
//   FAL_VIDEO_MODEL        texto a video.   Por defecto fal-ai/wan/v2.2-5b/text-to-video (económico)
//                          Más calidad: fal-ai/kling-video/v2.5-turbo/pro/text-to-video
//   FAL_VIDEO_IMG_MODEL    imagen a video.  Por defecto fal-ai/kling-video/v2.1/standard/image-to-video
//
// Costo aproximado por clip de 5 s: de 10 a 50 centavos de dólar según el modelo.

import { writeFile } from "node:fs/promises";
import { falQueue, descargar, comoDataUri } from "./fal.mjs";

const args = process.argv.slice(2);
const imgIdx = args.indexOf("--imagen");
const imagen = imgIdx >= 0 ? args[imgIdx + 1] : null;
const prompt = args.filter((a, i) => !a.startsWith("--") && i !== imgIdx + 1).join(" ");
if (!prompt) {
  console.error('Uso: npm run clip -- "descripción" [--imagen public/img/x.png]');
  process.exit(1);
}

const model = imagen
  ? process.env.FAL_VIDEO_IMG_MODEL ?? "fal-ai/kling-video/v2.1/standard/image-to-video"
  : process.env.FAL_VIDEO_MODEL ?? "fal-ai/wan/v2.2-5b/text-to-video";

const input = { prompt, aspect_ratio: "9:16", duration: "5" };
if (imagen) input.image_url = await comoDataUri(imagen);

console.log(`Generando clip con ${model}. Suele tardar de 1 a 4 minutos...`);
let ultimo = "";
const out = await falQueue(model, input, (s) => {
  const linea = `${s.status}${s.queue_position != null ? ` (posición ${s.queue_position})` : ""}`;
  if (linea !== ultimo) {
    console.log(linea);
    ultimo = linea;
  }
});

const url = out.video?.url ?? out.videos?.[0]?.url;
if (!url) throw new Error(`Respuesta sin video: ${JSON.stringify(out).slice(0, 400)}`);
await descargar(url, "public/clip.mp4");
await writeFile("public/clip.json", JSON.stringify({ prompt, model, imagen, duracion: 5 }, null, 2));
console.log("Listo: public/clip.mp4. Úsalo con fondoVideo: \"clip.mp4\" en TikTokPro.");
