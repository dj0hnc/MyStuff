// STATS: qué está funcionando en un canal (el tuyo o el de la competencia).
// Lee los Shorts y videos públicos, calcula la mediana de vistas y marca los
// ganadores (2x la mediana o más). Con Gemini, explica el patrón de los ganadores
// y propone los próximos 10 clips.
//
// Uso:  npm run stats -- @tucanal
//       npm run stats -- @competidor1 @competidor2     (espiar a quien ya creció en tu nicho)
//       npm run stats -- @canal --n 60                  (cuántos videos leer por pestaña, default 40)
// Crea: out/stats-<canal>.md
// No pide login: solo usa datos públicos. Las vistas de Shorts vienen redondeadas por YouTube.

import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { generateContent, textoDe } from "./gemini.mjs";
import { ytdlp } from "./ytdlp.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const canales = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--n");
const N = Number(opt("n", 40));
if (!canales.length) { console.error("Uso: npm run stats -- @canal [@otro]"); process.exit(1); }

const bin = await ytdlp();
const fmt = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : String(v));
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

const leer = (url) => {
  try {
    const out = execFileSync(bin, ["--flat-playlist", "-I", `1:${N}`, "-J", url], { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
    return (JSON.parse(out.toString()).entries ?? []).filter((e) => e.id && e.view_count != null);
  } catch {
    return [];
  }
};

await mkdir("out", { recursive: true });
for (const c of canales) {
  const handle = c.startsWith("http") ? c : `https://www.youtube.com/${c.startsWith("@") ? c : `@${c}`}`;
  const nombre = handle.split("/").pop().replace(/[^\w@-]/g, "_");
  console.log(`\n== ${nombre}`);
  const md = [`# Stats de ${nombre} · ${new Date().toISOString().slice(0, 10)}`, ""];
  const resumen = [];
  for (const [tab, etiqueta] of [["shorts", "Shorts"], ["videos", "Videos largos"]]) {
    const vs = leer(`${handle}/${tab}`);
    if (!vs.length) { console.log(`  ${etiqueta}: nada público`); continue; }
    const med = mediana(vs.map((v) => v.view_count));
    const total = vs.reduce((a, v) => a + v.view_count, 0);
    const ordenados = [...vs].sort((a, b) => b.view_count - a.view_count);
    const ganadores = ordenados.filter((v) => v.view_count >= med * 2);
    console.log(`  ${etiqueta}: ${vs.length} leídos, mediana ${fmt(med)}, ${ganadores.length} ganadores (2x+)`);
    md.push(`## ${etiqueta}`, "", `${vs.length} más recientes · mediana ${fmt(med)} vistas · total ${fmt(total)} · ganadores (2x la mediana o más): ${ganadores.length}`, "",
      "| # | Vistas | x mediana | Título |", "| --- | --- | --- | --- |",
      ...ordenados.slice(0, 15).map((v, i) => `| ${i + 1} | ${fmt(v.view_count)} | ${med ? (v.view_count / med).toFixed(1) : "-"} | [${(v.title ?? "").replace(/\|/g, "/")}](https://www.youtube.com/watch?v=${v.id}) |`), "");
    // Orden original = más reciente primero: ¿los últimos 10 van mejor o peor que los 10 anteriores?
    const rec = mediana(vs.slice(0, 10).map((v) => v.view_count)), ant = mediana(vs.slice(10, 20).map((v) => v.view_count));
    if (vs.length >= 20) md.push(`Tendencia: últimos 10 ${fmt(rec)} vs 10 anteriores ${fmt(ant)} → ${rec >= ant ? "B" : "(W)"} ${ant ? Math.abs(((rec - ant) / ant) * 100).toFixed(1) : "-"}%`, "");
    resumen.push({ tab: etiqueta, mediana: med, ganadores: ganadores.slice(0, 12).map((v) => `${fmt(v.view_count)} · ${v.title}`), perdedores: ordenados.slice(-8).map((v) => `${fmt(v.view_count)} · ${v.title}`) });
  }
  if (resumen.length && process.env.GEMINI_API_KEY) {
    console.log("  Gemini: buscando el patrón de los ganadores...");
    try {
      const r = await generateContent(process.env.GEMINI_TEXT_MODEL ?? "gemini-3.6-flash", {
        contents: [{ parts: [{ text: `Eres estratega de crecimiento en YouTube Shorts y TikTok. Estos son los videos que más y menos funcionaron en el canal ${nombre}:\n${JSON.stringify(resumen, null, 1)}\n\nEn español, breve y accionable, con viñetas:\n1. El patrón de los ganadores (tema, invitado, tipo de gancho, formato del título, emoción).\n2. Qué evitar según los perdedores.\n3. 10 ideas concretas de próximos clips con título listo (si es un canal de clips, di de qué podcast/invitado/tema sacarlos).\n4. Una fórmula de título que copiar.` }] }],
        generationConfig: { temperature: 0.5 },
      });
      md.push("## Qué hacer con esto (Gemini)", "", textoDe(r), "");
    } catch (e) {
      console.log(`  Gemini falló: ${e.message}`);
    }
  }
  await writeFile(`out/stats-${nombre}.md`, md.join("\n"));
  console.log(`  -> out/stats-${nombre}.md`);
}
