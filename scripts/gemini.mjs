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
      return generateContent(RESPALDO[model], body, 4);
    }
    throw e;
  }
};

const generateContentUnaVez = async (model, body) => {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey()}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  const json = await res.json();
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
