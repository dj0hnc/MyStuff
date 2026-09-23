// Utilidades para la API de Gemini (Google AI Studio).
export const geminiKey = () => {
  const k = process.env.GEMINI_API_KEY;
  if (!k) {
    console.error("Falta GEMINI_API_KEY en .env. Consíguela gratis en https://aistudio.google.com/apikey");
    process.exit(1);
  }
  return k;
};

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const RESPALDO = { "gemini-3.6-flash": "gemini-3.5-flash", "gemini-3.5-flash": "gemini-3.6-flash" };

// Reintenta ante 503/429 transitorios y, si sigue fallando, prueba un modelo hermano.
export const generateContent = async (model, body, intento = 0) => {
  // Una variable vacía en .env (GEMINI_TEXT_MODEL=) no debe dejar el modelo en blanco.
  model ||= "gemini-3.6-flash";
  try {
    return await generateContentUnaVez(model, body);
  } catch (e) {
    const transitorio = /503|high demand|overloaded|temporar|UNAVAILABLE|500/i.test(e.message) && !/quota/i.test(e.message);
    if (transitorio && intento < 3) {
      await espera(2000 * (intento + 1));
      return generateContent(model, body, intento + 1);
    }
    if (transitorio && RESPALDO[model] && intento < 5) {
      console.warn(`${model} saturado, probando ${RESPALDO[model]}...`);
      return generateContent(RESPALDO[model], body, 5); // un solo intento con el hermano, sin ping-pong
    }
    throw e;
  }
};

const generateContentUnaVez = async (model, body) => {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey()}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  // Una respuesta vacía o cortada (proxy, timeout) se trata como error transitorio.
  let json;
  try {
    json = JSON.parse(await res.text());
  } catch {
    throw new Error(`Gemini respondió ${res.status} sin JSON válido${res.status >= 500 ? " (temporal)" : ""}`);
  }
  if (!res.ok) {
    const msg = json.error?.message ?? JSON.stringify(json);
    if (res.status === 429 && /quota/i.test(msg)) {
      throw new Error(
        `Gemini sin cuota para ${model}. El nivel gratis no incluye este modelo: activa facturación en https://aistudio.google.com/ (o usa los créditos gratis de Google Cloud).`,
      );
    }
    throw new Error(`Gemini respondió ${res.status}: ${msg}`);
  }
  return json;
};

export const textoDe = (json) =>
  (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");

export const imagenDe = (json) => (json.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData);

// Sube un archivo (video, audio) a la File API de Gemini y espera a que esté listo.
// Devuelve { uri, borrar }. Gemini lo borra solo a las 48 h, pero mejor limpiar.
export const subirArchivo = async (ruta, mime = "video/mp4") => {
  const { readFile, stat } = await import("node:fs/promises");
  const key = geminiKey();
  const base = "https://generativelanguage.googleapis.com";
  const { size } = await stat(ruta);
  console.log(`Subiendo ${ruta} a Gemini (${(size / 1e6).toFixed(1)} MB)...`);
  const start = await fetch(`${base}/upload/v1beta/files?key=${key}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(size),
      "X-Goog-Upload-Header-Content-Type": mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: ruta.split("/").pop() } }),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error(`No se pudo iniciar la subida: ${start.status} ${await start.text()}`);
  const up = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Length": String(size), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
    body: await readFile(ruta),
  });
  const { file } = await up.json();
  process.stdout.write("Procesando");
  for (let i = 0; i < 100; i++) {
    const st = await (await fetch(`${base}/v1beta/${file.name}?key=${key}`)).json();
    if (st.state === "ACTIVE") break;
    if (st.state === "FAILED") throw new Error("Gemini no pudo procesar el archivo");
    process.stdout.write(".");
    await espera(3000);
  }
  console.log();
  return { uri: file.uri, borrar: () => fetch(`${base}/v1beta/${file.name}?key=${key}`, { method: "DELETE" }).catch(() => {}) };
};
