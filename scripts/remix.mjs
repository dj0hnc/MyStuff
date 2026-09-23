// REMIX: edits nuevos a partir del material de una campaña de clipping (Vyro, Whop).
// Las campañas dan edits de muestra; subirlos tal cual es "repost" y lo rechazan.
// Esto transcribe cada muestra, Gemini diseña N edits distintos combinando pedazos
// de varias, y Reedit los renderiza en 9:16 con el gancho arriba.
//
// Uso:  npm run remix -- public/reedit/ketone --brief docs/clipping/campanas/ketone-iq.md
//       npm run remix -- public/reedit/ketone --n 5 --dur 30 --tag "#KetoneIQPartner"
// Opciones:
//   --n 5            cuántos edits (default 5)
//   --dur 30         duración objetivo en s (mínimo 16, porque las campañas piden 15 s o más)
//   --brief archivo  brief de la campaña para Gemini (reglas, historia, hashtags)
//   --tag "#..."     hashtag obligatorio que se agrega a cada caption si falta
//   --handle @x      marca de agua arriba (default: ninguna)
//   --plan archivo   usa un plan ya escrito ({"edits":[...]}, mismo formato que devuelve Gemini) en vez de pedirlo
//   --sin-render     solo escribe las EDL y los captions
// Crea: out/remix/<carpeta>-<n>.mp4 y out/remix/<carpeta>.md (captions listos para pegar)
// Los videos fuente deben vivir en public/ (Remotion los lee de ahí) y no van a git.

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { generateContent, textoDe } from "./gemini.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const conValor = new Set(["--n", "--dur", "--brief", "--tag", "--handle", "--plan", "--idioma"]);
const carpeta = (args.find((a, i) => !a.startsWith("--") && !conValor.has(args[i - 1])) ?? "").replace(/\/$/, "");
if (!carpeta.startsWith("public/") || !existsSync(carpeta)) { console.error("Uso: npm run remix -- public/reedit/<carpeta> [--brief archivo] [--n 5]"); process.exit(1); }
const N = Number(opt("n", 5));
const DUR = Math.max(16, Number(opt("dur", 30)));
const TAG = opt("tag", "");
const HANDLE = opt("handle", "");
const brief = opt("brief", null) ? await readFile(opt("brief"), "utf8") : "";
const nombre = basename(carpeta);

const require = createRequire(import.meta.url);
const comp = dirname(require.resolve("@remotion/compositor-linux-x64-gnu/package.json"));
const ffprobe = join(comp, "ffprobe"), ffmpeg = join(comp, "ffmpeg");
const cacheDir = `out/remix/cache/${nombre}`;
await mkdir(cacheDir, { recursive: true });

// 1. catálogo: tamaño, duración y transcripción por clip (Whisper, en caché)
process.env.WHISPER_IDIOMA = opt("idioma", "en");
const { palabrasDe } = await import("./whisper.mjs");
const clips = [];
for (const f of (await readdir(carpeta)).filter((x) => /\.(mp4|mov)$/i.test(x)).sort()) {
  const ruta = `${carpeta}/${f}`, id = f.replace(/\.[^.]+$/, "");
  const [w, h, d] = execFileSync(ffprobe, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "csv=p=0:s=,", ruta]).toString().trim().split(/[,\n]/).filter(Boolean).map(Number);
  const cache = `${cacheDir}/${id}.json`;
  let words;
  if (existsSync(cache)) words = JSON.parse(await readFile(cache, "utf8"));
  else {
    process.stdout.write(`Whisper ${f}... `);
    words = (await palabrasDe(ruta)).words.filter((x) => !/^\[.*\]$/.test(x.text));
    await writeFile(cache, JSON.stringify(words));
    console.log(`${words.length} palabras`);
  }
  // Frases con tiempos para que Gemini corte en frases completas.
  const frases = [];
  let cur = [];
  for (const x of words) { cur.push(x); if (/[.!?]$/.test(x.text) || cur.length >= 12) { frases.push(cur); cur = []; } }
  if (cur.length) frases.push(cur);
  clips.push({ id, src: ruta.replace(/^public\//, ""), w, h, dur: d, texto: frases.map((p) => `[${p[0].start.toFixed(1)}-${p.at(-1).end.toFixed(1)}] ${p.map((x) => x.text).join(" ")}`).join("\n") });
}
console.log(`${clips.length} clips en el catálogo.`);

// 2. Gemini diseña los edits
const catalogo = clips.map((c) => `### ${c.id} (${c.dur.toFixed(1)} s, ${c.w}x${c.h})\n${c.texto || "(sin voz)"}`).join("\n\n");
let edits;
if (opt("plan", null)) ({ edits } = JSON.parse(await readFile(opt("plan"), "utf8")));
else {
console.log(`Gemini: diseñando ${N} edits...`);
const r = await generateContent(process.env.GEMINI_TEXT_MODEL, {
  contents: [{ parts: [{ text: `Eres editor de "cinematic edits" virales para TikTok, pagados por vistas en una campaña de marca.
${brief ? `BRIEF DE LA CAMPAÑA:\n${brief}\n` : ""}
Abajo está el catálogo de clips de muestra con su transcripción y tiempos en segundos. Diseña ${N} edits NUEVOS en inglés.
Reglas:
- Cada edit dura de 16 a ${DUR + 5} s y combina de 3 a 7 segmentos de AL MENOS 2 clips distintos (no copies una muestra entera en su orden original: eso es repost y lo rechazan).
- Arco: gancho fuerte en los primeros 2 s (el rechazo, la burla, la cifra) → giro → remate. Cada edit abre distinto y cuenta un ángulo distinto.
- Corta en frases completas: "start" es el inicio de una frase y "end" el final de una frase del mismo clip. Tiempos dentro de la duración del clip.
- "hook" es texto en pantalla, máximo 6 palabras, en inglés, que no repita lo que se oye.
- "caption" es el texto del post en inglés (1-2 líneas) con 3 a 5 hashtags${TAG ? ` e incluye ${TAG}` : ""}.
Responde SOLO JSON: {"edits":[{"titulo":"...","angulo":"...","hook":"...","segmentos":[{"clip":"id","start":n,"end":n}],"caption":"..."}]}

CATÁLOGO:
${catalogo}` }] }],
  generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
});
({ edits } = JSON.parse(textoDe(r)));
}

// 3. EDL por edit (un bloque por segmento, cada uno con su video) y render
await mkdir("out/remix", { recursive: true });
const porId = Object.fromEntries(clips.map((c) => [c.id, c]));
const md = [`# Remix de ${nombre}`, ""];
for (const [k, e] of edits.slice(0, N).entries()) {
  const segs = (e.segmentos ?? [])
    .map((s) => ({ c: porId[s.clip], from: Math.max(0, +s.start - 0.1), to: +s.end + 0.25 }))
    .filter((s) => s.c && s.to - s.from >= 0.8)
    .map((s) => ({ ...s, to: +Math.min(s.c.dur, s.to).toFixed(2), from: +s.from.toFixed(2) }));
  if (!segs.length) { console.log(`Edit ${k + 1}: sin segmentos válidos, lo salto.`); continue; }
  // Verticales (3:4, 4:5) llenan la pantalla; cuadrados y horizontales van enteros con fondo desenfocado.
  const bloques = segs.map((s, i) => ({
    src: s.c.src, ...(s.c.w / s.c.h <= 0.8 ? { srcWidth: 9, srcHeight: 16 } : { srcWidth: s.c.w, srcHeight: s.c.h }),
    video: { from: s.from, to: s.to }, audio: "sync", gain: 1, quien: "nadie",
    ...(i === 0 && e.hook ? { label: String(e.hook).toUpperCase() } : {}),
    fadeIn: i === 0 ? 2 : 1, fadeOut: i === segs.length - 1 ? 8 : 1,
  }));
  const total = segs.reduce((a, s) => a + s.to - s.from, 0);
  const n = k + 1;
  const edlPath = `reedit/remix-${nombre}-${n}.json`;
  await writeFile(`public/${edlPath}`, JSON.stringify({ src: segs[0].c.src, audioSrc: segs[0].c.src, bloques, words: [], handle: HANDLE, colores: { el: "#FFFFFF", ella: "#FFFFFF" } }, null, 1));
  const caption = TAG && !String(e.caption).includes(TAG) ? `${e.caption} ${TAG}` : e.caption;
  const salida = `out/remix/${nombre}-${n}.mp4`;
  md.push(`## ${n}. ${e.titulo} · ${total.toFixed(0)} s`, `\`${salida}\` · ${segs.map((s) => `${s.c.id} ${s.from}-${s.to}`).join(" · ")}`, `> ${e.angulo}`, "", "```", caption, "```", "");
  console.log(`\nEdit ${n}: ${e.titulo} (${total.toFixed(0)} s, ${segs.length} segmentos de ${new Set(segs.map((s) => s.c.id)).size} clips)\n  Hook: ${e.hook}`);
  if (total < 15) console.warn(`  Aviso: dura ${total.toFixed(1)} s, la campaña pide 15 s o más.`);
  if (!args.includes("--sin-render")) {
    execFileSync("npx", ["remotion", "render", "Reedit", salida, "--concurrency=4", "--crf=20", `--props=${JSON.stringify({ edl: edlPath })}`], { stdio: "inherit" });
    // Las muestras vienen a volúmenes distintos y con picos en 0 dB: loudness de TikTok (-14 LUFS) y picos a -1.5 dB.
    const tmp = salida.replace(/\.mp4$/, ".tmp.mp4");
    execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", salida, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", tmp]);
    execFileSync("mv", [tmp, salida]);
  }
}
await writeFile(`out/remix/${nombre}.md`, md.join("\n"));
console.log(`\nListo: out/remix/ y captions en out/remix/${nombre}.md`);
