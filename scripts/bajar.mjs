// Baja un video desde un enlace (TikTok, Instagram, YouTube, Facebook, X...)
// a public/reedit/ para analizarlo o reeditarlo.
//
// Uso:  npm run bajar -- "https://www.tiktok.com/@usuario/video/123" nombre
// Crea: public/reedit/nombre.mp4
// La primera vez descarga yt-dlp a .tools/ (ignorado por git).

import { existsSync, chmodSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const [url, nombre = "descarga"] = process.argv.slice(2);
if (!url) {
  console.error('Uso: npm run bajar -- "URL" nombre');
  process.exit(1);
}
const bin = ".tools/yt-dlp";
if (!existsSync(bin)) {
  console.log("Descargando yt-dlp...");
  await mkdir(".tools", { recursive: true });
  const r = await fetch("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp");
  await writeFile(bin, Buffer.from(await r.arrayBuffer()));
  chmodSync(bin, 0o755);
}
await mkdir("public/reedit", { recursive: true });
const destino = `public/reedit/${nombre}.mp4`;
console.log(`Bajando ${url} -> ${destino}`);
execFileSync(bin, ["-f", "bv*[height<=1920][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b", "--merge-output-format", "mp4", "-o", destino, "--no-playlist", url], { stdio: "inherit" });
console.log(`Listo: ${destino}`);
