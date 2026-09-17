// Genera una imagen con IA para usar de fondo, portada o personaje.
//
// Uso:  npm run imagen -- "zorro caricatura estilo vector" zorro
// Crea: public/img/zorro.jpg   (vertical; con --horizontal sale 16:9)
//
// Proveedores:
//   pollinations  gratis, sin clave. Calidad media. Es el que se usa si no hay FAL_KEY
//                 o si fal.ai no tiene saldo.
//   fal           FLUX en fal.ai, mejor calidad, cuesta fracciones de centavo. Requiere FAL_KEY con saldo.
// Fuerza uno con IMAGEN_PROVEEDOR=pollinations|fal en .env.

import { mkdir, writeFile, rename } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const horizontal = args.includes("--horizontal");
const [prompt, nombre = "imagen"] = args.filter((a) => !a.startsWith("--"));
if (!prompt) {
  console.error('Uso: npm run imagen -- "descripción de la imagen" nombre [--horizontal]');
  process.exit(1);
}

const size = horizontal ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
await mkdir("public/img", { recursive: true });

const ffmpeg = () => {
  const require = createRequire(import.meta.url);
  const pkg = require.resolve("@remotion/compositor-linux-x64-gnu/package.json");
  return join(dirname(pkg), "ffmpeg");
};

const conPollinations = async () => {
  const seed = Math.floor(Math.random() * 1e6);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${size.width}&height=${size.height}&nologo=true&seed=${seed}`;
  console.log(`Generando con Pollinations (gratis)...`);
  const res = await fetch(url);
  if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) {
    throw new Error(`Pollinations respondió ${res.status}`);
  }
  const tmp = `public/img/${nombre}.tmp.jpg`;
  await writeFile(tmp, Buffer.from(await res.arrayBuffer()));
  // Recorta la franja inferior donde a veces aparece la marca de agua y
  // escala al tamaño pedido.
  const destino = `public/img/${nombre}.jpg`;
  try {
    execFileSync(ffmpeg(), ["-y", "-loglevel", "error", "-i", tmp, "-vf",
      `crop=iw:ih*0.93:0:0,scale=${size.width}:${size.height}:force_original_aspect_ratio=increase,crop=${size.width}:${size.height}`,
      "-q:v", "3", destino]);
    execFileSync("rm", ["-f", tmp]);
  } catch {
    await rename(tmp, destino);
  }
  return destino;
};

const conFal = async () => {
  const { falRun, descargar } = await import("./fal.mjs");
  const model = process.env.FAL_IMAGEN_MODEL ?? "fal-ai/flux/schnell";
  console.log(`Generando con ${model} (fal.ai)...`);
  const out = await falRun(model, { prompt, image_size: size, num_images: 1, enable_safety_checker: true });
  const destino = `public/img/${nombre}.png`;
  await descargar(out.images[0].url, destino);
  return destino;
};

const proveedor = process.env.IMAGEN_PROVEEDOR ?? (process.env.FAL_KEY ? "fal" : "pollinations");
let destino;
if (proveedor === "fal") {
  try {
    destino = await conFal();
  } catch (e) {
    console.warn(`fal.ai no disponible (${e.message.split("\n")[0]}). Usando Pollinations gratis.`);
    destino = await conPollinations();
  }
} else {
  destino = await conPollinations();
}
console.log(`Listo: ${destino}. Úsala con fondoImagen: "${destino.replace("public/", "")}"`);
