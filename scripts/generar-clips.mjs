// Genera VARIOS clips cortos con IA y los deja listos para que el video los
// vaya pegando (fondoClips: true). Prueba proveedores gratis en orden y, si
// uno falla o se queda sin cuota, pasa al siguiente.
//
// Uso:  npm run clips -- --auto 5                 -> Gemini inventa 5 escenas a partir del guion
//       npm run clips -- "zorro corriendo" "ciudad de noche" "reloj girando"
// Crea: public/clips/01.mp4 ...  y  public/clips.json
//
// Proveedores (todos con clave en .env):
//   pixazo       PIXAZO_API_KEY       LTX 2.5 gratis en preview, sin tarjeta.  https://api-console.pixazo.ai/api_keys
//   freeai       FREEAI_API_KEY       30,000 tokens/día (unos 2-3 clips).       https://free.ai/signup/
//   pollinations POLLINATIONS_API_KEY Muchos modelos (Wan, Seedance, Grok, Veo) por "pollen". https://enter.pollinations.ai
//   fal          FAL_KEY              Prepago.                                 https://fal.ai
// Fuerza uno con CLIPS_PROVEEDOR=pixazo|freeai|pollinations|fal. Duración por clip: CLIPS_SEGUNDOS (5).

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const autoIdx = args.indexOf("--auto");
const segundos = Number(process.env.CLIPS_SEGUNDOS ?? 5);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const ffprobe = () => {
  const require = createRequire(import.meta.url);
  return join(dirname(require.resolve("@remotion/compositor-linux-x64-gnu/package.json")), "ffprobe");
};
const duracionDe = (f) => {
  try {
    return Number(execFileSync(ffprobe(), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());
  } catch {
    return segundos;
  }
};
const guardar = async (url, destino) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`descarga falló ${r.status}`);
  await writeFile(destino, Buffer.from(await r.arrayBuffer()));
};

// ---------- prompts ----------
let prompts;
if (autoIdx >= 0) {
  const n = Number(args[autoIdx + 1] ?? 5);
  const { generateContent, textoDe } = await import("./gemini.mjs");
  const g = JSON.parse(await readFile("public/guion.json", "utf8"));
  console.log(`Pidiendo a Gemini ${n} escenas para el guion "${g.hook}"...`);
  const out = await generateContent(process.env.GEMINI_TEXT_MODEL ?? "gemini-3.6-flash", {
    contents: [
      {
        parts: [
          {
            text: `Guion de un video vertical:\n${g.frases.join("\n")}\n\nEscribe ${n} prompts en inglés para generar clips de video de fondo (b-roll) de ${segundos} segundos que ilustren el guion en orden. Reglas: una sola escena por prompt, cinematográfico, vertical 9:16, sin texto ni letras en pantalla, sin logos, personas genéricas, iluminación y cámara descritas, máximo 40 palabras cada uno. Responde SOLO JSON: {"prompts":["...","..."]}`,
          },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
  });
  prompts = JSON.parse(textoDe(out)).prompts.slice(0, n);
} else {
  prompts = args.filter((a) => !a.startsWith("--"));
}
if (!prompts?.length) {
  console.error('Uso: npm run clips -- --auto 5   |   npm run clips -- "escena 1" "escena 2"');
  process.exit(1);
}

// ---------- proveedores ----------
const pixazo = async (prompt, destino) => {
  const key = process.env.PIXAZO_API_KEY;
  if (!key) throw new Error("sin PIXAZO_API_KEY");
  const h = { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/json" };
  const model = process.env.PIXAZO_MODEL ?? "ltx-video"; // gratis; "ltx-2-5-pro" de pago
  const r = await fetch(`https://gateway.pixazo.ai/${model}/v1/text-to-video`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ prompt, aspect_ratio: "9:16", resolution: "720p", duration: Math.min(10, Math.max(6, segundos)) }),
  });
  if (!r.ok) throw new Error(`pixazo ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j = await r.json();
  let url = j.output?.media_url?.[0];
  if (!url) {
    const poll = j.polling_url ?? `https://gateway.pixazo.ai/v2/requests/status/${j.request_id}`;
    for (let i = 0; i < 90; i++) {
      await espera(5000);
      const s = await (await fetch(poll, { headers: h })).json();
      if (s.status === "COMPLETED") {
        url = s.output?.media_url?.[0];
        break;
      }
      if (s.status === "ERROR" || s.status === "FAILED") throw new Error(`pixazo falló: ${JSON.stringify(s).slice(0, 160)}`);
    }
  }
  if (!url) throw new Error("pixazo: sin video tras esperar");
  await guardar(url, destino);
};

const freeai = async (prompt, destino) => {
  const key = process.env.FREEAI_API_KEY;
  if (!key) throw new Error("sin FREEAI_API_KEY");
  const h = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const r = await fetch("https://api.free.ai/v1/video/generate/", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ prompt, duration: Math.min(6, segundos), aspect_ratio: "9:16" }),
  });
  if (!r.ok) throw new Error(`free.ai ${r.status}: ${(await r.text()).slice(0, 160)}`);
  let j = await r.json();
  const jobId = j.job_id ?? j.id;
  for (let i = 0; !j.video_url && jobId && i < 90; i++) {
    await espera(5000);
    j = await (await fetch(`https://api.free.ai/v1/status/${jobId}/`, { headers: h })).json();
    if (/fail|error/i.test(j.status ?? "")) throw new Error(`free.ai falló: ${JSON.stringify(j).slice(0, 160)}`);
  }
  if (!j.video_url) throw new Error("free.ai: sin video_url");
  await guardar(j.video_url, destino);
};

const pollinations = async (prompt, destino) => {
  const key = process.env.POLLINATIONS_API_KEY;
  if (!key) throw new Error("sin POLLINATIONS_API_KEY");
  const model = process.env.POLLINATIONS_VIDEO_MODEL ?? "alibaba/wan-2.2-fast"; // el más barato: 0.01 pollen/seg
  const url = `https://gen.pollinations.ai/video/${encodeURIComponent(prompt)}?model=${encodeURIComponent(model)}&duration=${segundos}&aspectRatio=9:16`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`pollinations ${r.status}: ${(await r.text()).slice(0, 160)}`);
  await writeFile(destino, Buffer.from(await r.arrayBuffer()));
};

const fal = async (prompt, destino) => {
  const { falQueue, descargar } = await import("./fal.mjs");
  const model = process.env.FAL_VIDEO_MODEL ?? "fal-ai/wan/v2.2-5b/text-to-video";
  const out = await falQueue(model, { prompt, aspect_ratio: "9:16", duration: String(segundos) });
  const url = out.video?.url ?? out.videos?.[0]?.url;
  if (!url) throw new Error("fal: sin video");
  await descargar(url, destino);
};

const PROVEEDORES = { pixazo, freeai, pollinations, fal };
const forzado = process.env.CLIPS_PROVEEDOR;
const orden = forzado
  ? [forzado]
  : [
      process.env.PIXAZO_API_KEY && "pixazo",
      process.env.FREEAI_API_KEY && "freeai",
      process.env.POLLINATIONS_API_KEY && "pollinations",
      process.env.FAL_KEY && "fal",
    ].filter(Boolean);
if (orden.length === 0) {
  console.error("No hay ninguna clave de video en .env (PIXAZO_API_KEY, FREEAI_API_KEY, POLLINATIONS_API_KEY o FAL_KEY).");
  process.exit(1);
}

// ---------- generar ----------
await mkdir("public/clips", { recursive: true });
const clips = [];
for (let i = 0; i < prompts.length; i++) {
  const destino = `public/clips/${String(i + 1).padStart(2, "0")}.mp4`;
  console.log(`\n[${i + 1}/${prompts.length}] ${prompts[i]}`);
  let ok = false;
  for (const nombre of orden) {
    try {
      process.stdout.write(`  ${nombre}... `);
      await PROVEEDORES[nombre](prompts[i], destino);
      const d = duracionDe(destino);
      clips.push({ prompt: prompts[i], archivo: destino.replace("public/", ""), duracion: d, proveedor: nombre });
      console.log(`ok (${d.toFixed(1)} s)`);
      ok = true;
      break;
    } catch (e) {
      console.log(`no: ${e.message.split("\n")[0]}`);
    }
  }
  if (!ok) console.warn("  ningún proveedor pudo con esta escena, se salta.");
}

await writeFile("public/clips.json", JSON.stringify({ fuente: "ia", clips }, null, 2));
console.log(`\nListo: ${clips.length}/${prompts.length} clips en public/clips/. Renderiza con: npm run video -- out/video.mp4 '{"fondoClips":true}'`);
