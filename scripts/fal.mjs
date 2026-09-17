// Utilidades compartidas para hablar con fal.ai (imágenes y video con IA).
import { writeFile, readFile } from "node:fs/promises";

export const falKey = () => {
  const k = process.env.FAL_KEY;
  if (!k) {
    console.error("Falta FAL_KEY en .env. Consíguela en https://fal.ai/dashboard/keys y carga saldo en Billing.");
    process.exit(1);
  }
  return k;
};

const explicar = async (res) => {
  const txt = await res.text();
  if (res.status === 403 && txt.includes("TOP_UP")) {
    return "La cuenta de fal.ai no tiene saldo. Entra a https://fal.ai/dashboard/billing y agrega crédito.";
  }
  if (res.status === 401) return "Clave inválida. Revisa FAL_KEY en .env.";
  return `fal.ai respondió ${res.status}: ${txt}`;
};

// Llamada directa (síncrona). Para imágenes, que tardan segundos.
export const falRun = async (model, input) => {
  const res = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${falKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await explicar(res));
  return res.json();
};

// Cola con espera. Para video, que tarda minutos.
export const falQueue = async (model, input, onStatus = () => {}) => {
  const headers = { Authorization: `Key ${falKey()}`, "Content-Type": "application/json" };
  const start = await fetch(`https://queue.fal.run/${model}`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!start.ok) throw new Error(await explicar(start));
  const { status_url, response_url } = await start.json();

  for (;;) {
    await new Promise((r) => setTimeout(r, 4000));
    const st = await fetch(`${status_url}?logs=1`, { headers });
    if (!st.ok) throw new Error(await explicar(st));
    const s = await st.json();
    onStatus(s);
    if (s.status === "COMPLETED") break;
    if (s.status === "FAILED") throw new Error(`Generación fallida: ${JSON.stringify(s)}`);
  }
  const out = await fetch(response_url, { headers });
  if (!out.ok) throw new Error(await explicar(out));
  return out.json();
};

export const descargar = async (url, destino) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No pude descargar ${url}: ${r.status}`);
  await writeFile(destino, Buffer.from(await r.arrayBuffer()));
};

// Convierte un archivo local a data URI para pasarlo como image_url.
export const comoDataUri = async (ruta) => {
  const buf = await readFile(ruta);
  const ext = ruta.split(".").pop().toLowerCase();
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
};
