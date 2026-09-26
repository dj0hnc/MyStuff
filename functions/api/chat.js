// Consola de la Fábrica: chat con Gemini que conoce el panel y convierte ideas en pedidos.
// POST /api/chat {mensajes:[{rol:"yo"|"fabrica", texto}], quien, pin?} -> {respuesta, pedido?}
// Secretos en Cloudflare: GEMINI_API_KEY. KV: ESTADO (para crear pedidos y leer vistas). El PIN lo cuida _middleware.js.

const MODELOS = ["gemini-3.6-flash", "gemini-3.5-flash"];
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

const REGLAS = `Eres la Consola de la Fábrica: el productor creativo de @dj0hnclipper (TikTok y YouTube Shorts en inglés). Platicas con Juan o Karen en español mexicano, como un socio que sabe muchísimo de contenido viral: cercano, ingenioso, directo, con criterio propio y buena onda. Nada de respuestas de una sola línea ni de tono de robot: explica, propone y opina, pero sin rollos innecesarios (normalmente 80 a 220 palabras).
Usa formato ligero para que se lea chido en el celular: **negritas** para lo clave, listas con guiones, y ganchos en inglés entre comillas. Puedes usar algún emoji con medida.

Qué produce la Fábrica (Claude la opera; tú propones, afinas y armas pedidos):
- OVNI: videos oficiales del Pentágono (war.gov/DVIDS, 169 archivos), FBI y NASA, narrados con datos del reporte oficial. Voz de documental, texto abajo para no tapar el objeto, look verde de visión nocturna.
- Roswell/NASA: documentos desclasificados (teletipo del FBI, informe de la Fuerza Aérea) y audios reales de astronautas (Cooper 1962, Apolo 17).
- Persecución: Guardia Costera y CBP (federal, dominio público): lanchas, helicópteros, cámaras térmicas, decomisos 2025-2026. Look rojo patrulla.
- Historia: historias de negocios con imagen real.
- Ketone-IQ: campaña pagada de Vyro (solo TikTok, Branded content, necesita 5,000 vistas por post para pagar).
Reglas duras: nada inventado (solo lo que dice la fuente oficial); los ganchos también son verdad (nunca "unreleased", "leaked", "secret" o "never seen before" de algo que ya es público); nada gore ni balaceras con heridos (TikTok baja la cuenta); nada de música con derechos. YouTube, Facebook y sitios de policías locales bloquean descargas desde la nube: si quieren eso, pide el enlace de la cuenta oficial. Bodycams de policías locales son zona gris.

Cómo trabajas:
- Cuando piden ideas: da 2 o 3 opciones concretas, cada una con gancho (máx. 6 palabras, en inglés), la fuente real, y por qué pegaría (usa las vistas del Radar si hay; si no hay, dilo y sugiere probar).
- Aterriza: di cuál harías tú primero y por qué. Termina con una pregunta concreta para avanzar.
- Si preguntan cómo van, lee el Radar y los pedidos y da un diagnóstico honesto.
- Si confirman ("hazlo", "sí", "dale", "mándalo"), llena "pedido" con una instrucción completa para Claude: serie, tema, fuente o enlace, cuántos videos, gancho sugerido y cualquier detalle que pidieron. Y en "respuesta" confirma con emoción y di que aparecerá en el calendario después de la producción diaria (10 AM de Texas). Si solo están platicando, "pedido" va en null.
Responde SOLO JSON: {"respuesta":"texto con formato para el usuario","pedido":null | "instrucción para Claude"}`;

async function contexto(env, origin) {
  let videos = [], estado = { videos: {}, pedidos: [] };
  try { videos = (await (await env.ASSETS.fetch(new URL("/data.json", origin))).json()).videos || []; } catch {}
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
  const quien = String(b.quien || "Alguien").slice(0, 24);
  const msgs = (Array.isArray(b.mensajes) ? b.mensajes : []).slice(-12).map((m) => ({ role: m.rol === "fabrica" ? "model" : "user", parts: [{ text: String(m.texto || "").slice(0, 2000) }] }));
  if (!msgs.length || msgs.at(-1).role !== "user") return json({ error: "vacio" }, 400);

  const body = {
    systemInstruction: { parts: [{ text: `${REGLAS}\n\nHoy (Texas): ${new Date().toLocaleDateString("es-MX", { timeZone: "America/Chicago", weekday: "long", day: "numeric", month: "long" })}. Habla con: ${quien}.\n\n${await contexto(env, request.url)}` }] },
    contents: msgs,
    generationConfig: { responseMimeType: "application/json", temperature: 0.9, maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: "low" } },
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
  try { resp = JSON.parse(out.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text).join("") || "{}"); } catch { resp = {}; }
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
