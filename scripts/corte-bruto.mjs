// CORTE EN BRUTO: de un video crudo largo a una propuesta de edición (EDL)
// que conserva lo que se habla y tira los silencios, el aire muerto y las
// muletillas. El audio original se respeta (sync) y se nivela por bloque.
//
// Uso:  npm run corte-bruto -- public/reedit/v3.mp4
//       npm run corte-bruto -- public/reedit/v3.mp4 --max 60      (duración objetivo en s)
//       npm run corte-bruto -- public/reedit/v3.mp4 --idioma en
//       npm run corte-bruto -- public/reedit/v3.mp4 --respiro 1.5  (inserta 1.5 s de imagen sin habla entre bloques lejanos)
// Crea: public/reedit/edl.json  (+ reedit/<nombre>-words.json, -habla.json)
// Luego: npx remotion render Reedit out/corte.mp4
//
// Cómo decide:
//   1. Gemini escucha el audio y devuelve los tramos con habla (frase + tiempos).
//   2. Whisper local afina el tiempo de cada palabra dentro de cada tramo.
//   3. Se eliminan muletillas aisladas y se unen tramos separados por < 0.7 s.
//   4. Se descartan tramos de menos de 0.8 s. Padding de 0.25 s a cada lado.
//   5. Si hay --max, se conservan los tramos con más palabras por segundo hasta llenar.
//   6. Cada bloque recibe ganancia para llevar la voz a un nivel parejo (RMS ~0.08).

import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, basename, resolve } from "node:path";
import { generateContent, textoDe } from "./gemini.mjs";

const args = process.argv.slice(2);
const video = args.find((a) => !a.startsWith("--"));
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const MAX = Number(opt("max", 0));
const IDIOMA = opt("idioma", "es");
const RESPIRO = Number(opt("respiro", 0));
if (!video) { console.error("Uso: npm run corte-bruto -- public/reedit/video.mp4 [--max 60] [--idioma es]"); process.exit(1); }

const require = createRequire(import.meta.url);
const comp = dirname(require.resolve("@remotion/compositor-linux-x64-gnu/package.json"));
const ffmpeg = join(comp, "ffmpeg"), ffprobe = join(comp, "ffprobe");
const nombre = basename(video).replace(/\.[^.]+$/, "");
const dir = dirname(video);
const S = resolve("/tmp/claude-0/-home-user-MyStuff/d0bbb865-da6c-51dd-9724-34850a0d26f5/scratchpad/corte");
execFileSync("mkdir", ["-p", S]);

// --- 1. datos del video y audio
const probe = execFileSync(ffprobe, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,duration", "-of", "csv=p=0", video]).toString().trim().split(",");
const [W, H] = [Number(probe[0]), Number(probe[1])];
const DUR = Number(probe[2]) || Number(execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video]).toString());
const audioMp3 = `${dir}/${nombre}-audio.mp3`;
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", video, "-vn", "-ac", "1", "-ar", "44100", "-q:a", "2", audioMp3]);
console.log(`Video ${W}x${H}, ${DUR.toFixed(1)} s. Audio extraído.`);

// --- 2. envolvente de energía (10 ms) para nivelar
const wav = `${S}/${nombre}.wav`;
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", audioMp3, "-ac", "1", "-ar", "11025", "-c:a", "pcm_s16le", "-f", "wav", wav]);
const buf = await readFile(wav);
let off = 12, dataOff = 0, dataLen = 0;
while (off < buf.length) { const id = buf.toString("ascii", off, off + 4); const len = buf.readUInt32LE(off + 4); if (id === "data") { dataOff = off + 8; dataLen = len; break; } off += 8 + len; }
const hop = 110, n = Math.floor(dataLen / 2), frames = Math.floor(n / hop), rms = new Float32Array(frames);
for (let f = 0; f < frames; f++) { let s = 0; for (let i = 0; i < hop; i++) { const v = buf.readInt16LE(dataOff + (f * hop + i) * 2) / 32768; s += v * v; } rms[f] = Math.sqrt(s / hop); }
const rmsEntre = (a, b) => { const i0 = Math.max(0, Math.floor(a * 100)), i1 = Math.min(frames, Math.ceil(b * 100)); let s = 0, c = 0; for (let i = i0; i < i1; i++) { s += rms[i] * rms[i]; c++; } return c ? Math.sqrt(s / c) : 0; };

// --- 3. Gemini: tramos con habla
console.log("Gemini: buscando tramos con habla...");
const b64 = (await readFile(audioMp3)).toString("base64");
const out = await generateContent(process.env.GEMINI_TEXT_MODEL ?? "gemini-3.6-flash", {
  contents: [{ parts: [{ inline_data: { mime_type: "audio/mp3", data: b64 } }, { text: `Transcribe SOLO lo que hablan las personas en este audio (ignora la música y ruido). Devuelve JSON: {"tramos":[{"start":segundos,"end":segundos,"texto":"..."}]} con una entrada por frase u oración, tiempos con 1 decimal, en orden. Si no hay habla, devuelve {"tramos":[]}.` }] }],
  generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
});
let tramos = JSON.parse(textoDe(out)).tramos.map((t) => ({ start: Math.max(0, +t.start), end: Math.min(DUR, +t.end), texto: (t.texto || "").trim() })).filter((t) => t.end > t.start && t.texto);
console.log(`  ${tramos.length} frases detectadas.`);

// --- 4. Whisper por tramo para tiempos de palabra
const { palabrasDe } = await import("./whisper.mjs");
process.env.WHISPER_IDIOMA = IDIOMA;
const words = [];
for (let i = 0; i < tramos.length; i++) {
  const t = tramos[i]; const a = Math.max(0, t.start - 0.4), b = Math.min(DUR, t.end + 0.4);
  const clip = `${S}/t${i}.wav`;
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-ss", String(a), "-to", String(b), "-i", audioMp3, "-af", "volume=2.5", "-ac", "1", "-ar", "16000", clip]);
  let ws = [];
  try { ws = (await palabrasDe(clip)).words.filter((w) => !/^\[.*\]$/.test(w.text)); } catch {}
  // texto de Gemini repartido sobre los tiempos de Whisper (Gemini transcribe mejor, Whisper cronometra mejor)
  const txt = t.texto.split(/\s+/).filter(Boolean);
  const t0 = ws.length ? ws[0].start + a : t.start, t1 = ws.length ? ws[ws.length - 1].end + a : t.end;
  const per = (t1 - t0) / Math.max(1, txt.length);
  txt.forEach((x, k) => words.push({ text: x, start: +(t0 + k * per).toFixed(2), end: +(t0 + (k + 1) * per - 0.03).toFixed(2), tramo: i }));
  tramos[i] = { ...t, start: +t0.toFixed(2), end: +t1.toFixed(2) };
}

// --- 5. limpiar: muletillas aisladas, unir, descartar cortos
const MULETILLAS = new Set(["eh", "ehh", "este", "mmm", "mm", "um", "uh", "umm", "o sea", "pues", "like", "uhm"]);
const esMuletilla = (t) => MULETILLAS.has(t.toLowerCase().replace(/[^a-záéíóúñ ]/g, ""));
tramos = tramos.filter((t) => !(t.texto.split(/\s+/).length <= 2 && t.texto.split(/\s+/).every(esMuletilla)));
tramos.sort((x, y) => x.start - y.start);
const PAD = 0.25, GAP = 0.7, MIN = 0.8;
const unidos = [];
for (const t of tramos) {
  const seg = { start: Math.max(0, t.start - PAD), end: Math.min(DUR, t.end + PAD), palabras: t.texto.split(/\s+/).length, texto: t.texto };
  const u = unidos[unidos.length - 1];
  if (u && seg.start - u.end < GAP) { u.end = Math.max(u.end, seg.end); u.palabras += seg.palabras; u.texto += " " + seg.texto; }
  else unidos.push(seg);
}
let segs = unidos.filter((s) => s.end - s.start >= MIN);
const totalHabla = segs.reduce((a, s) => a + s.end - s.start, 0);

// --- 6. presupuesto de duración
if (MAX && totalHabla > MAX) {
  const ordenados = [...segs].sort((a, b) => b.palabras / (b.end - b.start) - a.palabras / (a.end - a.start));
  const keep = new Set(); let acc = 0;
  for (const s of ordenados) { const d = s.end - s.start; if (acc + d <= MAX) { keep.add(s); acc += d; } }
  segs = segs.filter((s) => keep.has(s));
}

// --- 7. EDL con ganancia por bloque (+ respiros visuales entre bloques lejanos)
const TARGET = 0.08;
const gainDe = (a, b, tope = 8) => +Math.min(tope, Math.max(0.5, TARGET / Math.max(0.005, rmsEntre(a, b)))).toFixed(2);
const bloques = [];
segs.forEach((s, i) => {
  if (RESPIRO && i > 0) {
    const prev = segs[i - 1];
    const gap = s.start - prev.end;
    if (gap > RESPIRO * 4) {
      const mid = prev.end + gap / 2;
      const a = +(mid - RESPIRO / 2).toFixed(2), b = +(mid + RESPIRO / 2).toFixed(2);
      bloques.push({ video: { from: a, to: b }, audio: "sync", gain: gainDe(a, b, 3), quien: "nadie", fadeIn: 6, fadeOut: 6, nota: "(respiro)" });
    }
  }
  bloques.push({ video: { from: +s.start.toFixed(2), to: +s.end.toFixed(2) }, audio: "sync", gain: gainDe(s.start, s.end), quien: "ambos", dialogo: true, fadeIn: 2, fadeOut: 2, nota: s.texto.slice(0, 80) });
});
const edl = { src: `reedit/${basename(video)}`, audioSrc: `reedit/${nombre}-audio.mp3`, srcWidth: W, srcHeight: H, bloques, words: words.map(({ tramo: _t, ...w }) => w), handle: "@theravecouple.official", colores: { ella: "#F59E0B", el: "#39FF14" } };
await writeFile(`${dir}/edl.json`, JSON.stringify(edl, null, 1));
await writeFile(`${dir}/${nombre}-habla.json`, JSON.stringify({ tramos, segs }, null, 1));

const kept = bloques.reduce((a, b) => a + b.video.to - b.video.from, 0);
console.log(`\nCorte en bruto: ${DUR.toFixed(0)} s -> ${kept.toFixed(1)} s en ${bloques.length} bloques (se tiran ${(DUR - kept).toFixed(0)} s de aire).`);
bloques.forEach((b, i) => console.log(`  ${String(i + 1).padStart(2)}. ${b.video.from.toFixed(1)}-${b.video.to.toFixed(1)}s  x${b.gain}  "${b.nota}"`));
console.log(`\nEDL en ${dir}/edl.json. Renderiza con: npx remotion render Reedit out/${nombre}-corte.mp4`);
