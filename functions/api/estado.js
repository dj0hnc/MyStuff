// Cerebro compartido del Puente de mando (Cloudflare Pages Function + KV).
// GET  /api/estado[?p=rave|karen]  -> estado completo {videos, pedidos, bitacora} de ese proyecto (sin p: clips)
// POST /api/estado  -> {tipo, quien, pin?, ...}:
//   {tipo:"video", id, cambios:{tiktok,youtube,instagram,vyro,vtt,vyt,nota,link,sinHd}}
//   {tipo:"pedido", texto, estado?:"idea"}   (flujo: idea -> nuevo (aprobado, la rutina lo produce) -> produccion -> listo)
//   {tipo:"pedido-editar", pid, texto} · {tipo:"pedido-borrar", pid}
//   {tipo:"ajustes", ajustes:{tripulacion, horarios, porDia, ytMin, redes, cuentas:{tiktok,youtube,instagram}}}  (ajustes del proyecto, compartidos)
//   cambios.links:{tiktok,youtube,instagram} = links de los posts ya publicados (para compartir)
//   {tipo:"pedido-estado", pid, estado:"idea"|"nuevo"|"produccion"|"listo", nota?}  (nota = respuesta de Claude, se ve bajo el pedido)
// Requiere un KV enlazado como ESTADO. El PIN lo cuida functions/_middleware.js.
// ponytail: un solo documento en KV, último que escribe gana; sobra para 2-3 personas. Si crece, pasar a D1.

export const PROYECTOS = ["clipper", "rave", "karen"];
export const clave = (p) => (p && p !== "clipper" && PROYECTOS.includes(p) ? `v1:${p}` : "v1"); // clips se queda en "v1" (la rutina ya lo lee)
const deUrl = (request) => clave(new URL(request.url).searchParams.get("p"));
const LINK = { tiktok: /^https:\/\/([\w-]+\.)*tiktok\.com\//, youtube: /^https:\/\/(([\w-]+\.)*youtube\.com|youtu\.be)\//, instagram: /^https:\/\/([\w-]+\.)*instagram\.com\// };
const HORA = /^(1[0-2]|[1-9]):[0-5]\d (AM|PM)$/, HANDLE = /^[\w.]{1,40}$/;
function limpiarAjustes(a = {}) { // solo lo que el panel entiende, con límites
  const o = {};
  if (Array.isArray(a.tripulacion)) o.tripulacion = a.tripulacion.map((x) => texto(x, 24).trim()).filter(Boolean).slice(0, 8);
  if (Array.isArray(a.horarios)) o.horarios = [...new Set(a.horarios.map((x) => texto(x, 8).trim().toUpperCase()).filter((x) => HORA.test(x)))].slice(0, 12);
  if (a.ytMin != null) o.ytMin = Math.min(240, Math.max(0, Math.floor(Number(a.ytMin) || 0)));
  if (Array.isArray(a.redes)) o.redes = a.redes.filter((x) => x in LINK);
  if (a.cuentas && typeof a.cuentas === "object") o.cuentas = Object.fromEntries(Object.keys(LINK).map((k) => [k, texto(a.cuentas[k], 40).trim().replace(/^@/, "")]).filter(([, v]) => !v || HANDLE.test(v)));
  return o;
}
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
    for (const k of Object.keys(RED)) if (k in c) { v[k] = !!c[k]; v[k + "At"] = c[k] ? ahora : null; if (c[k]) que = `${RED[k]} ${id}`; } // *At: cuándo se publicó (ordena la cola y el historial)
    if ("link" in c) c.links = { ...(c.links || {}), tiktok: c.link }; // compatibilidad: link = el de TikTok
    if (c.links && typeof c.links === "object") for (const [red, re] of Object.entries(LINK)) if (red in c.links) {
      const l = texto(c.links[red], 300).trim(); if (l && !re.test(l)) return json({ error: "link", red }, 400);
      v.links = { ...(v.links || {}), [red]: l }; if (red === "tiktok") v.link = l; if (l) que = `guardó el link de ${red} de ${id}`;
    }
    for (const k of ["vtt", "vyt"]) if (k in c) { const n = Math.max(0, Math.floor(Number(c[k]) || 0)); v[k] = n; que = `anotó ${n.toLocaleString("es-MX")} vistas ${k === "vtt" ? "TikTok" : "YouTube"} en ${id}`; }
    if ("nota" in c) { v.nota = texto(c.nota, 400); que = `dejó nota en ${id}`; }
    if ("sinHd" in c) { v.sinHd = !!c.sinHd; if (c.sinHd) que = `liberó el 1080 de ${id} (queda la vista previa)`; }
    v.por = quien; v.at = ahora;
  } else if (b.tipo === "pedido") {
    const t = texto(b.texto, 500).trim();
    if (!t) return json({ error: "vacio" }, 400);
    const idea = b.estado === "idea";
    e.pedidos.unshift({ id: crypto.randomUUID().slice(0, 8), texto: t, quien, at: ahora, estado: idea ? "idea" : "nuevo" });
    e.pedidos = e.pedidos.slice(0, 200);
    que = `${idea ? "guardó la idea" : "pidió"}: ${t.slice(0, 60)}`;
  } else if (b.tipo === "pedido-estado") {
    const p = e.pedidos.find((x) => x.id === b.pid);
    if (!p || !["idea", "nuevo", "produccion", "listo"].includes(b.estado)) return json({ error: "pedido" }, 400);
    que = p.estado === "idea" && b.estado === "nuevo" ? `aprobó y mandó a producir: ${p.texto.slice(0, 50)}` : `marcó pedido como ${b.estado}`; p.estado = b.estado;
    if (b.nota) { p.nota = texto(b.nota, 1500); que = `respondió: ${p.nota.slice(0, 60)}`; }
  } else if (b.tipo === "pedido-editar" || b.tipo === "pedido-borrar") {
    const i = e.pedidos.findIndex((x) => x.id === b.pid); if (i < 0) return json({ error: "pedido" }, 400);
    if (b.tipo === "pedido-borrar") { que = `borró el pedido: ${e.pedidos[i].texto.slice(0, 50)}`; e.pedidos.splice(i, 1); }
    else { const t = texto(b.texto, 1500).trim(); if (!t) return json({ error: "vacio" }, 400); e.pedidos[i].texto = t; e.pedidos[i].editado = ahora; que = `editó un pedido: ${t.slice(0, 50)}`; }
  } else if (b.tipo === "ajustes") {
    e.ajustes = limpiarAjustes(b.ajustes); que = "cambió los ajustes";
  } else return json({ error: "tipo" }, 400);

  if (que) e.bitacora = [{ quien, que, at: ahora }, ...e.bitacora].slice(0, 150);
  await env.ESTADO.put(k, JSON.stringify(e));
  return json(e);
}
