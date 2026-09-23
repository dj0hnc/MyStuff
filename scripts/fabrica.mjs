// FÁBRICA: la producción diaria en un solo comando.
// Toma los videos más vistos de out/virales.json (los busca si no hay o si tienen
// más de 12 h), clipea los que aún no has usado y arma el calendario de publicación
// con títulos, descripciones y hashtags por idioma.
//
// Uso:  npm run fabrica -- --handle @tucanal
//       npm run fabrica -- --videos 3 --clips 4 --subs es --doble --handle @tucanal
//       npm run fabrica -- --nichos podcast-en,negocios-en --por-dia 4 --horas 12:00,15:00,19:00,21:00
// Opciones:
//   --videos 2       cuántos videos fuente clipear (default 2)
//   --clips 4        clips por video (default 4)
//   --subs es        subtítulos traducidos a ese idioma
//   --doble          además saca la versión con subtítulos originales (dos cuentas, dos idiomas)
//   --nichos a,b     nichos para npm run virales si hay que buscar (default podcast-en,negocios-en,podcast-es)
//   --por-dia 4      publicaciones por cuenta por día (default 4)
//   --horas ...      horas de publicación, hora local (default 12:00,15:00,19:00,21:00)
//   --refrescar      vuelve a buscar virales aunque la lista sea reciente
// Crea: out/publicar/calendario.md y calendario.csv (fecha, hora, idioma, archivo, título, descripción)
// Recuerda los videos ya usados en out/fabrica-hecho.json para no repetir.

import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const VIDEOS = Number(opt("videos", 2));
const CLIPS = Number(opt("clips", 4));
const SUBS = opt("subs", null);
const DOBLE = args.includes("--doble");
const HANDLE = opt("handle", process.env.CLIP_HANDLE ?? "");
const NICHOS = opt("nichos", "podcast-en,negocios-en,podcast-es").split(",");
const POR_DIA = Number(opt("por-dia", 4));
const HORAS = opt("horas", "12:00,15:00,19:00,21:00").split(",");

const correr = (script, extra) => spawnSync("node", ["--env-file-if-exists=.env", script, ...extra], { stdio: "inherit" }).status === 0;

// 1. lista de virales fresca
const lista = "out/virales.json";
if (args.includes("--refrescar") || !existsSync(lista) || Date.now() - statSync(lista).mtimeMs > 12 * 3600e3) {
  console.log("Buscando virales frescos...");
  correr("scripts/buscar-virales.mjs", [...NICHOS, "--n", "6"]);
}
if (!existsSync(lista)) { console.error("No hay out/virales.json"); process.exit(1); }
const virales = JSON.parse(await readFile(lista, "utf8"));
const hechoPath = "out/fabrica-hecho.json";
const hecho = existsSync(hechoPath) ? JSON.parse(await readFile(hechoPath, "utf8")) : {};

// 2. clipear los mejores que no se han usado (si uno falla, pasa al siguiente)
const producidos = [];
for (const v of virales) {
  if (producidos.length >= VIDEOS) break;
  if (hecho[v.url]) continue;
  const id = v.url.match(/v=([\w-]+)/)?.[1] ?? `v${Date.now()}`;
  const idiomaOriginal = v.nicho?.endsWith("-es") ? "es" : "en";
  console.log(`\n=== [${producidos.length + 1}/${VIDEOS}] ${v.titulo} (${v.canal})`);
  const base = ["scripts/clipear.mjs", v.url, "--n", String(CLIPS), "--nombre", id, "--idioma", idiomaOriginal, ...(HANDLE ? ["--handle", HANDLE] : [])];
  const versiones = [];
  if (SUBS && SUBS !== idiomaOriginal) {
    if (correr(base[0], [...base.slice(1), "--subs", SUBS])) versiones.push({ json: `out/clips/${id}-${SUBS}.json`, idioma: SUBS });
    if (DOBLE && correr(base[0], base.slice(1))) versiones.push({ json: `out/clips/${id}.json`, idioma: idiomaOriginal });
  } else if (correr(base[0], base.slice(1))) versiones.push({ json: `out/clips/${id}.json`, idioma: idiomaOriginal });
  if (!versiones.length) { hecho[v.url] = { fallo: new Date().toISOString() }; continue; }
  hecho[v.url] = { fecha: new Date().toISOString(), id, titulo: v.titulo };
  producidos.push(...versiones.map((x) => ({ ...x, fuente: v })));
}
await writeFile(hechoPath, JSON.stringify(hecho, null, 1));

// 3. calendario: cada idioma es una cuenta; se intercalan fuentes para no publicar
//    dos clips seguidos del mismo video. Empieza mañana.
const porIdioma = {};
for (const p of producidos) {
  if (!existsSync(p.json)) continue;
  const clips = JSON.parse(await readFile(p.json, "utf8")).sort((a, b) => (Number(b.viral) || 0) - (Number(a.viral) || 0));
  (porIdioma[p.idioma] ??= []).push(clips);
}
const filas = [];
for (const [idioma, grupos] of Object.entries(porIdioma)) {
  const cola = [];
  for (let i = 0; grupos.some((g) => g[i]); i++) for (const g of grupos) if (g[i]) cola.push(g[i]);
  cola.forEach((c, k) => {
    const d = new Date();
    d.setDate(d.getDate() + 1 + Math.floor(k / POR_DIA));
    const titulo = idioma === "es" ? c.titulo_es : c.titulo_en;
    const desc = idioma === "es" ? c.descripcion_es : c.descripcion_en;
    filas.push({ fecha: d.toISOString().slice(0, 10), hora: HORAS[k % POR_DIA % HORAS.length], idioma, archivo: c.archivo, titulo, descripcion: desc, hashtags: c.hashtags.join(" "), viral: c.viral });
  });
}
filas.sort((a, b) => (a.fecha + a.hora + a.idioma).localeCompare(b.fecha + b.hora + b.idioma));

await mkdir("out/publicar", { recursive: true });
const csv = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
await writeFile("out/publicar/calendario.csv", ["fecha,hora,idioma,archivo,titulo,descripcion,hashtags", ...filas.map((f) => [f.fecha, f.hora, f.idioma, f.archivo, f.titulo, f.descripcion, f.hashtags].map(csv).join(","))].join("\n") + "\n");
const md = ["# Calendario de publicación", "", "Cada clip va a YouTube Shorts, TikTok e Instagram Reels de la cuenta de ese idioma, a la misma hora.", ""];
let dia = "";
for (const f of filas) {
  if (f.fecha !== dia) { md.push(`## ${f.fecha}`, ""); dia = f.fecha; }
  md.push(`### ${f.hora} · ${f.idioma.toUpperCase()} · viral ${f.viral}/10`, `\`${f.archivo}\``, "", `**${f.titulo}**`, "", f.descripcion, "", f.hashtags, "");
}
await writeFile("out/publicar/calendario.md", md.join("\n"));
console.log(`\nFábrica: ${producidos.length} versiones de ${new Set(producidos.map((p) => p.fuente.url)).size} videos, ${filas.length} publicaciones agendadas.`);
console.log("Calendario: out/publicar/calendario.md (y .csv para programadores como Metricool).");
