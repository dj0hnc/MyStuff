// Sube un final en 1080 al almacenamiento del panel (R2, finales/<proyecto>/<id>.mp4) y deja la vista previa ligera.
// El 1080 es lo que se descarga y se comparte a TikTok/YouTube; la vista previa (720p, liviana) es lo que se reproduce en el panel.
// Uso: npm run subir-final -- <archivo.mp4> <clipper|rave|karen> <id> [--sin-preview]
//   Anota hd/dur/mb en panel/data.json (clipper) o en panel/proyectos/<p>.json → videos (rave/karen) si el id ya existe.
import { readFileSync, writeFileSync, statSync, openSync, readSync, closeSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const [archivo, p, id] = process.argv.slice(2).filter((a) => !a.startsWith("--")), SIN_PREVIEW = process.argv.includes("--sin-preview");
if (!archivo || !["clipper", "rave", "karen"].includes(p) || !/^[\w-]+$/.test(id || "")) { console.log("Uso: npm run subir-final -- <archivo.mp4> <clipper|rave|karen> <id>"); process.exit(1); }
const PANEL = process.env.PANEL_URL || "https://puente-fabrica.pages.dev", PIN = process.env.PANEL_PIN;
if (!PIN) { console.error("Falta PANEL_PIN en el entorno."); process.exit(1); }
const FF = "node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg", FP = "node_modules/@remotion/compositor-linux-x64-gnu/ffprobe", PARTE = 25 * 1024 * 1024;
const api = async (ruta, opt = {}) => {
  for (let i = 1; ; i++) {
    try { const r = await fetch(`${PANEL}/api/crudos${ruta}`, { ...opt, headers: { "x-pin": PIN, ...(opt.headers || {}) } }); const d = await r.json(); if (!r.ok) throw new Error(d.mensaje || d.error || r.status); return d; }
    catch (e) { if (i >= 5) throw e; await new Promise((r) => setTimeout(r, 2000 * i)); } // reintenta si se cae la red
  }
};

const tam = statSync(archivo).size, dur = +Number(execFileSync(FP, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", archivo])).toFixed(1);
const ini = await api("/iniciar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ p, carpeta: "finales", nombre: `${id}.mp4`, tipo: "video/mp4", tam, quien: "Claude" }) });
const fd = openSync(archivo, "r"), partes = [], total = Math.ceil(tam / PARTE);
for (let n = 1; n <= total; n++) {
  const buf = Buffer.alloc(Math.min(PARTE, tam - (n - 1) * PARTE)); readSync(fd, buf, 0, buf.length, (n - 1) * PARTE);
  partes.push(await api(`/parte?key=${encodeURIComponent(ini.key)}&id=${encodeURIComponent(ini.id)}&n=${n}`, { method: "PUT", body: buf }));
  process.stdout.write(`\r${ini.key}: ${n}/${total}`);
}
closeSync(fd);
await api("/terminar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: ini.key, id: ini.id, partes }) });
console.log(` ✓ ${(tam / 1048576).toFixed(1)} MB, ${dur} s`);

// Vista previa ligera para el panel (Pages sirve archivos de hasta 25 MB). Si no cabe, el panel reproduce el 1080 desde R2.
let video = `/api/crudos/bajar?key=${encodeURIComponent(ini.key)}`;
if (!SIN_PREVIEW) {
  const prev = `panel/videos/${id}.mp4`;
  execFileSync(FF, ["-y", "-loglevel", "error", "-i", archivo, "-vf", "scale=720:-2", "-c:v", "libx264", "-crf", "28", "-preset", "veryfast", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", prev]);
  if (statSync(prev).size < 24 * 1048576) video = `videos/${id}.mp4`; else { rmSync(prev); console.log("La vista previa pasa de 24 MB: el panel reproducirá el 1080 directo."); }
}
const campos = { hd: ini.key, dur, mb: +(tam / 1048576).toFixed(1) };
const f = p === "clipper" ? "panel/data.json" : `panel/proyectos/${p}.json`, datos = JSON.parse(readFileSync(f, "utf8"));
const v = (datos.videos || []).find((x) => x.id === id || x.video?.endsWith(`/${id}.mp4`));
if (v) { Object.assign(v, campos, v.video?.startsWith("videos/") || v.video?.startsWith("/videos/") ? {} : { video }); writeFileSync(f, JSON.stringify(datos, null, 2) + "\n"); console.log(`Anotado en ${f}.`); }
else console.log(`Agrega a ${f}:`, JSON.stringify({ id, video: p === "clipper" ? video : "/" + video.replace(/^\//, ""), ...campos }));
