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
