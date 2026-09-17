// Sube un video terminado a Gemini y pide una revisión de editor: gancho,
// ritmo, legibilidad, sincronía de subtítulos, mezcla de audio y 2 cambios
// concretos. Gratis. Guarda el resultado en out/revision.md.
//
// Uso:  npm run revisar                      (revisa out/tiktok-pro.mp4)
//       npm run revisar -- out/otro.mp4

import { readFile, stat, writeFile } from "node:fs/promises";
import { geminiKey, generateContent, textoDe } from "./gemini.mjs";

const video = process.argv[2] ?? "out/tiktok-pro.mp4";
const key = geminiKey();
const base = "https://generativelanguage.googleapis.com";
const { size } = await stat(video);

console.log(`Subiendo ${video} (${(size / 1e6).toFixed(1)} MB)...`);
const start = await fetch(`${base}/upload/v1beta/files?key=${key}`, {
  method: "POST",
  headers: {
    "X-Goog-Upload-Protocol": "resumable",
    "X-Goog-Upload-Command": "start",
    "X-Goog-Upload-Header-Content-Length": String(size),
    "X-Goog-Upload-Header-Content-Type": "video/mp4",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ file: { display_name: video.split("/").pop() } }),
});
const uploadUrl = start.headers.get("x-goog-upload-url");
if (!uploadUrl) throw new Error(`No se pudo iniciar la subida: ${start.status} ${await start.text()}`);

const up = await fetch(uploadUrl, {
  method: "POST",
  headers: { "Content-Length": String(size), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
  body: await readFile(video),
});
const { file } = await up.json();

process.stdout.write("Procesando");
for (let i = 0; i < 40; i++) {
  const st = await (await fetch(`${base}/v1beta/${file.name}?key=${key}`)).json();
  if (st.state === "ACTIVE") break;
  if (st.state === "FAILED") throw new Error("Gemini no pudo procesar el video");
  process.stdout.write(".");
  await new Promise((r) => setTimeout(r, 3000));
}
console.log();

const model = process.env.GEMINI_TEXT_MODEL ?? "gemini-3.6-flash";
const out = await generateContent(model, {
  contents: [
    {
      parts: [
        { file_data: { mime_type: "video/mp4", file_uri: file.uri } },
        {
          text: `Eres editor senior de videos cortos para TikTok y YouTube Shorts. Revisa este video con ojo crítico.
Responde en español, en markdown, con estas secciones cortas:
1. Qué funciona (2 viñetas)
2. Qué falla: gancho, ritmo, legibilidad del texto, sincronía subtítulos-voz, mezcla de audio, cierre (viñetas, solo lo relevante)
3. Retención: en qué segundo crees que la gente se va y por qué
4. Los 3 cambios concretos que harías primero, ordenados por impacto
5. Un título alternativo y una primera frase alternativa más fuertes`,
        },
      ],
    },
  ],
});

const texto = textoDe(out);
await writeFile("out/revision.md", `# Revisión de ${video}\n\n${texto}\n`);
console.log(texto);
console.log("\nGuardado en out/revision.md");

// Borrar el archivo subido (Gemini lo borra solo a las 48 h, pero mejor limpiar).
await fetch(`${base}/v1beta/${file.name}?key=${key}`, { method: "DELETE" }).catch(() => {});
