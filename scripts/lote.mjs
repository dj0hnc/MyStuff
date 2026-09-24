// LOTE: varios videos narrados de una vez (guion → fondos de Pexels → voz → TikTokPro).
// Para contenido propio de un canal: historias, datos, tips. Cada video en el JSON trae
// hook, kicker, cta, frases, palabrasClave, fondos (búsquedas de Pexels) y caption.
//
// Uso:  npm run lote -- docs/clipping/propios/historias-1.json
//       npm run lote -- archivo.json 03-airbnb        (solo ese video)
// Crea: out/lote/<id>.mp4 y out/lote/<archivo>.md con los captions.
// Sin música y sin efectos: solo la voz. Deja public/guion*, voz*, clips.json como estaban.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { basename } from "node:path";

const [archivo, solo] = process.argv.slice(2);
if (!archivo) { console.error("Uso: npm run lote -- archivo.json [id]"); process.exit(1); }
const { cuenta = "", idioma = "en", videos } = JSON.parse(await readFile(archivo, "utf8"));
const correr = (script, args, env = {}) => execFileSync("node", ["--env-file-if-exists=.env", script, ...args], { stdio: "inherit", env: { ...process.env, ...env } });
const nombre = basename(archivo, ".json");
await mkdir("out/lote", { recursive: true });

const md = [`# ${nombre} · ${cuenta}`, ""];
try {
  for (const v of videos.filter((x) => !solo || x.id === solo)) {
    console.log(`\n=== ${v.id}: ${v.hook}`);
    await writeFile("public/guion.txt", v.frases.join("\n") + "\n");
    await writeFile("public/guion.json", JSON.stringify({ tema: v.id, hook: v.hook, kicker: v.kicker, cta: v.cta, frases: v.frases, palabrasClave: v.palabrasClave ?? [] }, null, 2));
    correr("scripts/buscar-fondo.mjs", v.fondos);
    correr("scripts/generar-voz.mjs", [], { WHISPER_IDIOMA: idioma });
    const salida = `out/lote/${v.id}.mp4`;
    correr("scripts/render.mjs", [salida, JSON.stringify({ fondoClips: true, segundosPorClip: 3, musica: false, efectos: false, bgFrom: "#050505", bgTo: "#0A0A0A", ...(cuenta ? { handle: cuenta } : {}) })]);
    // Voz a loudness de TikTok (-14 LUFS) con picos a -1.5 dB.
    const tmp = salida.replace(/\.mp4$/, ".tmp.mp4");
    execFileSync("node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg", ["-y", "-loglevel", "error", "-i", salida, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", tmp]);
    execFileSync("mv", [tmp, salida]);
    md.push(`## ${v.id} · ${v.hook}`, `\`${salida}\``, "", "```", v.caption, "```", "");
  }
} finally {
  // Los archivos de trabajo de La Fábrica viven en git: se restauran para no pisar el trabajo de otras sesiones.
  execFileSync("git", ["checkout", "--", "public/guion.txt", "public/guion.json", "public/voz.mp3", "public/voz.json", "public/clips.json"], { stdio: "ignore" });
  await writeFile(`out/lote/${nombre}.md`, md.join("\n"));
}
console.log(`\nListo: out/lote/ y captions en out/lote/${nombre}.md`);
