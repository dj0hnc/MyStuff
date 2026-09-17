// Busca un video vertical de stock en Pexels y lo descarga como fondo.
//
// Uso:  npm run fondo -- "ciudad de noche neon"
// Crea: public/fondo.mp4
//
// Necesita PEXELS_API_KEY en .env. La clave es gratis:
// https://www.pexels.com/api/  ->  "Get Started"  ->  copiar la clave.

import { writeFile } from "node:fs/promises";

const apiKey = process.env.PEXELS_API_KEY;
if (!apiKey) {
  console.error("Falta PEXELS_API_KEY en .env. Consíguela gratis en https://www.pexels.com/api/");
  process.exit(1);
}

const query = process.argv.slice(2).join(" ") || "abstract gradient motion";
const url = new URL("https://api.pexels.com/videos/search");
url.searchParams.set("query", query);
url.searchParams.set("orientation", "portrait");
url.searchParams.set("size", "medium");
url.searchParams.set("per_page", "10");

console.log(`Buscando "${query}" en Pexels...`);
const res = await fetch(url, { headers: { Authorization: apiKey } });
if (!res.ok) {
  console.error(`Pexels respondió ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const { videos } = await res.json();
if (!videos?.length) {
  console.error("Sin resultados. Prueba otra búsqueda.");
  process.exit(1);
}

// Preferir clips de 8 a 30 s con un archivo vertical cercano a 1080x1920.
const candidatos = videos
  .filter((v) => v.duration >= 8 && v.duration <= 30)
  .map((v) => {
    const f = v.video_files
      .filter((f) => f.width < f.height && f.height >= 1280 && f.height <= 2160)
      .sort((a, b) => Math.abs(a.height - 1920) - Math.abs(b.height - 1920))[0];
    return f ? { v, f } : null;
  })
  .filter(Boolean);

const elegido = candidatos[0] ?? { v: videos[0], f: videos[0].video_files[0] };
console.log(`Descargando "${elegido.v.url}" (${elegido.v.duration}s, ${elegido.f.width}x${elegido.f.height}) por ${elegido.v.user.name}...`);

const vid = await fetch(elegido.f.link);
await writeFile("public/fondo.mp4", Buffer.from(await vid.arrayBuffer()));
await writeFile(
  "public/fondo.json",
  JSON.stringify({ query, id: elegido.v.id, autor: elegido.v.user.name, url: elegido.v.url, duracion: elegido.v.duration }, null, 2),
);
console.log("Listo: public/fondo.mp4. Crédito recomendado: Video de", elegido.v.user.name, "en Pexels");
