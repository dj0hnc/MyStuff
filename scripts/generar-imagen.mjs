// Genera una imagen con IA (fal.ai) para usar de fondo, portada o personaje.
//
// Uso:  npm run imagen -- "zorro caricatura estilo vector" zorro
// Crea: public/img/zorro.png   (vertical 1080x1920)
//
// Modelo por defecto: FLUX schnell, rápido y muy barato (fracciones de centavo).
// Para más calidad: FAL_IMAGEN_MODEL=fal-ai/flux/dev en .env.
// Para horizontal (YouTube): agrega --horizontal

import { mkdir } from "node:fs/promises";
import { falRun, descargar } from "./fal.mjs";

const args = process.argv.slice(2);
const horizontal = args.includes("--horizontal");
const [prompt, nombre = "imagen"] = args.filter((a) => !a.startsWith("--"));
if (!prompt) {
  console.error('Uso: npm run imagen -- "descripción de la imagen" nombre');
  process.exit(1);
}

const model = process.env.FAL_IMAGEN_MODEL ?? "fal-ai/flux/schnell";
const size = horizontal ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };

console.log(`Generando "${prompt}" con ${model}...`);
const out = await falRun(model, { prompt, image_size: size, num_images: 1, enable_safety_checker: true });

await mkdir("public/img", { recursive: true });
const destino = `public/img/${nombre}.png`;
await descargar(out.images[0].url, destino);
console.log(`Listo: ${destino}`);
