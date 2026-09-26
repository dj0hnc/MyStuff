// Chequeo rápido de la API del panel (sin red ni Cloudflare): ajustes, links de posts y links de crudos. npm run check-panel
import { onRequestPost } from "../functions/api/estado.js";
import { onRequest as crudos } from "../functions/api/crudos/[[ruta]].js";
const kv = new Map(), env = { ESTADO: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => kv.set(k, v) } };
const post = async (url, body) => (await onRequestPost({ request: new Request(url, { method: "POST", body: JSON.stringify(body) }), env }));
let fallas = 0; const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fallas++; };
// ajustes: limpia basura y respeta límites
let r = await (await post("https://x/api/estado", { tipo: "ajustes", quien: "Juan", ajustes: { tripulacion: ["Juan", " Karen ", ""], horarios: ["3:00 pm", "25:00 PM", "9:30 PM", "3:00 PM"], ytMin: 999, redes: ["tiktok", "myspace"], cuentas: { instagram: "@karen.r", tiktok: "mal espacio" }, hack: 1 } })).json();
ok(JSON.stringify(r.ajustes) === JSON.stringify({ tripulacion: ["Juan", "Karen"], horarios: ["3:00 PM", "9:30 PM"], ytMin: 240, redes: ["tiktok"], cuentas: { youtube: "", instagram: "karen.r" } }), "ajustes limpios: " + JSON.stringify(r.ajustes));
// links por red, con validación de dominio
r = await (await post("https://x/api/estado", { tipo: "video", id: "ovni-1", quien: "Juan", cambios: { tiktok: true, links: { tiktok: "https://www.tiktok.com/@a/video/1", youtube: "https://youtube.com/shorts/x" } } })).json();
ok(r.videos["ovni-1"].links.youtube === "https://youtube.com/shorts/x" && r.videos["ovni-1"].link && r.videos["ovni-1"].tiktokAt, "links guardados + tiktokAt");
const malo = await post("https://x/api/estado", { tipo: "video", id: "ovni-1", quien: "Juan", cambios: { links: { instagram: "https://evil.com/x" } } });
ok(malo.status === 400, "link de otro dominio rechazado");
// pegar link de crudo sin R2: crea pedido con link directo
const cr = await crudos({ request: new Request("https://x/api/crudos/enlace", { method: "POST", body: JSON.stringify({ p: "karen", url: "https://www.dropbox.com/s/abc/video.mov?dl=0", nota: "15 s", quien: "Karen" }) }), env, params: { ruta: ["enlace"] } });
const cj = await cr.json(), ped = JSON.parse(kv.get("v1:karen")).pedidos[0];
ok(cr.status === 200 && cj.bajar.includes("dl=1") && ped.enlace && ped.texto.includes("dl=1"), "link Dropbox → pedido con dl=1");
const gd = await (await crudos({ request: new Request("https://x/api/crudos/enlace", { method: "POST", body: JSON.stringify({ p: "rave", url: "https://drive.google.com/file/d/1AbC_x-9/view?usp=sharing" }) }), env, params: { ruta: ["enlace"] } })).json();
ok(gd.bajar.startsWith("https://drive.usercontent.google.com/download?id=1AbC_x-9"), "link Drive → descarga directa");
const sinR2 = await crudos({ request: new Request("https://x/api/crudos?p=karen"), env, params: {} });
ok(sinR2.status === 503, "subir archivo sin R2 → 503 sin_r2");
process.exit(fallas ? 1 : 0);
