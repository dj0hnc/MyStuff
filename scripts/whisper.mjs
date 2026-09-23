// Whisper local (whisper.cpp) para sacar el tiempo exacto de cada palabra de
// cualquier audio: la voz de Gemini, una grabación tuya, un podcast.
// Gratis, corre en tu CPU. La primera vez compila e instala el modelo (~150 MB).

import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { downloadWhisperModel, installWhisperCpp, transcribe, toCaptions } from "@remotion/install-whisper-cpp";

const TO = resolve(".whisper");
const VERSION = "1.7.4";
const MODEL = process.env.WHISPER_MODEL ?? "base"; // tiny | base | small | medium (más grande = más preciso y lento)

export const prepararWhisper = async () => {
  await installWhisperCpp({ to: TO, version: VERSION, printOutput: false });
  await downloadWhisperModel({ model: MODEL, folder: TO, printOutput: false });
};

const ffmpeg = () => {
  const require = createRequire(import.meta.url);
  return join(dirname(require.resolve("@remotion/compositor-linux-x64-gnu/package.json")), "ffmpeg");
};

// Devuelve { duration, words: [{text, start, end}] } en segundos.
export const palabrasDe = async (audioPath) => {
  await prepararWhisper();
  const wav = resolve(audioPath).replace(/\.[^.]+$/, ".16k.wav");
  execFileSync(ffmpeg(), ["-y", "-loglevel", "error", "-i", resolve(audioPath), "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav]);

  const out = await transcribe({
    inputPath: wav,
    whisperPath: TO,
    whisperCppVersion: VERSION,
    model: MODEL,
    tokenLevelTimestamps: true,
    language: process.env.WHISPER_IDIOMA ?? "es",
    printOutput: false,
  });
  execFileSync("rm", ["-f", wav]);

  // Whisper devuelve trozos de palabra (tokens). Un token que empieza con
  // espacio inicia palabra nueva; los demás se pegan a la anterior.
  const { captions } = toCaptions({ whisperCppOutput: out });
  const words = [];
  for (const c of captions) {
    const raw = c.text;
    const start = c.startMs / 1000;
    const end = (c.endMs ?? c.startMs + 300) / 1000;
    const nueva = raw.startsWith(" ") || words.length === 0 || /^[¿¡"(]/.test(raw.trim());
    if (nueva) words.push({ text: raw.trim(), start, end });
    else {
      const w = words[words.length - 1];
      w.text += raw.trim();
      w.end = end;
    }
  }
  const limpias = words.filter((w) => w.text.length > 0);
  const duration = limpias.length ? limpias[limpias.length - 1].end : 0;
  return { duration, words: limpias };
};

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  // Uso directo: node scripts/whisper.mjs public/mi-audio.mp3  -> public/mi-audio.json
  const audio = process.argv[2];
  if (!audio || !existsSync(audio)) {
    console.error("Uso: node scripts/whisper.mjs ruta/al/audio.mp3");
    process.exit(1);
  }
  const r = await palabrasDe(audio);
  const { writeFile } = await import("node:fs/promises");
  const dest = audio.replace(/\.[^.]+$/, ".json");
  await writeFile(dest, JSON.stringify(r, null, 2));
  console.log(`${r.words.length} palabras, ${r.duration.toFixed(1)} s -> ${dest}`);
}

// Whisper oye mal nombres y marcas ("karenareyesnails" -> "Karen Arrelles Neils").
// Cuando el texto ya se conoce (guion), se usa solo para los tiempos: se alinean
// letra por letra (distancia de edición) las palabras del guion con lo que oyó
// Whisper y cada palabra del guion hereda el tiempo de sus letras.
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]/g, "");
export const alinearAlGuion = (texto, words) => {
  const guion = texto.split(/\s+/).filter(Boolean);
  const A = [];
  guion.forEach((w, i) => { for (const c of norm(w)) A.push({ c, i }); });
  const B = [];
  for (const w of words) {
    const n = norm(w.text), d = (w.end - w.start) / Math.max(n.length, 1);
    [...n].forEach((c, k) => B.push({ c, t0: w.start + k * d, t1: w.start + (k + 1) * d }));
  }
  const n = A.length, m = B.length;
  const D = Array.from({ length: n + 1 }, () => new Float32Array(m + 1));
  for (let i = 1; i <= n; i++) D[i][0] = i;
  for (let j = 1; j <= m; j++) D[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    D[i][j] = Math.min(D[i - 1][j - 1] + (A[i - 1].c === B[j - 1].c ? 0 : 1), D[i - 1][j] + 1, D[i][j - 1] + 1);
  }
  const par = new Array(n).fill(-1);
  for (let i = n, j = m; i > 0 && j > 0;) {
    if (D[i][j] === D[i - 1][j - 1] + (A[i - 1].c === B[j - 1].c ? 0 : 1)) { par[i - 1] = j - 1; i--; j--; }
    else if (D[i][j] === D[i - 1][j] + 1) i--;
    else j--;
  }
  const out = guion.map((text) => ({ text, start: NaN, end: NaN }));
  A.forEach((a, k) => {
    if (par[k] < 0) return;
    const b = B[par[k]], o = out[a.i];
    o.start = Number.isNaN(o.start) ? b.t0 : Math.min(o.start, b.t0);
    o.end = Number.isNaN(o.end) ? b.t1 : Math.max(o.end, b.t1);
  });
  // Palabras sin letras emparejadas: reparten el hueco entre sus vecinas.
  const fin = words.length ? words[words.length - 1].end : 0;
  for (let k = 0; k < out.length; k++) {
    if (!Number.isNaN(out[k].start)) continue;
    let e = k;
    while (e < out.length && Number.isNaN(out[e].start)) e++;
    const t0 = k > 0 ? out[k - 1].end : 0, t1 = e < out.length ? out[e].start : fin, d = (t1 - t0) / (e - k);
    for (let q = k; q < e; q++) { out[q].start = t0 + (q - k) * d; out[q].end = t0 + (q - k + 1) * d; }
    k = e;
  }
  for (let k = 0; k < out.length; k++) {
    const o = out[k];
    if (k > 0) o.start = Math.max(o.start, out[k - 1].end);
    o.end = Math.max(o.end, o.start + 0.12);
    o.start = +o.start.toFixed(3); o.end = +o.end.toFixed(3);
  }
  return out;
};
