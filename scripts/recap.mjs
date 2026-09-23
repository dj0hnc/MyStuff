// RECAP: escenas de película explicadas, sin que narres nada.
// Gemini ve el video (tráiler, escena o película de dominio público), escribe un
// guion con gancho y elige las tomas más fuertes; la voz de IA lo narra
// (npm run voz: ElevenLabs o Gemini) y TikTokPro corta las tomas debajo de la voz.
// El audio original no se usa: solo la narración (menos riesgo de Content ID).
//
// Uso:  npm run recap -- "https://www.youtube.com/watch?v=TRAILER"
//       npm run recap -- public/reedit/nosferatu.mp4 --desde 1800 --hasta 2400
//       npm run recap -- "URL" --tema "el final que nadie entendió" --palabras 90 --handle @canal
// Opciones:
//   --tema "..."     ángulo del video (default: Gemini elige el más viral)
//   --idioma es      idioma de la narración (default es; usa en para la cuenta en inglés)
//   --palabras 85    largo del guion (~30-40 s)
//   --desde/--hasta  tramo en segundos del video fuente (para películas completas)
//   --sin-render     deja listo guion, voz y tomas pero no renderiza
// Crea: out/recap-<nombre>.mp4 y out/recap-<nombre>.md (títulos, descripción, hashtags ES/EN)

import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { generateContent, subirArchivo, textoDe } from "./gemini.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const conValor = new Set(["--tema", "--idioma", "--palabras", "--desde", "--hasta", "--handle", "--nombre"]);
const fuente = args.find((a, i) => !a.startsWith("--") && !conValor.has(args[i - 1]));
if (!fuente) { console.error('Uso: npm run recap -- "URL o ruta.mp4" [--tema "..."] [--idioma es]'); process.exit(1); }
const TEMA = opt("tema", "");
const IDIOMA = opt("idioma", "es");
const PALABRAS = Number(opt("palabras", 85));
const DESDE = Number(opt("desde", 0));
const HASTA = opt("hasta", null);
const HANDLE = opt("handle", process.env.CLIP_HANDLE ?? "");

const require = createRequire(import.meta.url);
const comp = dirname(require.resolve("@remotion/compositor-linux-x64-gnu/package.json"));
const ffmpeg = join(comp, "ffmpeg"), ffprobe = join(comp, "ffprobe");
const correr = (script, extra = []) => execFileSync("node", ["--env-file-if-exists=.env", script, ...extra], { stdio: "inherit" });

// 1. video fuente en public/reedit/
const esURL = /^https?:\/\//.test(fuente);
const nombre = (opt("nombre", null) ?? (esURL ? fuente.match(/(?:v=|youtu\.be\/|shorts\/|video\/)([\w-]{6,})/)?.[1] ?? "recap" : basename(fuente).replace(/\.[^.]+$/, ""))).replace(/[^\w-]/g, "_");
const video = esURL ? `public/reedit/${nombre}.mp4` : fuente;
if (esURL && !existsSync(video)) correr("scripts/bajar.mjs", [fuente, nombre]);
if (!existsSync(video) || !video.startsWith("public/")) { console.error(`El video debe existir dentro de public/ (ej. public/reedit/x.mp4): ${video}`); process.exit(1); }
const dur = Number(execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video]).toString());

// Para Gemini: solo el tramo pedido, en baja resolución (sube rápido y gasta menos cuota).
// ponytail: Gemini ve ~1 cuadro por segundo; más de 20 min por video pesa mucho, usa --desde/--hasta.
const fin = Math.min(dur, HASTA ? Number(HASTA) : dur);
if (fin - DESDE > 20 * 60) console.warn(`Aviso: ${((fin - DESDE) / 60).toFixed(0)} min es mucho para Gemini; mejor --desde/--hasta de 5 a 15 min.`);
const muestra = `public/reedit/${nombre}-gemini.mp4`;
execFileSync(ffmpeg, ["-y", "-loglevel", "fatal", "-ss", String(DESDE), "-to", String(fin), "-i", video, "-vf", "scale=-2:360", "-r", "10", "-c:v", "libx264", "-preset", "veryfast", "-crf", "32", "-c:a", "aac", "-b:a", "64k", muestra]);

// 2. Gemini: guion + tomas
const archivo = await subirArchivo(muestra);
console.log("Gemini: escribiendo el guion y eligiendo tomas...");
const idiomaTxt = IDIOMA === "en" ? "inglés (EE. UU.)" : "español latino neutro";
const r = await generateContent(process.env.GEMINI_TEXT_MODEL, {
  contents: [{ parts: [
    { file_data: { mime_type: "video/mp4", file_uri: archivo.uri } },
    { text: `Eres guionista de un canal viral de "escenas de película explicadas" para TikTok y YouTube Shorts.
Mira este video (identifica la película o serie si puedes) y escribe la narración de un video vertical de 30 a 40 s en ${idiomaTxt}.
${TEMA ? `Ángulo: ${TEMA}.` : "Elige el ángulo más viral: dato oculto, detrás de cámaras, teoría, lo que nadie notó, por qué la escena es icónica."}
Reglas del guion: unas ${PALABRAS} palabras en 5 a 8 frases cortas. La PRIMERA frase engancha en 2 s con un misterio o dato fuerte. No describas lo obvio que se ve; aporta contexto. Cierra con una pregunta que provoque comentarios. Sin emojis ni hashtags en las frases. No inventes datos: si no estás seguro, habla de lo que se ve.
Tomas: elige de 8 a 12 momentos visuales del video, de 2 a 4 s cada uno, los más impactantes, en el orden en que acompañan la narración. Tiempos en segundos desde el inicio de ESTE video. Evita tomas con texto en pantalla o créditos.
Responde SOLO JSON:
{"pelicula":"...","hook":"máx 6 palabras en pantalla","kicker":"UNA palabra, ej. DATO, OJO, SECRETO","cta":"máx 4 palabras","frases":["..."],"palabrasClave":["6 a 10 palabras fuertes tal como aparecen"],"tomas":[{"start":n,"end":n}],"titulo_es":"...","titulo_en":"...","descripcion_es":"2 líneas","descripcion_en":"2 lines","hashtags":["#..."]}` },
  ] }],
  generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
});
await archivo.borrar();
execFileSync("rm", ["-f", muestra]);
const g = JSON.parse(textoDe(r));

// 3. guion para npm run voz, tomas como clips de fondo (tramos del mismo archivo)
const src = video.replace(/^public\//, "");
const tomas = (g.tomas ?? [])
  .map((t) => ({ inicio: +(DESDE + Number(t.start)).toFixed(2), duracion: +(Number(t.end) - Number(t.start)).toFixed(2) }))
  .filter((t) => t.duracion >= 1 && t.inicio + t.duracion <= fin + 0.5)
  .map((t) => ({ archivo: src, ...t }));
if (!tomas.length) { console.error("Gemini no devolvió tomas válidas:\n" + JSON.stringify(g.tomas)); process.exit(1); }
await writeFile("public/guion.txt", g.frases.join("\n") + "\n");
await writeFile("public/guion.json", JSON.stringify({ tema: g.pelicula, hook: g.hook, kicker: g.kicker, cta: g.cta, frases: g.frases, palabrasClave: g.palabrasClave ?? [] }, null, 2));
await writeFile("public/clips.json", JSON.stringify({ fuente: "recap", clips: tomas }, null, 2));
console.log(`\n${g.pelicula}\nHook: ${g.hook}\n${g.frases.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n${tomas.length} tomas.`);

// 4. voz (ElevenLabs o Gemini) y render. Sin música: el audio es solo la narración.
//    Degradado negro en vez del morado de la plantilla para no teñir la película.
correr("scripts/generar-voz.mjs");
const salida = `out/recap-${nombre}${IDIOMA === "es" ? "" : `-${IDIOMA}`}.mp4`;
const promedio = tomas.reduce((a, t) => a + t.duracion, 0) / tomas.length;
if (!args.includes("--sin-render")) {
  correr("scripts/render.mjs", [salida, JSON.stringify({ bgFrom: "#050505", bgTo: "#0A0A0A", fondoClips: true, segundosPorClip: +Math.min(3.5, Math.max(1.5, promedio)).toFixed(1), musica: false, ...(HANDLE ? { handle: HANDLE } : {}) })]);
}
const tags = (g.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
await writeFile(salida.replace(/\.mp4$/, ".md"), [`# ${g.pelicula}`, "", `\`${salida}\``, "", `**ES** · ${g.titulo_es}`, "", g.descripcion_es, "", `**EN** · ${g.titulo_en}`, "", g.descripcion_en, "", tags, ""].join("\n"));
console.log(`\nListo: ${salida} y ${salida.replace(/\.mp4$/, ".md")}`);
