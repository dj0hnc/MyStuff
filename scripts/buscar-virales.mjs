// Busca en YouTube los videos largos con más vistas de hoy / la semana / el mes
// por nicho, en inglés y español. Son la materia prima para clipear.
//
// Uso:  npm run virales                          (todos los nichos, esta semana)
//       npm run virales -- podcast-es negocios-en  (solo esos nichos)
//       npm run virales -- "joe rogan" "kick streamer"   (búsquedas libres)
//       npm run virales -- --periodo hoy|semana|mes  --n 15  --min 8  (min = minutos mínimos)
//       npm run virales -- --cc                    (solo Creative Commons: se pueden reusar legalmente)
// Crea: out/virales.md (tabla con enlaces) y out/virales.json
// Luego: npm run clipear -- "URL"

import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { ytdlp } from "./ytdlp.mjs";

const NICHOS = {
  "podcast-es": ["podcast entrevista", "podcast mexico", "la cotorrisa", "podcast motivacion"],
  "podcast-en": ["podcast interview", "joe rogan experience", "diary of a ceo", "podcast full episode"],
  "negocios-es": ["como ganar dinero", "emprender negocio", "finanzas personales"],
  "negocios-en": ["how to make money", "business advice", "entrepreneur interview"],
  "streamers": ["kick stream highlights", "stream en vivo reaccion", "ibai", "kai cenat stream"],
  "true-crime": ["true crime documentary", "caso real documental", "misterio sin resolver"],
  "deportes": ["futbol entrevista", "boxing press conference", "nba podcast"],
  "rave-edm": ["dj set festival", "boiler room", "psytrance live set", "edm documentary"],
};

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const flagsConValor = new Set(["--periodo", "--n", "--min"]);
const libres = args.filter((a, i) => !a.startsWith("--") && !flagsConValor.has(args[i - 1]));
const PERIODO = opt("periodo", "semana");
const N = Number(opt("n", 10));
const MIN_MIN = Number(opt("min", 8));
const CC = args.includes("--cc");

// Filtro "sp" de YouTube: orden por vistas + fecha de subida (+ Creative Commons).
const SP = {
  hoy: CC ? "CAMSBAgCMAE%3D" : "CAMSAggC",
  semana: CC ? "CAMSBAgDMAE%3D" : "CAMSAggD",
  mes: CC ? "CAMSBAgEMAE%3D" : "CAMSAggE",
};
const DIAS = { hoy: 1, semana: 7, mes: 30 };
if (!SP[PERIODO]) { console.error("--periodo debe ser hoy, semana o mes"); process.exit(1); }

const busquedas = [];
const elegidos = libres.filter((a) => NICHOS[a]);
const texto = libres.filter((a) => !NICHOS[a]);
for (const k of elegidos.length || texto.length ? elegidos : Object.keys(NICHOS)) for (const q of NICHOS[k]) busquedas.push({ nicho: k, q });
for (const q of texto) busquedas.push({ nicho: "libre", q });

const bin = await ytdlp();
const vistos = new Map();
for (const { nicho, q } of busquedas) {
  process.stdout.write(`Buscando [${nicho}] "${q}"... `);
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=${SP[PERIODO]}`;
  let entries = [];
  try {
    const out = execFileSync(bin, ["--flat-playlist", "-I", `1:${N * 2}`, "-J", url], { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
    entries = JSON.parse(out.toString()).entries ?? [];
  } catch {
    console.log("falló, sigo");
    continue;
  }
  let n = 0;
  for (const e of entries) {
    if (!e.id || !e.view_count || (e.duration ?? 0) < MIN_MIN * 60) continue;
    if (vistos.has(e.id)) continue;
    vistos.set(e.id, {
      nicho,
      busqueda: q,
      titulo: e.title,
      canal: e.channel ?? e.uploader,
      vistas: e.view_count,
      minutos: Math.round(e.duration / 60),
      vistasDia: Math.round(e.view_count / DIAS[PERIODO]),
      url: `https://www.youtube.com/watch?v=${e.id}`,
    });
    if (++n >= N) break;
  }
  console.log(n);
}

const lista = [...vistos.values()].sort((a, b) => b.vistas - a.vistas);
await mkdir("out", { recursive: true });
await writeFile("out/virales.json", JSON.stringify(lista, null, 1));
const fmt = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : String(v));
const md = [
  `# Virales (${PERIODO}${CC ? ", Creative Commons" : ""}) · ${new Date().toISOString().slice(0, 10)}`,
  "",
  "Ordenados por vistas. Para clipear uno: `npm run clipear -- \"URL\"`.",
  "",
  "| # | Vistas | Min | Nicho | Canal | Título |",
  "| --- | --- | --- | --- | --- | --- |",
  ...lista.map((v, i) => `| ${i + 1} | ${fmt(v.vistas)} | ${v.minutos} | ${v.nicho} | ${v.canal} | [${v.titulo.replace(/\|/g, "/")}](${v.url}) |`),
].join("\n");
await writeFile("out/virales.md", md + "\n");
console.log(`\n${lista.length} videos -> out/virales.md`);
lista.slice(0, 10).forEach((v, i) => console.log(`${String(i + 1).padStart(2)}. ${fmt(v.vistas).padStart(6)}  ${v.minutos}m  [${v.nicho}] ${v.titulo.slice(0, 70)}\n    ${v.url}`));
