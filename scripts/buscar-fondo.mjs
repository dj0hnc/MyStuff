// Busca videos verticales de stock en Pexels y los descarga como fondo.
//
// Uso:  npm run fondo -- "ciudad de noche neon"              -> public/fondo.mp4 (un solo clip)
//       npm run fondo -- "laptop frustrado" "reloj" "correr"  -> public/clips/01.mp4, 02.mp4... + public/clips.json
//                                                               (varios clips que el video va cortando en secuencia)
//
// Necesita PEXELS_API_KEY en .env. La clave es gratis:
// https://www.pexels.com/api/  ->  "Get Started"  ->  copiar la clave.

import { writeFile } from "node:fs/promises";

const apiKey = process.env.PEXELS_API_KEY;
if (!apiKey) {
  console.error("Falta PEXELS_API_KEY en .env. Consíguela gratis en https://www.pexels.com/api/");
  process.exit(1);
}

const queries = process.argv.slice(2).filter(Boolean);
if (queries.length === 0) queries.push("abstract gradient motion");

const buscar = async (query, minDur, maxDur) => {
  const url = new URL("https://api.pexels.com/videos/search");
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", "portrait");
  url.searchParams.set("size", "medium");
  url.searchParams.set("per_page", "15");
  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) throw new Error(`Pexels respondió ${res.status}: ${await res.text()}`);
  const { videos } = await res.json();
  if (!videos?.length) throw new Error(`Sin resultados para "${query}"`);
  // Preferir clips en el rango de duración con un archivo vertical cercano a 1080x1920.
  const candidatos = videos
    .filter((v) => v.duration >= minDur && v.duration <= maxDur)
    .map((v) => {
      const f = v.video_files
        .filter((f) => f.width < f.height && f.height >= 1280 && f.height <= 2160)
        .sort((a, b) => Math.abs(a.height - 1920) - Math.abs(b.height - 1920))[0];
      return f ? { v, f } : null;
    })
    .filter(Boolean);
  return candidatos[0] ?? { v: videos[0], f: videos[0].video_files[0] };
};

const descargar = async (elegido, destino) => {
  console.log(`Descargando "${elegido.v.url}" (${elegido.v.duration}s, ${elegido.f.width}x${elegido.f.height}) por ${elegido.v.user.name}...`);
  const vid = await fetch(elegido.f.link);
  await writeFile(destino, Buffer.from(await vid.arrayBuffer()));
  return { id: elegido.v.id, autor: elegido.v.user.name, url: elegido.v.url, duracion: elegido.v.duration, archivo: destino.replace("public/", "") };
};

if (queries.length === 1) {
  console.log(`Buscando "${queries[0]}" en Pexels...`);
  const info = await descargar(await buscar(queries[0], 8, 30), "public/fondo.mp4");
  await writeFile("public/fondo.json", JSON.stringify({ query: queries[0], ...info }, null, 2));
  console.log("Listo: public/fondo.mp4. Crédito: Video de", info.autor, "en Pexels");
} else {
  const { mkdir } = await import("node:fs/promises");
  await mkdir("public/clips", { recursive: true });
  const clips = [];
  for (let i = 0; i < queries.length; i++) {
    console.log(`[${i + 1}/${queries.length}] Buscando "${queries[i]}"...`);
    try {
      const info = await descargar(await buscar(queries[i], 4, 30), `public/clips/${String(i + 1).padStart(2, "0")}.mp4`);
      clips.push({ query: queries[i], ...info });
    } catch (e) {
      console.warn(`  saltado: ${e.message}`);
    }
  }
  await writeFile("public/clips.json", JSON.stringify({ fuente: "pexels", clips }, null, 2));
  console.log(`Listo: ${clips.length} clips en public/clips/. Úsalos con fondoClips: true en TikTokPro.`);
  console.log("Créditos:", [...new Set(clips.map((c) => c.autor))].join(", "), "en Pexels");
}
