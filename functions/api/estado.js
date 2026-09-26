// Cerebro compartido del Puente de mando (Cloudflare Pages Function + KV).
// GET  /api/estado[?p=rave|karen]  -> estado completo {videos, pedidos, bitacora} de ese proyecto (sin p: clips)
// POST /api/estado  -> {tipo, quien, pin?, ...}:
//   {tipo:"video", id, cambios:{tiktok,youtube,instagram,vyro,vtt,vyt,nota}}
//   {tipo:"pedido", texto}
//   {tipo:"pedido-estado", pid, estado:"nuevo"|"produccion"|"listo", nota?}  (nota = respuesta de Claude, se ve bajo el pedido)
// Requiere un KV enlazado como ESTADO. El PIN lo cuida functions/_middleware.js.
// ponytail: un solo documento en KV, último que escribe gana; sobra para 2-3 personas. Si crece, pasar a D1.

export const PROYECTOS = ["clipper", "rave", "karen"];
export const clave = (p) => (p && p !== "clipper" && PROYECTOS.includes(p) ? `v1:${p}` : "v1"); // clips se queda en "v1" (la rutina ya lo lee)
const deUrl = (request) => clave(new URL(request.url).searchParams.get("p"));
const vacio = () => ({ videos: {}, pedidos: [], bitacora: [] });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const texto = (x, max) => String(x ?? "").slice(0, max);

async function leer(env, k) {
  try { return { ...vacio(), ...(JSON.parse((await env.ESTADO.get(k)) || "{}")) }; } catch { return vacio(); }
}

export async function onRequestGet({ request, env }) {
  if (!env.ESTADO) return json({ error: "sin_kv" }, 503);
  return json(await leer(env, deUrl(request)));
}

export async function onRequestPost({ request, env }) {
  if (!env.ESTADO) return json({ error: "sin_kv" }, 503);
  let b;
  try { b = await request.json(); } catch { return json({ error: "json_invalido" }, 400); }
  const quien = texto(b.quien, 24) || "Alguien";
  const ahora = new Date().toISOString();
  const k = deUrl(request), e = await leer(env, k);
  let que = "";

  if (b.tipo === "video") {
    const id = texto(b.id, 80);
    if (!/^[\w-]+$/.test(id)) return json({ error: "id" }, 400);
    const c = b.cambios || {}, v = (e.videos[id] ||= {});
    const RED = { tiktok: "subió a TikTok", youtube: "subió a YouTube", instagram: "subió a Instagram", vyro: "registró en Vyro" };
    for (const k of Object.keys(RED)) if (k in c) { v[k] = !!c[k]; if (c[k]) que = `${RED[k]} ${id}`; }
    for (const k of ["vtt", "vyt"]) if (k in c) { const n = Math.max(0, Math.floor(Number(c[k]) || 0)); v[k] = n; que = `anotó ${n.toLocaleString("es-MX")} vistas ${k === "vtt" ? "TikTok" : "YouTube"} en ${id}`; }
    if ("nota" in c) { v.nota = texto(c.nota, 400); que = `dejó nota en ${id}`; }
    v.por = quien; v.at = ahora;
  } else if (b.tipo === "pedido") {
    const t = texto(b.texto, 500).trim();
    if (!t) return json({ error: "vacio" }, 400);
    e.pedidos.unshift({ id: crypto.randomUUID().slice(0, 8), texto: t, quien, at: ahora, estado: "nuevo" });
    e.pedidos = e.pedidos.slice(0, 200);
    que = `pidió: ${t.slice(0, 60)}`;
  } else if (b.tipo === "pedido-estado") {
    const p = e.pedidos.find((x) => x.id === b.pid);
    if (!p || !["nuevo", "produccion", "listo"].includes(b.estado)) return json({ error: "pedido" }, 400);
    p.estado = b.estado; que = `marcó pedido como ${b.estado}`;
    if (b.nota) { p.nota = texto(b.nota, 1500); que = `respondió: ${p.nota.slice(0, 60)}`; }
  } else return json({ error: "tipo" }, 400);

  if (que) e.bitacora = [{ quien, que, at: ahora }, ...e.bitacora].slice(0, 150);
  await env.ESTADO.put(k, JSON.stringify(e));
  return json(e);
}
