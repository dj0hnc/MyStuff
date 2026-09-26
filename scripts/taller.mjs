// Renderiza con Remotion y avisa el avance al Taller del panel (porcentaje, tiempo restante y una foto de lo que se crea).
// Sin PANEL_PIN solo renderiza, igual que antes. Lo usan render.mjs, clipear.mjs y pack-nails.mjs.
//
// Uso directo (en vez de `npx remotion render`):
//   node --env-file-if-exists=.env scripts/taller.mjs Reedit out/x.mp4 --crf=22 --props='{"edl":"reedit/edl.json"}' --titulo="Video 4" --proyecto=rave
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { basename } from "node:path";
import { tmpdir } from "node:os";

const PANEL = process.env.PANEL_URL || "https://puente-fabrica.pages.dev", PIN = process.env.PANEL_PIN;
const avisar = (b) => (PIN ? fetch(`${PANEL}/api/taller`, { method: "POST", headers: { "x-pin": PIN, "content-type": "application/json" }, body: JSON.stringify(b) }).catch(() => {}) : Promise.resolve());

export async function renderizar(comp, salida, args = [], { titulo = basename(salida), proyecto = "clipper" } = {}) {
  const id = `${Date.now().toString(36)}-${basename(salida, ".mp4").replace(/[^\w-]/g, "-").slice(0, 40)}`;
  await avisar({ id, titulo, proyecto, comp, salida, etapa: "Preparando", pct: 0, estado: "renderizando" });
  if (PIN) { // vistazo: el cuadro de los 2 s, chiquito
    const jpg = `${tmpdir()}/taller-${id}.jpg`;
    try {
      execFileSync("npx", ["remotion", "still", comp, jpg, "--frame=60", "--scale=0.35", "--image-format=jpeg", ...args.filter((a) => a.startsWith("--props"))], { stdio: "ignore", timeout: 180000 });
      await fetch(`${PANEL}/api/taller/foto?id=${id}`, { method: "PUT", headers: { "x-pin": PIN, "content-type": "image/jpeg" }, body: readFileSync(jpg) });
      await avisar({ id, foto: true });
    } catch {} finally { rmSync(jpg, { force: true }); }
  }
  let ultimo = 0, etapa = "";
  const tick = (b) => { if (b.etapa === etapa && Date.now() - ultimo < 15000) return; ultimo = Date.now(); etapa = b.etapa; avisar({ id, ...b }); }; // máx. 1 aviso cada 15 s por etapa
  const code = await new Promise((listo) => {
    const pr = spawn("npx", ["remotion", "render", comp, salida, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let resto = "";
    const leer = (salidaStd) => (d) => {
      salidaStd.write(d); resto += d; const lineas = resto.split(/[\r\n]/); resto = lineas.pop();
      for (const l of lineas) {
        let m;
        if ((m = /Rendered (\d+)\/(\d+)(?:, time remaining: (\d+)s)?/.exec(l))) tick({ etapa: "Renderizando cuadros", pct: (m[1] / m[2]) * 90, restante: m[3] ? +m[3] : undefined, linea: l.trim() });
        else if ((m = /Encoded (\d+)\/(\d+)/.exec(l))) tick({ etapa: "Armando el video", pct: 90 + (m[1] / m[2]) * 10, linea: l.trim() });
      }
    };
    pr.stdout.on("data", leer(process.stdout)); pr.stderr.on("data", leer(process.stderr));
    pr.on("close", listo);
  });
  await avisar({ id, estado: code === 0 ? "listo" : "error", ...(code === 0 ? { pct: 100 } : {}), etapa: code === 0 ? "Listo" : "Falló el render", restante: 0 });
  if (code !== 0) throw new Error(`remotion render ${comp} salió con código ${code}`);
}

if (process.argv[1]?.endsWith("taller.mjs")) {
  const [comp, salida, ...resto] = process.argv.slice(2);
  if (!comp || !salida) { console.log("Uso: node scripts/taller.mjs <Composición> <salida.mp4> [flags de remotion] [--titulo=…] [--proyecto=clipper|rave|karen]"); process.exit(1); }
  const op = (k) => resto.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  await renderizar(comp, salida, resto.filter((a) => !/^--(titulo|proyecto)=/.test(a)), { titulo: op("titulo") || basename(salida), proyecto: op("proyecto") || "clipper" });
}
