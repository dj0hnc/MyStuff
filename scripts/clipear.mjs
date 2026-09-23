// CLIPEAR: de un video largo (podcast, stream, entrevista) a varios clips
// verticales listos para Shorts, TikTok y Reels, con gancho arriba, subtítulos
// palabra por palabra y títulos/descripciones/hashtags en español e inglés.
//
// Uso:  npm run clipear -- "https://www.youtube.com/watch?v=..."
//       npm run clipear -- public/reedit/podcast.mp4
// Opciones:
//       --n 5              cuántos clips (default 5)
//       --dur 45           duración máxima por clip en s (default 55; mínimo 15)
//       --idioma auto      idioma del audio para Whisper (auto | es | en ...)
//       --subs es          subtítulos traducidos (clips en inglés con subs en español, o al revés)
//       --encuadre cuadrado|completo|ancho   cómo se ve un video horizontal (default cuadrado)
//       --handle @micanal  marca de agua arriba (o CLIP_HANDLE en .env)
//       --nombre podcast1  nombre de los archivos (default: id del video)
//       --desde 600 --hasta 3000   solo busca clips en ese tramo (s) del video
//       --pausa 0.6        quita las pausas más largas que eso (jump cuts); --pausa 0 no corta nada
//       --sin-render       solo propone los clips (EDL + textos), no renderiza
// Crea: out/clips/<nombre>[-<subs>]-<n>.mp4 y out/clips/<nombre>[-<subs>].md/.json (textos para publicar)
//
// Cómo decide:
//   1. Whisper local transcribe todo el audio con tiempo por palabra (se guarda en caché).
//   2. Gemini lee la transcripción con tiempos y elige los momentos con gancho
//      (frase que engancha en los primeros 2 s, historia cerrada, remate o polémica).
//   3. Cada clip se ajusta a frases completas y se renderiza con la composición Reedit.

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, basename } from "node:path";
import { generateContent, textoDe } from "./gemini.mjs";
import { ytdlp } from "./ytdlp.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const conValor = new Set(["--pausa", "--n", "--dur", "--idioma", "--subs", "--encuadre", "--handle", "--nombre", "--desde", "--hasta"]);
const fuente = args.find((a, i) => !a.startsWith("--") && !conValor.has(args[i - 1]));
if (!fuente) { console.error('Uso: npm run clipear -- "URL o ruta.mp4" [--n 5] [--subs es] [--handle @canal]'); process.exit(1); }
const N = Number(opt("n", 5));
const DUR = Math.max(15, Number(opt("dur", 55)));
const IDIOMA = opt("idioma", "auto");
const SUBS = opt("subs", null);
const ENCUADRE = opt("encuadre", "cuadrado");
const HANDLE = opt("handle", process.env.CLIP_HANDLE ?? "");
const DESDE = Number(opt("desde", 0));
const HASTA = Number(opt("hasta", Infinity));
const SIN_RENDER = args.includes("--sin-render");
const PAUSA = Number(opt("pausa", 0.6));
const MODELO = process.env.GEMINI_TEXT_MODEL ?? "gemini-3.6-flash";
const ACENTO = process.env.CLIP_COLOR || "#FFE600";

const require = createRequire(import.meta.url);
const comp = dirname(require.resolve("@remotion/compositor-linux-x64-gnu/package.json"));
const ffmpeg = join(comp, "ffmpeg"), ffprobe = join(comp, "ffprobe");
const pedirJSON = async (prompt) => JSON.parse(textoDe(await generateContent(MODELO, {
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
})));

// --- 1. video local (bajarlo si es un enlace)
await mkdir("public/reedit", { recursive: true });
await mkdir("out/clips", { recursive: true });
let video = fuente, info = { titulo: basename(fuente), canal: "", url: "" };
const esURL = /^https?:\/\//.test(fuente);
const idURL = esURL ? (fuente.match(/(?:v=|youtu\.be\/|shorts\/|video\/)([\w-]{6,})/)?.[1] ?? "clip") : null;
const nombre = (opt("nombre", null) ?? (esURL ? idURL : basename(fuente).replace(/\.[^.]+$/, ""))).replace(/[^\w-]/g, "_");
if (esURL) {
  const bin = await ytdlp();
  const cookies = process.env.YTDLP_COOKIES ? ["--cookies-from-browser", process.env.YTDLP_COOKIES] : [];
  video = `public/reedit/${nombre}.mp4`;
  try {
    const meta = JSON.parse(execFileSync(bin, [...cookies, "-j", "--no-playlist", "--skip-download", fuente], { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }).toString());
    info = { titulo: meta.title, canal: meta.channel ?? meta.uploader ?? "", url: meta.webpage_url ?? fuente };
  } catch {
    info = { titulo: nombre, canal: "", url: fuente };
  }
  if (!existsSync(video)) {
    console.log(`Bajando "${info.titulo}"${info.canal ? ` (${info.canal})` : ""}...`);
    try {
      execFileSync(bin, [...cookies, "-f", "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b", "--merge-output-format", "mp4", "-o", video, "--no-playlist", fuente], { stdio: "inherit" });
    } catch {
      console.error("\nNo se pudo bajar. Si dice 429 / 'Sign in to confirm', YouTube bloqueó tu IP un rato:\n" +
        "  - prueba de nuevo más tarde o con otra red, o\n" +
        "  - agrega tus cookies: YTDLP_COOKIES=chrome npm run clipear -- URL\n" +
        "  - o bájalo tú y pasa el archivo: npm run clipear -- public/reedit/video.mp4");
      process.exit(1);
    }
  }
}
if (!existsSync(video)) { console.error(`No existe ${video}`); process.exit(1); }

const [W, H] = execFileSync(ffprobe, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", video]).toString().trim().split(",").map(Number);
const audio = `public/reedit/${nombre}-audio.mp3`;
if (!existsSync(audio)) execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", video, "-vn", "-ac", "1", "-ar", "44100", "-q:a", "3", audio]);

// --- 2. transcripción con tiempos por palabra (caché)
const cache = `public/reedit/${nombre}-words.json`;
let words;
if (existsSync(cache)) words = JSON.parse(await readFile(cache, "utf8")).words;
else {
  console.log("Whisper: transcribiendo todo el audio (en videos largos tarda unos minutos)...");
  process.env.WHISPER_IDIOMA = IDIOMA;
  const { palabrasDe } = await import("./whisper.mjs");
  words = (await palabrasDe(audio)).words.filter((w) => !/^\[.*\]$/.test(w.text));
  await writeFile(cache, JSON.stringify({ words }));
}
console.log(`${words.length} palabras transcritas.`);

// Frases: cortes en puntuación o cada 14 palabras. Gemini ve "[inicio] texto".
const frases = [];
let cur = [];
for (const w of words) {
  if (w.start < DESDE || w.end > HASTA) continue;
  cur.push(w);
  if (/[.!?]$/.test(w.text) || cur.length >= 14) { frases.push(cur); cur = []; }
}
if (cur.length) frases.push(cur);
if (!frases.length) { console.error("No hay habla en ese tramo."); process.exit(1); }
const transcripcion = frases.map((f) => `[${f[0].start.toFixed(1)}-${f[f.length - 1].end.toFixed(1)}] ${f.map((w) => w.text).join(" ")}`).join("\n");

// --- 3. Gemini elige los momentos (sin clave: los tramos con más palabras por segundo)
const conGemini = Boolean(process.env.GEMINI_API_KEY);
let propuestos;
if (conGemini) {
  console.log(`Gemini: eligiendo los ${N} mejores momentos...`);
  ({ clips: propuestos } = await pedirJSON(`Eres editor de clips virales para YouTube Shorts, TikTok y Reels (audiencia latina y de EE. UU.).
Video: "${info.titulo}"${info.canal ? ` de ${info.canal}` : ""}.
Abajo está la transcripción con tiempos en segundos. Elige los ${N} mejores momentos para clips de 15 a ${DUR} s.
Un buen clip: la PRIMERA frase engancha sola (pregunta, dato fuerte, confesión, polémica, número), cuenta una idea o historia completa, termina en remate o frase contundente, se entiende sin contexto. No se solapan entre sí.
"start" debe ser el inicio de una frase y "end" el final de una frase de la lista. Ordénalos del más viral al menos.
Devuelve JSON: {"clips":[{"start":n,"end":n,"viral":1-10,"por_que":"...","gancho_es":"texto en pantalla, máx 6 palabras","gancho_en":"on-screen text, max 6 words","titulo_es":"...","titulo_en":"...","descripcion_es":"2 líneas","descripcion_en":"2 lines","hashtags":["#...", "..."]}]}

TRANSCRIPCIÓN:
${transcripcion}`));
} else {
  console.log("Sin GEMINI_API_KEY: elijo los tramos más hablados (con clave gratis de Gemini la selección es mucho mejor).");
  const cands = frases.map((f, i) => {
    let j = i;
    while (j + 1 < frases.length && frases[j + 1].at(-1).end - f[0].start <= DUR) j++;
    const ws = frases.slice(i, j + 1).flat();
    const d = ws.at(-1).end - ws[0].start;
    const gancho = /[?!]$/.test(f.at(-1).text) || /\d/.test(f.map((w) => w.text).join(" ")) ? 1 : 0;
    return { start: f[0].start, end: ws.at(-1).end, score: ws.length / Math.max(1, d) + gancho + (d >= 25 ? 0.5 : 0), primera: f.map((w) => w.text).join(" ") };
  }).sort((a, b) => b.score - a.score);
  propuestos = [];
  for (const c of cands) {
    if (propuestos.length >= N) break;
    if (c.end - c.start < 12 || propuestos.some((p) => c.start < p.end && c.end > p.start)) continue;
    const g = c.primera.split(/\s+/).slice(0, 6).join(" ");
    propuestos.push({ ...c, viral: "?", por_que: "Tramo denso en habla (selección automática sin Gemini).", gancho_es: g, gancho_en: g, titulo_es: c.primera, titulo_en: c.primera, descripcion_es: info.titulo, descripcion_en: info.titulo, hashtags: ["#shorts", "#viral", "#clips"] });
  }
}

// Ajusta a frases completas y a la duración.
const clips = propuestos.slice(0, N).map((c) => {
  const i0 = frases.findIndex((f) => f[f.length - 1].end > +c.start);
  let i1 = frases.findIndex((f) => f[f.length - 1].end >= +c.end - 0.05);
  if (i0 < 0) return null;
  if (i1 < i0) i1 = i0;
  while (i1 > i0 && frases[i1][frases[i1].length - 1].end - frases[i0][0].start > DUR) i1--;
  const ws = frases.slice(i0, i1 + 1).flat();
  return { ...c, start: +Math.max(0, ws[0].start - 0.15).toFixed(2), end: +(ws[ws.length - 1].end + 0.35).toFixed(2), ws };
}).filter((c) => c && c.end - c.start >= 8);

// --- 4. subtítulos traducidos (opcional): Gemini traduce por frase y se reparten los tiempos
const traducir = async (ws, idioma) => {
  const grupos = [];
  let g = [];
  for (const w of ws) { g.push(w); if (/[.!?,;]$/.test(w.text) || g.length >= 8) { grupos.push(g); g = []; } }
  if (g.length) grupos.push(g);
  const { t } = await pedirJSON(`Traduce cada frase al idioma "${idioma}" de forma natural y coloquial (como la diría un creador latino/estadounidense). Misma cantidad de frases, en orden. JSON: {"t":["..."]}\n\n${JSON.stringify(grupos.map((x) => x.map((w) => w.text).join(" ")))}`);
  return grupos.flatMap((gr, k) => {
    const txt = String(t[k] ?? gr.map((w) => w.text).join(" ")).split(/\s+/).filter(Boolean);
    const a = gr[0].start, b = gr[gr.length - 1].end, per = (b - a) / Math.max(1, txt.length);
    return txt.map((x, j) => ({ text: x, start: +(a + j * per).toFixed(2), end: +(a + (j + 1) * per - 0.03).toFixed(2) }));
  });
};

// --- 5. EDL por clip + render
// Encuadre de un video horizontal dentro de 9:16: "cuadrado" recorta al centro 1:1 (caras grandes),
// "completo" llena toda la pantalla, "ancho" lo deja entero con fondo desenfocado.
if (SUBS && !conGemini) console.log("Sin GEMINI_API_KEY no hay traducción: los subtítulos quedan en el idioma original.");
const base = SUBS ? `${nombre}-${SUBS}` : nombre;
const [sw, sh] = W > H ? (ENCUADRE === "completo" ? [9, 16] : ENCUADRE === "ancho" ? [W, H] : [1, 1]) : [W, H];
const meta = [];
const md = [`# Clips de "${info.titulo}"`, "", info.url ? `Fuente: ${info.canal} · ${info.url}` : "", ""];
for (const [k, c] of clips.entries()) {
  const n = k + 1;
  const subs = SUBS && conGemini ? await traducir(c.ws, SUBS) : c.ws;
  const gancho = SUBS === "en" ? c.gancho_en : SUBS === "es" ? c.gancho_es : (IDIOMA === "en" ? c.gancho_en : c.gancho_es);
  // Cortes rápidos: cada pausa de más de PAUSA s entre palabras se quita (jump cut).
  const tramos = [];
  for (const w of c.ws) {
    const t = tramos.at(-1);
    if (t && (PAUSA <= 0 || w.start - t.ultima < PAUSA)) { t.to = w.end; t.ultima = w.end; }
    else tramos.push({ from: w.start, to: w.end, ultima: w.end });
  }
  const rangos = tramos.map((t) => ({ from: +Math.max(c.start, t.from - 0.12).toFixed(2), to: +Math.min(c.end, t.to + 0.2).toFixed(2) }));
  rangos[0].from = c.start;
  rangos.at(-1).to = c.end;
  // El gancho vive en el primer bloque; si es largo se parte a los 3 s sin tocar el audio.
  if (rangos[0].to - rangos[0].from > 3.5) rangos.splice(0, 1, { from: rangos[0].from, to: +(rangos[0].from + 3).toFixed(2), seguido: true }, { from: +(rangos[0].from + 3).toFixed(2), to: rangos[0].to });
  const bloques = rangos.map((r, i) => ({
    video: { from: r.from, to: r.to }, audio: "sync", gain: 1, quien: "el", dialogo: true,
    ...(i === 0 ? { label: String(gancho ?? "").toUpperCase() } : {}),
    fadeIn: i === 0 ? 2 : rangos[i - 1].seguido ? 0 : 1,
    fadeOut: i === rangos.length - 1 ? 8 : r.seguido ? 0 : 1,
  }));
  const durFinal = bloques.reduce((a, b) => a + b.video.to - b.video.from, 0);
  const edl = {
    src: `reedit/${basename(video)}`,
    audioSrc: `reedit/${basename(audio)}`,
    srcWidth: sw,
    srcHeight: sh,
    bloques,
    words: subs,
    handle: HANDLE,
    subsBottom: 420,
    colores: { el: ACENTO, ella: ACENTO },
  };
  const edlPath = `reedit/${base}-clip${n}.json`;
  await writeFile(`public/${edlPath}`, JSON.stringify(edl, null, 1));
  const salida = `out/clips/${base}-${n}.mp4`;
  const credito = info.canal ? `\n\nCréditos / Credit: ${info.canal}${info.url ? ` (${info.url})` : ""}` : "";
  md.push(
    `## Clip ${n} · ${durFinal.toFixed(0)} s · viral ${c.viral}/10`,
    `\`${salida}\` · ${c.start.toFixed(1)}–${c.end.toFixed(1)} s del original`,
    `> ${c.por_que}`,
    "",
    `**ES** · ${c.titulo_es}`, "", `${c.descripcion_es}${credito}`, "",
    `**EN** · ${c.titulo_en}`, "", `${c.descripcion_en}${credito}`, "",
    (c.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "), "",
  );
  meta.push({ archivo: salida, duracion: +durFinal.toFixed(1), viral: c.viral, gancho, titulo_es: c.titulo_es, titulo_en: c.titulo_en, descripcion_es: c.descripcion_es + credito, descripcion_en: c.descripcion_en + credito, hashtags: (c.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`)), subs: SUBS ?? "original", fuente: info.url });
  console.log(`\nClip ${n}: ${c.start.toFixed(1)}-${c.end.toFixed(1)} s (${durFinal.toFixed(0)} s tras quitar pausas) viral ${c.viral}/10\n  ${c.titulo_es}\n  ${c.titulo_en}`);
  if (!SIN_RENDER) {
    execFileSync("npx", ["remotion", "render", "Reedit", salida, "--concurrency=4", "--crf=23", `--props=${JSON.stringify({ edl: edlPath })}`], { stdio: "inherit" });
  }
}
await writeFile(`out/clips/${base}.md`, md.join("\n"));
await writeFile(`out/clips/${base}.json`, JSON.stringify(meta, null, 1));
console.log(`\nListo: ${clips.length} clips${SIN_RENDER ? " propuestos (sin render)" : ""} en out/clips/. Textos para publicar: out/clips/${base}.md`);
if (SIN_RENDER) console.log(`Para renderizar uno: npx remotion render Reedit out/clips/${base}-1.mp4 --props='{"edl":"reedit/${base}-clip1.json"}'`);
