// Leer links de YouTube, TikTok, Instagram y Facebook (y cualquier página) para que el chat los "vea".
// Solo usa las vías públicas de cada plataforma, sin servicios de terceros:
//   YouTube: oEmbed + Gemini ve el video directo por su URL (no hay que bajarlo).
//   TikTok: la página pública trae el texto, los números y la dirección del video (se baja con sus mismas cookies).
//   Instagram: el embed público del post trae el texto y el video.   Facebook: el reproductor público trae el video.
// Luego Gemini mira el video (≤ 18 MB en línea) y lo describe como editor. Se guarda 7 días en KV ("leido:<hash>").
// ponytail: videos de más de 18 MB solo se leen por texto; si hace falta, subirlos con la Files API de Gemini.
const MOVIL = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const COMPU = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const MAX_INLINE = 18 * 1024 * 1024;
const MODELOS = ["gemini-3.6-flash", "gemini-3.5-flash"];
const limpiar = (u) => { while (u.includes("\\\\")) u = u.replace(/\\\\/g, "\\"); return u.replace(/\\\//g, "/").replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&amp;/g, "&"); }; // los embeds traen la URL escapada varias veces
const sinHtml = (s) => String(s || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const meta = (html, prop) => sinHtml((new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, "i").exec(html) || [])[1]);
const b64 = (buf) => { let s = ""; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const galletas = (r) => (r.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");

async function bajar(url, headers = {}) {
  const r = await fetch(url, { headers: { "user-agent": MOVIL, ...headers } });
  if (!r.ok) return null;
  const n = Number(r.headers.get("content-length") || 0); if (n > MAX_INLINE) return { grande: n };
  const buf = await r.arrayBuffer(); return buf.byteLength > MAX_INLINE ? { grande: buf.byteLength } : { buf, mime: (r.headers.get("content-type") || "video/mp4").split(";")[0] };
}

async function tiktok(url) {
  const r = await fetch(url, { headers: { "user-agent": MOVIL }, redirect: "follow" }), html = await r.text(), cookie = galletas(r);
  const m = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  let it = null; try { const sc = JSON.parse(m[1]).__DEFAULT_SCOPE__; it = (sc["webapp.video-detail"] || sc["webapp.reflow.video.detail"])?.itemInfo?.itemStruct; } catch {}
  if (!it) return { titulo: meta(html, "og:title"), texto: meta(html, "og:description") };
  const s = it.stats || {}, v = it.video || {};
  return { titulo: it.desc, autor: "@" + (it.author?.uniqueId || ""), texto: it.desc, duracion: v.duration, numeros: { vistas: s.playCount, likes: s.diggCount, comentarios: s.commentCount, compartidos: s.shareCount }, miniatura: v.cover,
    musica: it.music?.title ? `${it.music.title} · ${it.music.authorName || ""}` : undefined, video: v.playAddr ? await bajar(v.playAddr, { cookie, referer: "https://www.tiktok.com/" }) : null };
}

async function instagram(url) {
  const code = /\/(?:p|reels?|tv)\/([A-Za-z0-9_-]+)/.exec(url)?.[1]; if (!code) return null;
  const html = await (await fetch(`https://www.instagram.com/p/${code}/embed/captioned/`, { headers: { "user-agent": MOVIL } })).text();
  const cap = sinHtml((/class="Caption"[^>]*>([\s\S]*?)<\/div>/.exec(html) || [])[1]).replace(/View all \d+ comments?$/, "").trim();
  const i = html.indexOf("video_url"), vu = i >= 0 ? /https:[^"]*?(?=\\*")/.exec(html.slice(i, i + 3000))?.[0] : null;
  const autor = sinHtml((/class="UsernameText"[^>]*>([\s\S]*?)<\//.exec(html) || [])[1]);
  return { titulo: cap.slice(0, 120), autor: autor ? "@" + autor : undefined, texto: cap, video: vu ? await bajar(limpiar(vu)) : null };
}

async function facebook(url) {
  const html = await (await fetch(`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=true`, { headers: { "user-agent": COMPU } })).text();
  const src = /"sd_src":"(.*?)"/.exec(html)?.[1] || /"hd_src":"(.*?)"/.exec(html)?.[1];
  const texto = sinHtml((/<div[^>]*data-testid="post_message"[^>]*>([\s\S]*?)<\/div>/.exec(html) || [])[1]) || meta(html, "og:description");
  return { titulo: texto.slice(0, 120) || "Video de Facebook", texto, video: src ? await bajar(limpiar(src), { "user-agent": COMPU }) : null };
}

async function youtube(url) {
  const o = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return { titulo: o.title, autor: o.author_name, miniatura: o.thumbnail_url, youtube: true };
}

async function pagina(url) {
  const html = await (await fetch(url, { headers: { "user-agent": COMPU } })).text();
  return { titulo: meta(html, "og:title") || sinHtml((/<title>([\s\S]*?)<\/title>/i.exec(html) || [])[1]), texto: meta(html, "og:description") || meta(html, "description") };
}

// Gemini mira el video y lo describe para el chat (qué pasa, gancho, ritmo, por qué funciona, cómo adaptarlo).
async function verVideo(env, parte, contexto) {
  const pedido = `Eres editor de videos virales. Mira este video (${contexto}) y responde en español, en máximo 170 palabras y en viñetas:
- De qué trata (lo que se ve y se oye, sin inventar).
- Gancho de los primeros 3 segundos.
- Ritmo y edición: cortes, texto en pantalla, voz, música o sonido.
- Por qué funciona (o qué le falla).
- Cómo lo adaptaríamos (idea concreta, sin copiarlo).`;
  for (const m of MODELOS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ parts: [parte, { text: pedido }] }], generationConfig: { maxOutputTokens: 1500, thinkingConfig: { thinkingLevel: "low" } } }) });
      if (!r.ok) continue;
      const t = (await r.json()).candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text).join("").trim();
      if (t) return t;
    } catch {}
  }
  return null;
}

export function plataforma(url) {
  const h = new URL(url).hostname.replace(/^www\.|^m\./, "");
  return /(^|\.)youtube\.com$|^youtu\.be$/.test(h) ? "youtube" : /tiktok\.com$/.test(h) ? "tiktok" : /instagram\.com$/.test(h) ? "instagram" : /(^|\.)facebook\.com$|^fb\.watch$/.test(h) ? "facebook" : "web";
}

export async function leerLink(url, env) {
  const clave = "leido2:" + [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url)))].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
  const guardado = env.ESTADO && (await env.ESTADO.get(clave, "json")); if (guardado) return guardado;
  const p = plataforma(url);
  let d = null;
  try { d = await ({ youtube, tiktok, instagram, facebook, web: pagina })[p](url); } catch (e) { d = { error: String(e.message || e).slice(0, 120) }; }
  d = d || {};
  const contexto = [p, d.autor, d.titulo].filter(Boolean).join(" · ");
  let analisis = null, vio = "texto";
  if (env.GEMINI_API_KEY) {
    if (d.youtube) { analisis = await verVideo(env, { fileData: { fileUri: url } }, contexto); vio = analisis ? "video" : "texto"; }
    else if (d.video?.buf) { analisis = await verVideo(env, { inlineData: { mimeType: d.video.mime || "video/mp4", data: b64(d.video.buf) } }, contexto); vio = analisis ? "video" : "texto"; }
  }
  const out = { url, plataforma: p, titulo: d.titulo, autor: d.autor, texto: d.texto?.slice(0, 1500), duracion: d.duracion, numeros: d.numeros, musica: d.musica, miniatura: d.miniatura, analisis, vio,
    nota: p === "facebook" && !analisis ? "Facebook no deja leer videos desde el servidor: guarda el video en tu cel y mándalo al chat con 📎." : d.error ? `No se pudo abrir: ${d.error}` : d.video?.grande ? `El video pesa ${(d.video.grande / 1048576).toFixed(0)} MB: solo se leyó el texto.` : !analisis && (d.video || d.youtube) ? "No se pudo ver el video; solo el texto." : undefined };
  if (env.ESTADO && (out.analisis || (out.titulo && !d.video && !d.youtube))) await env.ESTADO.put(clave, JSON.stringify(out), { expirationTtl: 7 * 86400 }); // solo se guarda lo que salió completo
  return out;
}

// Video que mandan desde el cel (📎 en el chat): Gemini lo ve igual que los de los links.
export async function verArchivo(env, buf, mime, nombre) {
  if (buf.byteLength > MAX_INLINE) return { nota: `El video pesa ${(buf.byteLength / 1048576).toFixed(0)} MB; el chat ve hasta 18 MB. Recórtalo o súbelo como crudo.` };
  return { analisis: await verVideo(env, { inlineData: { mimeType: mime || "video/mp4", data: b64(buf) } }, `archivo del cel: ${nombre}`) };
}

// Texto para el chat con lo que se vio en los links.
export const resumen = (l) => [`[${l.plataforma}] ${l.url}`, l.autor && `Autor: ${l.autor}`, l.titulo && `Título/texto: ${l.titulo}`, l.duracion && `Duración: ${l.duracion} s`,
  l.numeros && `Números: ${Object.entries(l.numeros).filter(([, v]) => v != null).map(([k, v]) => `${k} ${Number(v).toLocaleString("es-MX")}`).join(", ")}`, l.musica && `Audio: ${l.musica}`,
  l.analisis ? `Lo que se ve en el video:\n${l.analisis}` : l.texto && l.texto !== l.titulo ? `Descripción: ${l.texto}` : null, l.nota && `Nota: ${l.nota}`].filter(Boolean).join("\n");
