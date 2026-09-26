// Chat de los paneles: Gemini con el "cerebro" del proyecto (panel/cerebro/comun.md + <proyecto>.md) y su estado vivo.
// POST /api/chat {proyecto:"clipper"|"rave"|"karen", mensajes:[{rol:"yo"|"fabrica", texto}], quien} -> {respuesta, pedido?}
// Secretos en Cloudflare: GEMINI_API_KEY. KV: ESTADO (pedidos por proyecto, ver estado.js). El PIN lo cuida _middleware.js.

import { clave, PROYECTOS } from "./estado.js";

const MODELOS = ["gemini-3.6-flash", "gemini-3.5-flash"];
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

const FORMATO = `Formato: respuestas completas y con personalidad (normalmente 80 a 250 palabras; más si piden un plan), nunca de una sola línea. Usa formato ligero para celular: **negritas** para lo clave, listas con guiones, ganchos entre comillas; algún emoji con medida.
Si confirman una idea ("hazlo", "sí", "dale", "apúntalo", "mándalo"), llena "pedido" con una instrucción completa para Claude y en "respuesta" confírmalo con emoción. Si solo están platicando, "pedido" va en null.
Responde SOLO JSON: {"respuesta":"texto con formato","pedido":null | "instrucción para Claude"}`;

const ESQUEMA = { type: "OBJECT", properties: { respuesta: { type: "STRING" }, pedido: { type: "STRING", nullable: true } }, required: ["respuesta"] };
// Gemini a veces mete saltos de línea crudos dentro del JSON: si no parsea, se rescatan los campos a mano.
function leerJson(t) {
  try { return JSON.parse(t); } catch {}
  const campo = (k) => { const m = new RegExp(`"${k}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`).exec(t); return m ? JSON.parse(`"${m[1].replace(/\n/g, "\\n").replace(/\r/g, "").replace(/\t/g, "\\t")}"`) : null; };
  return { respuesta: campo("respuesta"), pedido: campo("pedido") };
}

const asset = async (env, origin, ruta) => { try { const r = await env.ASSETS.fetch(new URL(ruta, origin)); return r.ok ? await r.text() : ""; } catch { return ""; } };

async function contexto(env, origin, p) {
  let estado = {};
  try { if (env.ESTADO) estado = JSON.parse((await env.ESTADO.get(clave(p))) || "{}"); } catch {}
  const pedidos = (estado.pedidos || []).slice(0, 12).map((x) => `[${x.estado}] ${x.quien}: ${x.texto}`).join("\n") || "ninguno";
  let hechos = "";
  if (p === "clipper") {
    let videos = [];
    try { videos = JSON.parse(await asset(env, origin, "/data.json")).videos || []; } catch {}
    const s = (v) => estado.videos?.[v.id] || {};
    const vistas = (v) => (Number(s(v).vtt) || 0) + (Number(s(v).vyt) || 0);
    hechos = `\n\nVideos en el panel:\n${videos.map((v) => `${v.serie}: ${v.titulo}${s(v).tiktok ? " [subido]" : ""}${vistas(v) ? ` (${vistas(v)} vistas)` : ""}`).join("\n")}`;
  }
  return `${hechos}\n\nPedidos e ideas guardadas en este panel:\n${pedidos}`;
}

export async function onRequestPost({ request, env }) {
  if (!env.GEMINI_API_KEY) return json({ error: "sin_clave", respuesta: "Falta conectar mi cerebro: agrega el secreto GEMINI_API_KEY en Cloudflare." }, 503);
  let b;
  try { b = await request.json(); } catch { return json({ error: "json_invalido" }, 400); }
  const p = PROYECTOS.includes(b.proyecto) ? b.proyecto : "clipper";
  const quien = String(b.quien || "Alguien").slice(0, 24);
  const msgs = (Array.isArray(b.mensajes) ? b.mensajes : []).slice(-16).map((m) => ({ role: m.rol === "fabrica" ? "model" : "user", parts: [{ text: String(m.texto || "").slice(0, 2000) }] }));
  if (!msgs.length || msgs.at(-1).role !== "user") return json({ error: "vacio" }, 400);

  const [comun, propio] = await Promise.all([asset(env, request.url, "/cerebro/comun.md"), asset(env, request.url, `/cerebro/${p}.md`)]);
  const hoy = new Date().toLocaleDateString("es-MX", { timeZone: "America/Chicago", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const body = {
    systemInstruction: { parts: [{ text: `${propio}\n\n${comun}\n\n${FORMATO}\n\nHoy (Texas): ${hoy}. Hablas con: ${quien}.${await contexto(env, request.url, p)}` }] },
    contents: msgs,
    generationConfig: { responseMimeType: "application/json", responseSchema: ESQUEMA, temperature: 0.9, maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: "low" } },
  };
  let out = null, fallo = "";
  for (const m of [...MODELOS, ...MODELOS]) { // segunda vuelta: Gemini da 503 seguido cuando está saturado
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY }, body: JSON.stringify(body) });
    if (r.ok) { out = await r.json(); break; }
    fallo = `${m}: ${r.status} ${(await r.text()).slice(0, 200)}`;
    await new Promise((s) => setTimeout(s, 800));
  }
  if (!out) return json({ respuesta: "Gemini está saturado o sin cuota ahorita. Intenta en un rato, o deja tu idea como pedido directo.", detalle: fallo }, 502);

  let resp;
  try { resp = leerJson(out.candidates?.[0]?.content?.parts?.filter((x) => !x.thought).map((x) => x.text).join("") || "{}"); } catch { resp = {}; }
  const respuesta = String(resp.respuesta || "No entendí, ¿me lo dices de otra forma?").slice(0, 4000);
  const pedido = resp.pedido ? String(resp.pedido).slice(0, 600) : null;

  if (pedido && env.ESTADO) {
    const e = JSON.parse((await env.ESTADO.get(clave(p))) || "{}");
    const ahora = new Date().toISOString();
    e.pedidos = [{ id: crypto.randomUUID().slice(0, 8), texto: pedido, quien, at: ahora, estado: "nuevo" }, ...(e.pedidos || [])].slice(0, 200);
    e.bitacora = [{ quien, que: `pidió (vía chat): ${pedido.slice(0, 60)}`, at: ahora }, ...(e.bitacora || [])].slice(0, 150);
    await env.ESTADO.put(clave(p), JSON.stringify(e));
  }
  return json({ respuesta, pedido });
}
