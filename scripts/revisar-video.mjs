// Sube un video terminado a Gemini y pide una revisión de editor: gancho,
// ritmo, legibilidad, sincronía de subtítulos, mezcla de audio y 2 cambios
// concretos. Gratis. Guarda el resultado en out/revision.md.
//
// Uso:  npm run revisar                      (revisa out/tiktok-pro.mp4)
//       npm run revisar -- out/otro.mp4

import { writeFile } from "node:fs/promises";
import { generateContent, subirArchivo, textoDe } from "./gemini.mjs";

const video = process.argv[2] ?? "out/tiktok-pro.mp4";
const file = await subirArchivo(video);

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

await file.borrar();
