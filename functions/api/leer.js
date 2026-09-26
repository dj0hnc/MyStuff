// GET /api/leer?url=...  -> lo que se ve en un link de YouTube/TikTok/Instagram/Facebook (texto, números y análisis del video).
// POST /api/leer (cuerpo = el video, header x-nombre) -> {analisis} de un video mandado desde el cel (📎 en el chat).
// Lo usa el chat por dentro; sirve también para probar un link a mano. El PIN lo cuida _middleware.js.
import { leerLink, verArchivo } from "../../lib/leer.js";
export async function onRequestGet({ request, env }) {
  let u; try { u = new URL(new URL(request.url).searchParams.get("url")); } catch { return new Response(JSON.stringify({ error: "url" }), { status: 400 }); }
  if (!/^https?:$/.test(u.protocol)) return new Response(JSON.stringify({ error: "url" }), { status: 400 });
  return new Response(JSON.stringify(await leerLink(u.toString(), env)), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

export async function onRequestPost({ request, env }) {
  const mime = (request.headers.get("content-type") || "").split(";")[0];
  if (!/^video\//.test(mime)) return new Response(JSON.stringify({ error: "video" }), { status: 400 });
  const r = await verArchivo(env, await request.arrayBuffer(), mime, decodeURIComponent(request.headers.get("x-nombre") || "video"));
  return new Response(JSON.stringify(r), { headers: { "content-type": "application/json; charset=utf-8" } });
}
