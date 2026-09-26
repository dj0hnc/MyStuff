// Chequeo rápido de la API del panel (sin red ni Cloudflare): ajustes, links de posts y links de crudos. npm run check-panel
import { onRequestPost } from "../functions/api/estado.js";
import { onRequest as crudos } from "../functions/api/crudos/[[ruta]].js";
import { onRequest as puerta } from "../functions/_middleware.js";
import { onRequestGet as yoGet, onRequestPost as yoPost } from "../functions/api/yo.js";
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
// entradas personales: PIN general, cookie con quién es, PIN propio, rutina con x-pin
const envP = { ...env, PIN: "918514" }, siguiente = async () => new Response("ok");
const entrar = (usuario, pin) => puerta({ request: new Request("https://x/__entrar", { method: "POST", body: new URLSearchParams({ usuario, pin }) }), env: envP, next: siguiente, data: {} });
let e1 = await entrar("juan", "918514"); const galleta = (e1.headers.get("set-cookie") || "").split(";")[0];
ok(e1.status === 302 && galleta.startsWith("puente=juan."), "Juan entra con el PIN general");
const data = {}; const pag = await puerta({ request: new Request("https://x/", { headers: { cookie: galleta } }), env: envP, next: siguiente, data });
ok(pag.status === 200 && data.usuario === "juan", "la cookie dice que es Juan");
ok((await (await yoGet({ env: envP, data })).json()).nombre === "Juan", "/api/yo responde Juan");
ok((await yoPost({ request: new Request("https://x", { method: "POST", body: JSON.stringify({ actual: "918514", nuevo: "4321" }) }), env: envP, data })).status === 200, "Juan cambia su PIN");
ok((await entrar("juan", "918514")).status === 401 && (await entrar("juan", "4321")).status === 302, "PIN viejo ya no sirve a Juan; el nuevo sí");
ok((await entrar("karen", "918514")).status === 302, "Karen sigue con el general");
const falsa = await puerta({ request: new Request("https://x/", { headers: { cookie: "puente=juan." + "0".repeat(64) } }), env: envP, next: siguiente, data: {} });
ok(falsa.status === 401, "cookie falsificada rechazada");
ok((await puerta({ request: new Request("https://x/api/estado", { headers: { "x-pin": "918514" } }), env: envP, next: siguiente, data: {} })).status === 200, "la rutina entra con x-pin");
const xss = await (await entrar("<script>alert(1)</script>", "1")).text();
ok(!xss.includes("alert(1)"), "nombre inventado no se refleja en la página");
process.exit(fallas ? 1 : 0);
