// Notificaciones push (Web Push: RFC 8291 cifrado aes128gcm + VAPID) solo con WebCrypto, sin librerías ni servicios externos.
// Llegan al iPhone/iPad (iOS 16.4+, con el Puente instalado en la pantalla de inicio), Android y compu.
// Las llaves VAPID se generan una vez y viven en KV ("vapid"); las suscripciones por persona en KV ("push:<usuario>").
const te = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const unir = (...partes) => { const out = new Uint8Array(partes.reduce((a, p) => a + p.length, 0)); let i = 0; for (const p of partes) { out.set(p, i); i += p.length; } return out; };

export async function vapid(env) {
  const guardado = await env.ESTADO.get("vapid", "json");
  if (guardado) return guardado;
  const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const v = { publica: b64u(await crypto.subtle.exportKey("raw", par.publicKey)), privada: await crypto.subtle.exportKey("jwk", par.privateKey) };
  await env.ESTADO.put("vapid", JSON.stringify(v));
  return v;
}

async function jwtVapid(v, endpoint) {
  const cab = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const cuerpo = b64u(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:avisos@puente-fabrica.pages.dev" })));
  const llave = await crypto.subtle.importKey("jwk", v.privada, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, llave, te.encode(`${cab}.${cuerpo}`)); // WebCrypto ya da r||s como pide JWS
  return `${cab}.${cuerpo}.${b64u(firma)}`;
}

const hkdf = async (ikm, salt, info, bits) => new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]), bits));

export async function cifrar(sub, texto) { // RFC 8291 + RFC 8188, un solo registro
  const uaPub = deB64u(sub.keys.p256dh), auth = deB64u(sub.keys.auth);
  const efimero = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", efimero.publicKey));
  const uaLlave = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secreto = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaLlave }, efimero.privateKey, 256));
  const ikm = await hkdf(secreto, auth, unir(te.encode("WebPush: info\0"), uaPub, asPub), 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(ikm, salt, te.encode("Content-Encoding: aes128gcm\0"), 128), nonce = await hkdf(ikm, salt, te.encode("Content-Encoding: nonce\0"), 96);
  const clave = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, clave, unir(te.encode(texto), new Uint8Array([2]))));
  return unir(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPub.length]), asPub, cifrado); // rs = 4096
}

export const suscripciones = async (env, usuario) => (await env.ESTADO.get(`push:${usuario}`, "json")) || [];
export const guardarSuscripciones = (env, usuario, lista) => env.ESTADO.put(`push:${usuario}`, JSON.stringify(lista.slice(0, 10)));

// Manda {titulo, cuerpo, url, tag} a los dispositivos de una persona (solo los que tengan activado ese tipo de aviso).
// Borra solas las suscripciones que el teléfono ya dio de baja (404/410).
export async function enviar(env, usuario, aviso, tipo = "listos") {
  const lista = await suscripciones(env, usuario); if (!lista.length) return 0;
  const v = await vapid(env), payload = JSON.stringify(aviso); let ok = 0, vivas = [];
  for (const s of lista) {
    if (s.prefs && s.prefs[tipo] === false) { vivas.push(s); continue; }
    try {
      const r = await fetch(s.sub.endpoint, { method: "POST", headers: { Authorization: `vapid t=${await jwtVapid(v, s.sub.endpoint)}, k=${v.publica}`, TTL: "86400", Urgency: "high", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream" }, body: await cifrar(s.sub, payload) });
      if (r.status === 404 || r.status === 410) continue; // ya no existe
      if (r.ok) ok++;
    } catch {}
    vivas.push(s);
  }
  if (vivas.length !== lista.length) await guardarSuscripciones(env, usuario, vivas);
  return ok;
}
