// Avisos push en este dispositivo (lo usan el inicio y los paneles). En iPhone/iPad solo funcionan con el Puente
// abierto desde el icono de la pantalla de inicio (iOS 16.4+); en Android y compu, directo desde el navegador.
// Avisos.tarjeta(nodo, {usuario}) pinta el estado y los botones · Avisos.suscrito() -> bool
(() => {
  const h = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const soporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instalada = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const reg = soporta ? navigator.serviceWorker.register("/sw.js").catch(() => null) : Promise.resolve(null);
  const deB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
  const api = (m, q = "", b) => fetch("/api/push" + q, { method: m, headers: { "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined }).then((r) => r.json());

  async function actual() { const r = await reg; return r ? r.pushManager.getSubscription() : null; }
  async function suscrito() { const s = await actual(); if (!s) return false; const d = await api("GET", `?endpoint=${encodeURIComponent(s.endpoint)}`).catch(() => ({})); return d.suscrito ? d.prefs : false; }
  async function activar(prefs) { // debe llamarse desde un toque (iOS lo exige)
    if ((await Notification.requestPermission()) !== "granted") throw new Error("Sin permiso: actívalo en Ajustes del cel → Notificaciones → Puente.");
    const r = await reg; if (!r) throw new Error("Este navegador no deja avisos.");
    const { publica } = await api("GET");
    const s = (await r.pushManager.getSubscription()) || (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: deB64u(publica) }));
    await api("POST", "", { sub: s.toJSON(), prefs });
  }
  async function desactivar() { const s = await actual(); if (s) { await api("DELETE", "", { endpoint: s.endpoint }).catch(() => {}); await s.unsubscribe(); } }

  async function tarjeta(nodo, o = {}) {
    const pinta = async () => {
      const caja = h("div"); caja.style.cssText = "display:grid;gap:10px";
      if (!soporta || (ios && !instalada)) {
        caja.append(h("p", "nota", ios ? "Para recibir avisos en iPhone/iPad: abre el Puente desde el icono de tu pantalla de inicio (no desde Safari) y activa aquí los avisos." : "Este navegador no deja recibir avisos. Prueba con Chrome, Edge o Safari."));
        return nodo.replaceChildren(caja);
      }
      const prefs = await suscrito().catch(() => false);
      const def = { horarios: o.usuario === "juan", listos: true }, p = prefs || def;
      const sw = (k, t) => { const l = h("label"); l.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:10px;font-weight:700"; const i = h("input"); i.type = "checkbox"; i.checked = !!p[k]; i.style.cssText = "width:22px;height:22px"; i.onchange = async () => { p[k] = i.checked; if (prefs) await activar(p).catch(() => {}); }; l.append(h("span", null, t), i); return l; };
      caja.append(h("p", "nota", prefs ? "✓ Avisos activados en este dispositivo." : "Activa los avisos para que no se te pase la hora de publicar."), sw("horarios", "⏰ Horarios de publicar (clips)"), sw("listos", "✅ Cuando algo que pedí quede listo"));
      const fila = h("div", "fila");
      if (prefs) {
        const pr = h("button", "btn", "Probar aviso"), off = h("button", "btn", "Desactivar"); pr.type = off.type = "button";
        pr.onclick = async () => { pr.disabled = true; const d = await api("POST", "?prueba=1").catch(() => ({})); pr.textContent = d.enviados ? "✓ Enviado" : "No llegó: revisa permisos"; };
        off.onclick = async () => { await desactivar(); pinta(); }; fila.append(pr, off);
      } else {
        const on = h("button", "btn", "🔔 Activar avisos"); on.type = "button"; on.style.cssText = "border-color:currentColor";
        on.onclick = async () => { on.disabled = true; try { await activar(p); pinta(); } catch (e) { on.disabled = false; caja.append(h("p", "nota", e.message)); } };
        fila.append(on);
      }
      caja.append(fila); nodo.replaceChildren(caja);
    };
    pinta();
  }
  window.Avisos = { tarjeta, suscrito, activar, soporta: soporta && (!ios || instalada) };
})();
