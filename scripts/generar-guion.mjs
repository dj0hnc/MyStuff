// Escribe el guion de un TikTok con Gemini (gratis) y lo deja listo para
// `npm run voz`. También propone gancho, kicker y llamado a la acción.
//
// Uso:  npm run guion -- "3 hábitos para dormir mejor"
//       npm run guion -- "por qué el café te da sueño" --palabras 60 --tono divertido
// Crea: public/guion.txt   (una frase por línea, lo que dice la voz)
//       public/guion.json  (hook, kicker, cta, frases) para copiar a los props

import { writeFile } from "node:fs/promises";
import { generateContent, textoDe } from "./gemini.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const tema = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--"))).join(" ");
if (!tema) {
  console.error('Uso: npm run guion -- "tema del video" [--palabras 70] [--tono directo|divertido|inspirador]');
  process.exit(1);
}
const palabras = Number(opt("palabras", 70));
const tono = opt("tono", "directo y cercano");
const model = process.env.GEMINI_TEXT_MODEL ?? "gemini-3.6-flash";

const prompt = `Eres guionista de videos cortos en español para TikTok y YouTube Shorts.
Escribe un guion sobre: "${tema}".

Reglas:
- Tono ${tono}. Español neutro, tú, frases cortas, sin emojis ni hashtags.
- El guion hablado debe tener unas ${palabras} palabras en total, en 5 a 8 frases.
- La primera frase debe enganchar en 3 segundos. La última debe cerrar con fuerza.
- Nada de "en este video te voy a contar". Empieza directo.

Responde SOLO con JSON válido, sin markdown, con esta forma:
{
  "hook": "título de máximo 6 palabras que aparece en pantalla al inicio",
  "kicker": "una palabra en mayúsculas para la etiqueta sobre el título, ej. ATENCIÓN, DATO, OJO",
  "cta": "llamado a la acción de máximo 4 palabras, ej. Sígueme para más",
  "frases": ["frase 1", "frase 2", "..."],
  "palabrasClave": ["las 6 a 10 palabras del guion con más fuerza emocional, tal como aparecen en las frases"]
}`;

console.log(`Escribiendo guion sobre "${tema}" con ${model}...`);
const out = await generateContent(model, {
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: { temperature: 0.9, responseMimeType: "application/json" },
});

let data;
try {
  data = JSON.parse(textoDe(out).replace(/^```json\s*|```$/g, "").trim());
} catch {
  console.error("Gemini no devolvió JSON válido:\n" + textoDe(out));
  process.exit(1);
}

await writeFile("public/guion.txt", data.frases.join("\n") + "\n");
await writeFile("public/guion.json", JSON.stringify({ tema, ...data }, null, 2));

const total = data.frases.join(" ").split(/\s+/).length;
console.log(`\nKicker: ${data.kicker}\nHook:   ${data.hook}\nCTA:    ${data.cta}\nClave:  ${(data.palabrasClave ?? []).join(", ")}\n`);
data.frases.forEach((f, i) => console.log(`${i + 1}. ${f}`));
console.log(`\n${total} palabras -> public/guion.txt y public/guion.json. Siguiente: npm run voz`);
