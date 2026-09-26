// Consola de la Fábrica: chat con Gemini que conoce el panel y convierte ideas en pedidos.
// POST /api/chat {mensajes:[{rol:"yo"|"fabrica", texto}], quien, pin?} -> {respuesta, pedido?}
// Secretos en Cloudflare: GEMINI_API_KEY (obligatorio), PIN (opcional). KV: ESTADO (para crear pedidos y leer vistas).

const MODELOS = ["gemini-3.6-flash", "gemini-3.5-flash"];
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

const REGLAS = `Eres la Consola de la Fábrica de @dj0hnclipper (TikTok y YouTube Shorts en inglés). Hablas con JOHNC o Karen en español mexicano, directo, corto y con buena onda.
Qué produce la Fábrica (Claude la opera; tú propones y armas pedidos):
- OVNI: videos oficiales del Pentágono (war.gov/DVIDS, 169 archivos), FBI y NASA, narrados con datos del reporte oficial. Texto abajo para no tapar el objeto.
- Roswell/NASA: documentos desclasificados y audios reales de astronautas.
- Persecución: Guardia Costera y CBP (federal, dominio público): lanchas, helicópteros, decomisos 2025-2026.
- Historia: historias de negocios con imagen real.
- Ketone-IQ: campaña pagada de Vyro (solo TikTok, Branded content).
Reglas: nada inventado (solo lo que dice la fuente oficial); los ganchos también son verdad: nunca digas unreleased, leaked, secreto o nunca antes visto de algo que ya es público; nada gore ni balaceras con heridos, nada de música con derechos. YouTube, Facebook y sitios de policías locales bloquean descargas desde la nube: si quieren eso, pide que peguen el enlace de la cuenta oficial. Bodycams locales son zona gris.
Cómo respondes: ayuda con ideas concretas (gancho de 6 palabras máximo, fuente, por qué pegaría según el Radar). Si el usuario confirma que lo quiere ("hazlo", "sí", "mándalo"), llena "pedido" con una instrucción clara para Claude (serie, tema, fuente o enlace, cuántos videos). Si solo están platicando, deja "pedido" en null.
Responde SOLO JSON: {"respuesta":"texto para el usuario","pedido":null | "instrucción para Claude"}`;

async function contexto(env, origin) {
  let videos = [], estado = { videos: {}, pedidos: [] };
  try { videos = (await (await fetch(new URL("/data.json", origin))).json()).videos || []; } catch {}
  try { if (env.ESTADO) estado = JSON.parse((await env.ESTADO.get("v1")) || "{}"); } catch {}
  const vistas = (v) => { const s = estado.videos?.[v.id] || {}; return (Number(s.vtt) || 0) + (Number(s.vyt) || 0); };
  const hechos = videos.map((v) => `${v.serie}: ${v.titulo}${vistas(v) ? ` (${vistas(v)} vistas)` : ""}`).join("\n");
  const pedidos = (estado.pedidos || []).slice(0, 10).map((p) => `[${p.estado}] ${p.texto}`).join("\n") || "ninguno";
  return `Videos que ya existen:\n${hechos}\n\nPedidos recientes:\n${pedidos}`;
}

export async function onRequestPost({ request, env }) {
  if (!env.GEMINI_API_KEY) return json({ error: "sin_clave", respuesta: "Falta conectar mi cerebro: agrega el secreto GEMINI_API_KEY en Cloudflare (ver Guía)." }, 503);
  let b;
  try { b = await request.json(); } catch { return json({ error: "json_invalido" }, 400); }
  if (env.PIN && String(b.pin || "") !== String(env.PIN)) return json({ error: "pin" }, 401);
  const quien = String(b.quien || "Alguien").slice(0, 24);
  const msgs = (Array.isArray(b.mensajes) ? b.mensajes : []).slice(-12).map((m) => ({ role: m.rol === "fabrica" ? "model" : "user", parts: [{ text: String(m.texto || "").slice(0, 2000) }] }));
  if (!msgs.length || msgs.at(-1).role !== "user") return json({ error: "vacio" }, 400);

  const body = {
    systemInstruction: { parts: [{ text: `${REGLAS}\n\nHabla con: ${quien}.\n\n${await contexto(env, request.url)}` }] },
    contents: msgs,
    generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
  };
  let out = null;
  for (const m of MODELOS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY }, body: JSON.stringify(body) });
    if (r.ok) { out = await r.json(); break; }
  }
  if (!out) return json({ respuesta: "Gemini está saturado o sin cuota ahorita. Intenta en un rato, o deja tu idea como pedido directo." }, 502);

  let resp;
  try { resp = JSON.parse(out.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "{}"); } catch { resp = {}; }
  const respuesta = String(resp.respuesta || "No entendí, ¿me lo dices de otra forma?").slice(0, 3000);
  const pedido = resp.pedido ? String(resp.pedido).slice(0, 500) : null;

  if (pedido && env.ESTADO) {
    const e = JSON.parse((await env.ESTADO.get("v1")) || "{}");
    const ahora = new Date().toISOString();
    e.pedidos = [{ id: crypto.randomUUID().slice(0, 8), texto: pedido, quien, at: ahora, estado: "nuevo" }, ...(e.pedidos || [])].slice(0, 200);
    e.bitacora = [{ quien, que: `pidió (vía consola): ${pedido.slice(0, 60)}`, at: ahora }, ...(e.bitacora || [])].slice(0, 150);
    await env.ESTADO.put("v1", JSON.stringify(e));
  }
  return json({ respuesta, pedido });
}
