// Traduce public/guion.json a otro idioma con Gemini y deja guion.txt y
// guion.json listos para `npm run voz`. Guarda el original como guion.<idioma>.json.
//
// Uso:  npm run traducir -- en        (inglés)
//       npm run traducir -- pt        (portugués) ...
// El guion original se respalda con su idioma detectado, por ejemplo public/guion.es.json.

import { readFile, writeFile } from "node:fs/promises";
import { generateContent, textoDe } from "./gemini.mjs";

const idioma = process.argv[2];
if (!idioma) {
  console.error("Uso: npm run traducir -- en");
  process.exit(1);
}
const g = JSON.parse(await readFile("public/guion.json", "utf8"));
const origen = g.idioma ?? "es";
await writeFile(`public/guion.${origen}.json`, JSON.stringify(g, null, 2));

const nombres = { en: "inglés (Estados Unidos)", pt: "portugués (Brasil)", fr: "francés", de: "alemán", it: "italiano", es: "español neutro" };
const destino = nombres[idioma] ?? idioma;

console.log(`Traduciendo el guion "${g.hook}" a ${destino}...`);
const out = await generateContent(process.env.GEMINI_TEXT_MODEL ?? "gemini-3.6-flash", {
  contents: [
    {
      parts: [
        {
          text: `Eres guionista bilingüe de videos cortos (TikTok, Shorts). Traduce este guion a ${destino}.
No traduzcas literal: adapta para que suene nativo, con el mismo ritmo, fuerza y longitud (misma cantidad de frases, largo similar).
Mantén el tono directo y las frases cortas. Sin emojis ni hashtags.

Guion:
${JSON.stringify({ hook: g.hook, kicker: g.kicker, cta: g.cta, frases: g.frases, palabrasClave: g.palabrasClave ?? [] }, null, 2)}

Responde SOLO JSON con la misma forma: {"hook":"...","kicker":"UNA PALABRA EN MAYÚSCULAS","cta":"...","frases":[...],"palabrasClave":[las 6 a 10 palabras con más fuerza, tal como aparecen en las frases traducidas]}`,
        },
      ],
    },
  ],
  generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
});

const t = JSON.parse(textoDe(out));
const nuevo = { ...g, ...t, idioma, tema: g.tema, traducidoDe: origen };
await writeFile("public/guion.json", JSON.stringify(nuevo, null, 2));
await writeFile("public/guion.txt", t.frases.join("\n") + "\n");

console.log(`\nKicker: ${t.kicker}\nHook:   ${t.hook}\nCTA:    ${t.cta}\nClave:  ${(t.palabrasClave ?? []).join(", ")}\n`);
t.frases.forEach((f, i) => console.log(`${i + 1}. ${f}`));
console.log(`\nListo: public/guion.json (${idioma}). Original en public/guion.${origen}.json. Siguiente: npm run voz`);
