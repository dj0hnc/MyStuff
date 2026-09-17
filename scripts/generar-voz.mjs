// Convierte el guion en voz con ElevenLabs y guarda los tiempos de cada
// palabra, para que los subtítulos queden sincronizados con el audio.
//
// Uso:  npm run voz
// Lee:  public/guion.txt          (una frase por línea)
// Crea: public/voz.mp3            (la voz)
//       public/voz.json           (palabras con inicio y fin en segundos)
//
// Necesita ELEVENLABS_API_KEY en el archivo .env (ignorado por git).
// Opcional: ELEVENLABS_VOICE_ID para elegir otra voz.

import { readFile, writeFile } from "node:fs/promises";

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error("Falta ELEVENLABS_API_KEY en .env");
  process.exit(1);
}

// Voz por defecto: "Sarah", multilingüe y clara. Cambia el ID en .env si
// prefieres otra. Lista tus voces con: npm run voces
const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL";

const guion = (await readFile("public/guion.txt", "utf8"))
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

if (guion.length === 0) {
  console.error("public/guion.txt está vacío");
  process.exit(1);
}

const texto = guion.join(" ");
console.log(`Generando voz para ${texto.split(" ").length} palabras...`);

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
  console.error(`ElevenLabs respondió ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const data = await res.json();
await writeFile("public/voz.mp3", Buffer.from(data.audio_base64, "base64"));

// La API devuelve el tiempo de cada carácter. Los agrupamos en palabras.
const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } =
  data.alignment;

const words = [];
let current = null;
for (let i = 0; i < characters.length; i++) {
  const ch = characters[i];
  if (ch === " " || ch === "\n") {
    if (current) words.push(current);
    current = null;
    continue;
  }
  if (!current) current = { text: ch, start: starts[i], end: ends[i] };
  else {
    current.text += ch;
    current.end = ends[i];
  }
}
if (current) words.push(current);

const duration = ends[ends.length - 1];
await writeFile("public/voz.json", JSON.stringify({ duration, words }, null, 2));

console.log(`Listo: public/voz.mp3 (${duration.toFixed(1)} s) y public/voz.json (${words.length} palabras)`);
