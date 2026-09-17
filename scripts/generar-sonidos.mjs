// Genera música de fondo y efectos de sonido con ElevenLabs (Sound Effects API,
// disponible en el plan gratuito).
//
// Uso:  npm run sonidos                 -> genera música y todos los efectos
//       npm run sonidos -- musica        -> solo la música
//       npm run sonidos -- whoosh pop    -> solo esos efectos
//
// Cambia los prompts abajo para otro estilo. La música sale en loop de 22 s
// y el video la repite las veces que haga falta.

import { mkdir, writeFile } from "node:fs/promises";

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error("Falta ELEVENLABS_API_KEY en .env");
  process.exit(1);
}

const PISTAS = {
  musica: {
    file: "public/musica.mp3",
    text: process.env.MUSICA_PROMPT ??
      "chill lo-fi hip hop instrumental beat with soft drums, warm bass and mellow piano chords, seamless loop, no vocals",
    duration_seconds: 22,
    loop: true,
    prompt_influence: 0.4,
  },
  whoosh: {
    file: "public/sfx/whoosh.mp3",
    text: "fast cinematic whoosh swipe transition",
    duration_seconds: 1,
    prompt_influence: 0.6,
  },
  pop: {
    file: "public/sfx/pop.mp3",
    text: "short soft ui pop click, bubbly, clean",
    duration_seconds: 0.5,
    prompt_influence: 0.6,
  },
  ding: {
    file: "public/sfx/ding.mp3",
    text: "bright short notification ding chime, positive",
    duration_seconds: 1,
    prompt_influence: 0.6,
  },
};

const pedidas = process.argv.slice(2);
const nombres = pedidas.length ? pedidas : Object.keys(PISTAS);

await mkdir("public/sfx", { recursive: true });

for (const nombre of nombres) {
  const p = PISTAS[nombre];
  if (!p) {
    console.error(`No conozco "${nombre}". Opciones: ${Object.keys(PISTAS).join(", ")}`);
    continue;
  }
  const { file, ...body } = p;
  process.stdout.write(`Generando ${nombre}... `);
  const res = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`\nElevenLabs respondió ${res.status}: ${await res.text()}`);
    continue;
  }
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  console.log(`ok -> ${file}`);
}
