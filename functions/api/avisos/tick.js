// Revisa la cola de clips y manda los avisos de publicar. Lo llama el Worker "puente-avisos" cada 5 min (cron),
// con la llave que vive en KV "avisos-token" (el middleware la revisa). Mismo cálculo que el panel (panel/agenda.mjs).
//   ⏰ 15 min antes · 🚀 a la hora · ⚠️ si ya va 30 min tarde. Cada aviso sale una sola vez (KV "avisados").
import { calcularAgenda, aMin } from "../../../panel/agenda.mjs";
import { USUARIOS } from "../../_middleware.js";
import { enviar } from "../../../lib/push.js";

const HORARIOS = ["12:00 PM", "3:00 PM", "6:00 PM", "9:30 PM"];
const texas = () => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()).map((x) => [x.type, x.value])); return { fecha: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute }; };
const diaTx = (iso) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date(iso)) : "");
const masMin = (h, n) => { const m = (aMin(h) + n) % 1440; return `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, "0")} ${m < 720 ? "AM" : "PM"}`; };

// La agenda de clips tal como la ve el panel: pendientes en orden, horarios de ajustes, publicados hoy y horarios "pasados".
export async function agendaClips(env, origin) {
  const data = await (await env.ASSETS.fetch(new URL("/data.json", origin))).json();
  const e = JSON.parse((await env.ESTADO.get("v1")) || "{}"), sv = (v) => e.videos?.[v.id] || {}, val = (v, k) => (k in sv(v) ? sv(v)[k] : v[k]);
  const a = e.ajustes || {}, slots = (a.horarios?.length ? a.horarios : HORARIOS).map((h) => [h, masMin(h, a.ytMin ?? 30)]), t = texas();
  const cola = data.videos.map((v, i) => ({ v, k: (v.fecha || "9999") + String(v.orden || 0).padStart(3, "0") + String(i).padStart(3, "0") }))
    .filter(({ v }) => v.serie !== "ketone" && !val(v, "tiktok")).sort((x, y) => x.k.localeCompare(y.k)).map((x) => x.v);
  const pubHoy = data.videos.filter((v) => v.serie !== "ketone" && val(v, "tiktok") && diaTx(val(v, "tiktokAt")) === t.fecha).length;
  const omitidos = (e.omitidos || []).filter((x) => x.fecha === t.fecha).map((x) => x.hora);
  const ag = calcularAgenda(cola, pubHoy, slots, t, omitidos);
  return { t, ag, titulos: Object.fromEntries(cola.map((v) => [v.id, v.titulo])) };
}

export async function onRequest({ request, env }) {
  const { t, ag, titulos } = await agendaClips(env, request.url), sig = ag[0];
  if (!sig || sig.fecha !== t.fecha) return new Response(JSON.stringify({ nada: true }), { headers: { "content-type": "application/json" } });
  const falta = aMin(sig.hora) - t.min, titulo = titulos[sig.id];
  const aviso = sig.tarde >= 30 ? { k: "tarde", titulo: `⚠️ Vas tarde con un video`, cuerpo: `"${titulo}" tocaba a las ${sig.hora}. Publícalo ya o pásalo al siguiente horario: no se pierde.` }
    : !sig.tarde && falta <= 0 && falta > -20 ? { k: "ya", titulo: "🚀 Ya toca publicar", cuerpo: `"${titulo}" · ${sig.hora}. Toca para abrirlo.` }
    : !sig.tarde && falta > 0 && falta <= 15 ? { k: "15", titulo: `⏰ En ${falta} min toca publicar`, cuerpo: `"${titulo}" a las ${sig.hora}. Tenlo listo.` } : null;
  if (!aviso) return new Response(JSON.stringify({ nada: true, sig }), { headers: { "content-type": "application/json" } });
  const llave = `${sig.id}|${sig.fecha}|${sig.hora}|${aviso.k}`, avisados = (await env.ESTADO.get("avisados", "json")) || [];
  if (avisados.includes(llave)) return new Response(JSON.stringify({ yaAvisado: llave }), { headers: { "content-type": "application/json" } });
  await env.ESTADO.put("avisados", JSON.stringify([llave, ...avisados].slice(0, 200)));
  let enviados = 0;
  for (const u of Object.keys(USUARIOS)) enviados += await enviar(env, u, { titulo: aviso.titulo, cuerpo: aviso.cuerpo, url: "/clipper#mision", tag: "publicar" }, "horarios");
  return new Response(JSON.stringify({ aviso: llave, enviados }), { headers: { "content-type": "application/json" } });
}
