// LOTE: varios videos narrados de una vez (guion → fondos → voz → TikTokPro).
// Para contenido propio de un canal: historias, datos, tips. Cada video en el JSON trae
// hook, kicker, cta, frases, palabrasClave, fondos (búsquedas de Pexels) y caption.
// Con "youtube": ["id", ...] usa como fondo esos videos (imagen conocida) si ya están en
// public/reedit/propios/<id>.mp4 (se bajan en tu compu, ver docs/clipping/propios/README.md);
// si no están, cae a Pexels.
//
// Uso:  npm run lote -- docs/clipping/propios/historias-1.json
//       npm run lote -- archivo.json 03-airbnb        (solo ese video)
// Crea: out/lote/<id>.mp4 y out/lote/<archivo>.md con los captions.
// Sin música y sin efectos: solo la voz. Deja public/guion*, voz*, clips.json como estaban.

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { basename } from "node:path";

const [archivo, solo] = process.argv.slice(2);
if (!archivo) { console.error("Uso: npm run lote -- archivo.json [id]"); process.exit(1); }
const { cuenta = "", idioma = "en", videos } = JSON.parse(await readFile(archivo, "utf8"));
const correr = (script, args, env = {}) => execFileSync("node", ["--env-file-if-exists=.env", script, ...args], { stdio: "inherit", env: { ...process.env, ...env } });
const nombre = basename(archivo, ".json");
const ffprobe = "node_modules/@remotion/compositor-linux-x64-gnu/ffprobe";
const duracion = (f) => Number(execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
// ponytail: tomas de 3.5 s repartidas parejo en cada fuente (sin mirar el contenido); si alguna sale mal, subir n o cambiar de fuente.
const tomas = (fuentes, n = 12) => Array.from({ length: n }, (_, i) => {
  const f = fuentes[i % fuentes.length], k = Math.floor(i / fuentes.length), por = Math.ceil(n / fuentes.length);
  const d = duracion(f);
  return { archivo: f.replace(/^public\//, ""), inicio: +Math.max(0, Math.min(d - 3.6, d * (0.1 + (0.8 * (k + 0.5)) / por))).toFixed(2), duracion: 3.5 };
});
await mkdir("out/lote", { recursive: true });

const md = [`# ${nombre} · ${cuenta}`, ""];
try {
  for (const v of videos.filter((x) => !solo || x.id === solo)) {
    console.log(`\n=== ${v.id}: ${v.hook}`);
    await writeFile("public/guion.txt", v.frases.join("\n") + "\n");
    await writeFile("public/guion.json", JSON.stringify({ tema: v.id, hook: v.hook, kicker: v.kicker, cta: v.cta, frases: v.frases, palabrasClave: v.palabrasClave ?? [] }, null, 2));
    const fuentes = (v.youtube ?? []).map((id) => `public/reedit/propios/${id}.mp4`).filter((f) => existsSync(f));
    if (fuentes.length) await writeFile("public/clips.json", JSON.stringify({ fuente: v.id, clips: tomas(fuentes) }, null, 1));
    else correr("scripts/buscar-fondo.mjs", v.fondos);
    console.log(fuentes.length ? `Fondo: ${fuentes.length} videos de YouTube` : "Fondo: Pexels");
    correr("scripts/generar-voz.mjs", [], { WHISPER_IDIOMA: idioma });
    const salida = `out/lote/${v.id}.mp4`;
    correr("scripts/render.mjs", [salida, JSON.stringify({ fondoClips: true, segundosPorClip: 3.5, musica: false, efectos: false, bgFrom: "#050505", bgTo: "#0A0A0A", ...(cuenta ? { handle: cuenta } : {}) })]);
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
