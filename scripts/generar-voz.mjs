// Convierte el guion en voz y guarda el tiempo de cada palabra para que los
// subtítulos queden sincronizados.
//
// Uso:  npm run voz
// Lee:  public/guion.txt          (una frase por línea)
// Crea: public/voz.mp3  y  public/voz.json
//
// Proveedores:
//   elevenlabs  mejor calidad, da los tiempos exactos. 10,000 caracteres/mes gratis.
//   gemini      voz de Google, gratis y sin límite práctico. Los tiempos se sacan con
//               Whisper local (exacto, gratis).
// Orden automático: elevenlabs si hay clave y cuota; si se agota, pasa a gemini.
// Fuerza uno con VOZ_PROVEEDOR=elevenlabs|gemini en .env.
// Voces: ELEVENLABS_VOICE_ID (npm run voces) / GEMINI_VOICE (Puck, Kore, Charon, Fenrir, Aoede, Leda, Orus, Zephyr...)
// Estilo Gemini: GEMINI_VOICE_STYLE="con energía, como creador de TikTok"

import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const guion = (await readFile("public/guion.txt", "utf8")).split("\n").map((l) => l.trim()).filter(Boolean);
if (guion.length === 0) {
  console.error("public/guion.txt está vacío");
  process.exit(1);
}
const texto = guion.join(" ");
const nPalabras = texto.split(/\s+/).length;

const ffmpeg = () => {
  const require = createRequire(import.meta.url);
  return join(dirname(require.resolve("@remotion/compositor-linux-x64-gnu/package.json")), "ffmpeg");
};

const conElevenLabs = async () => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("sin ELEVENLABS_API_KEY");
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL";
  console.log(`Generando voz con ElevenLabs (${nPalabras} palabras)...`);
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: texto,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3 },
      }),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 401 && /quota/i.test(t)) throw new Error("ElevenLabs sin caracteres este mes");
    throw new Error(`ElevenLabs respondió ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  await writeFile("public/voz.mp3", Buffer.from(data.audio_base64, "base64"));

  const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } = data.alignment;
  const words = [];
  let cur = null;
  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i];
    if (ch === " " || ch === "\n") {
      if (cur) words.push(cur);
      cur = null;
      continue;
    }
    if (!cur) cur = { text: ch, start: starts[i], end: ends[i] };
    else {
      cur.text += ch;
      cur.end = ends[i];
    }
  }
  if (cur) words.push(cur);
  return { duration: ends[ends.length - 1], words, proveedor: "elevenlabs" };
};

const conGemini = async () => {
  const { generateContent, imagenDe } = await import("./gemini.mjs");
  const { palabrasDe } = await import("./whisper.mjs");
  const model = process.env.GEMINI_TTS_MODEL ?? "gemini-3.1-flash-tts-preview";
  const voice = process.env.GEMINI_VOICE ?? "Puck";
  const estilo = process.env.GEMINI_VOICE_STYLE ?? "Habla en español neutro, con energía y ritmo de creador de TikTok, claro y natural";
  console.log(`Generando voz con Gemini (${model}, voz ${voice}, ${nPalabras} palabras)...`);
  const out = await generateContent(model, {
    contents: [{ parts: [{ text: `${estilo}:\n\n${texto}` }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
  });
  const audio = imagenDe(out); // misma forma: parte con inlineData
  if (!audio) throw new Error("Gemini no devolvió audio");
  const rate = /rate=(\d+)/.exec(audio.inlineData.mimeType)?.[1] ?? "24000";
  await writeFile("public/voz.pcm", Buffer.from(audio.inlineData.data, "base64"));
  execFileSync(ffmpeg(), ["-y", "-loglevel", "error", "-f", "s16le", "-ar", rate, "-ac", "1", "-i", "public/voz.pcm", "-q:a", "2", "public/voz.mp3"]);
  execFileSync("rm", ["-f", "public/voz.pcm"]);

  console.log("Sacando tiempos por palabra con Whisper local...");
  const r = await palabrasDe("public/voz.mp3");
  return { ...r, proveedor: "gemini" };
};

const PROVEEDORES = { elevenlabs: conElevenLabs, gemini: conGemini };
const forzado = process.env.VOZ_PROVEEDOR;
const orden = forzado ? [forzado] : [process.env.ELEVENLABS_API_KEY && "elevenlabs", process.env.GEMINI_API_KEY && "gemini"].filter(Boolean);
if (orden.length === 0) {
  console.error("Falta ELEVENLABS_API_KEY o GEMINI_API_KEY en .env");
  process.exit(1);
}

let r;
for (const nombre of orden) {
  try {
    r = await PROVEEDORES[nombre]();
    break;
  } catch (e) {
    console.warn(`${nombre} no disponible: ${e.message.split("\n")[0]}`);
  }
}
if (!r) {
  console.error("Ningún proveedor pudo generar la voz.");
  process.exit(1);
}

await writeFile("public/voz.json", JSON.stringify({ duration: r.duration, words: r.words, proveedor: r.proveedor }, null, 2));
console.log(`Listo (${r.proveedor}): public/voz.mp3 (${r.duration.toFixed(1)} s) y public/voz.json (${r.words.length} palabras)`);
