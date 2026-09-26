// Menú de Ajustes (lo usan los 3 paneles). Dos niveles: lo del proyecto (compartido, se guarda en el servidor)
// y lo de este dispositivo (tamaño de letra, quién soy; se queda en el cel).
// Ajustes.abrir({titulo, valores, secciones:[{t, campos:[{k, tipo:"lista"|"horas"|"numero"|"redes"|"texto"|"opciones", ...}]}], onGuardar(valores), extra:[nodos]})
(() => {
  const css = `
  .aj-fondo{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.6);display:grid;justify-items:end}
  .aj{width:min(520px,100%);height:100%;overflow:auto;background:#0d0f17;color:#eef1ff;border-left:1px solid #262b40;padding:calc(14px + env(safe-area-inset-top,0px)) 18px calc(24px + env(safe-area-inset-bottom,0px));display:grid;gap:14px;align-content:start;font:600 16px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}
  .aj-top{display:flex;justify-content:space-between;align-items:center;gap:10px;position:sticky;top:calc(-14px - env(safe-area-inset-top,0px));background:#0d0f17;padding:6px 0 10px;border-bottom:1px solid #262b40;z-index:1}
  .aj-top b{font-size:20px;letter-spacing:.02em}
  .aj-sec{display:grid;gap:10px;padding:14px;border:1px solid #262b40;border-radius:16px;background:#131626}
  .aj-sec h4{margin:0;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8e97c4}
  .aj-campo{display:grid;gap:6px}.aj-campo>span{font-size:14px}.aj-campo small{color:#8e97c4;font-weight:500}
  .aj input[type=text],.aj input[type=number],.aj select{width:100%;padding:10px 11px;border-radius:10px;border:1px solid #2c3250;background:#0d0f17;color:#eef1ff;font:600 16px system-ui,sans-serif}
  .aj-chips{display:flex;flex-wrap:wrap;gap:6px}
  .aj-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 6px 6px 11px;border-radius:999px;background:#1d2238;border:1px solid #2c3250;font-size:14px}
  .aj-chip button{appearance:none;border:0;background:#2c3250;color:#eef1ff;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:14px;line-height:1}
  .aj-add{display:grid;grid-template-columns:1fr auto;gap:6px}
  .aj-b{appearance:none;padding:10px 14px;border-radius:10px;border:1px solid #2c3250;background:#1d2238;color:#eef1ff;font:800 14px system-ui,sans-serif;cursor:pointer;text-decoration:none;text-align:center}
  .aj-b.si{background:#35d07f;border-color:#35d07f;color:#04120a}.aj-b.peligro{border-color:#ff4d6d;color:#ff8fa3}
  .aj-sw{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0}
  .aj-sw input{width:46px;height:26px;accent-color:#35d07f}
  .aj-pie{position:sticky;bottom:calc(-24px - env(safe-area-inset-bottom,0px));background:#0d0f17;padding:10px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px;border-top:1px solid #262b40}
  .aj :focus-visible{outline:2px solid #ffc857;outline-offset:2px}`;
  const st = document.createElement("style"); st.textContent = css; document.head.append(st);
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const REDES = { tiktok: "TikTok", youtube: "YouTube Shorts", instagram: "Instagram Reels" };
  // "15:00" <-> "3:00 PM"
  const aAmPm = (v) => { const [H, M] = v.split(":").map(Number); return `${H % 12 || 12}:${String(M).padStart(2, "0")} ${H < 12 ? "AM" : "PM"}`; };
  const a24 = (t) => { const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(t); if (!m) return "12:00"; let H = +m[1] % 12; if (/PM/i.test(m[3])) H += 12; return `${String(H).padStart(2, "0")}:${m[2]}`; };
  const orden = (t) => a24(t);

  function campo(c, v, set) {
    const w = h(c.tipo === "texto" || c.tipo === "numero" || c.tipo === "opciones" ? "label" : "div", "aj-campo"); w.append(h("span", null, c.n)); if (c.ayuda) w.append(h("small", null, c.ayuda));
    if (c.tipo === "texto" || c.tipo === "numero") {
      const i = h("input"); i.type = c.tipo === "numero" ? "number" : "text"; i.value = v ?? ""; if (c.ph) i.placeholder = c.ph; if (c.min != null) i.min = c.min; if (c.max != null) i.max = c.max; i.inputMode = c.tipo === "numero" ? "numeric" : "text";
      i.oninput = () => set(c.tipo === "numero" ? Number(i.value) : i.value); w.append(i);
    } else if (c.tipo === "opciones") {
      const sel = h("select"); c.opciones.forEach(([k, n]) => { const o = h("option", null, n); o.value = k; sel.append(o); }); sel.value = v ?? c.opciones[0][0]; sel.onchange = () => set(sel.value); w.append(sel);
    } else if (c.tipo === "redes") {
      const d = h("div");
      Object.entries(REDES).forEach(([k, n]) => { const r = h("label", "aj-sw"), i = h("input"); i.type = "checkbox"; i.dataset.r = k; i.checked = (v || []).includes(k); i.onchange = () => set([...d.querySelectorAll("input:checked")].map((x) => x.dataset.r)); r.append(h("span", null, n), i); d.append(r); });
      w.append(d);
    } else { // lista u horas: chips + agregar
      let arr = [...(v || [])]; const chips = h("div", "aj-chips"), add = h("div", "aj-add"), i = h("input"), b = h("button", "aj-b", "Agregar");
      i.type = c.tipo === "horas" ? "time" : "text"; i.placeholder = c.ph || ""; if (c.tipo === "horas") { i.value = "12:00"; i.style.cssText = "width:100%;padding:10px;border-radius:10px;border:1px solid #2c3250;background:#0d0f17;color:#eef1ff;font:600 16px system-ui"; }
      b.type = "button";
      const pinta = () => { chips.replaceChildren(...arr.map((x, n) => { const ch = h("span", "aj-chip", x), q = h("button", null, "×"); q.type = "button"; q.setAttribute("aria-label", "Quitar " + x); q.onclick = () => { arr.splice(n, 1); set([...arr]); pinta(); }; ch.append(q); return ch; })); };
      b.onclick = () => { const x = c.tipo === "horas" ? aAmPm(i.value || "12:00") : i.value.trim(); if (!x || arr.includes(x) || arr.length >= (c.max || 12)) return; arr.push(x); if (c.tipo === "horas") arr.sort((p, q) => orden(p).localeCompare(orden(q))); set([...arr]); if (c.tipo !== "horas") i.value = ""; pinta(); };
      i.onkeydown = (e) => e.key === "Enter" && (e.preventDefault(), b.click());
      add.append(i, b); pinta(); w.append(chips, add);
    }
    return w;
  }

  function abrir(o) {
    const val = structuredClone(o.valores || {}), fondo = h("div", "aj-fondo"), p = h("div", "aj"); p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Ajustes");
    const cerrar = () => { fondo.remove(); document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
    const esc = (e) => e.key === "Escape" && cerrar();
    fondo.onclick = (e) => e.target === fondo && cerrar(); document.addEventListener("keydown", esc); document.body.style.overflow = "hidden";
    const top = h("div", "aj-top"), x = h("button", "aj-b", "Cerrar"); x.type = "button"; x.onclick = cerrar; top.append(h("b", null, "⚙ " + (o.titulo || "Ajustes")), x); p.append(top);
    o.secciones.forEach((s) => { const sec = h("section", "aj-sec"); sec.append(h("h4", null, s.t)); if (s.ayuda) sec.append(h("small", null, s.ayuda)); s.campos.forEach((c) => sec.append(campo(c, c.local ? c.valor : val[c.k], (nv) => (c.local ? c.onCambio?.(nv) : (val[c.k] = nv))))); p.append(sec); });
    (o.extra || []).forEach((n) => p.append(n));
    const pie = h("div", "aj-pie"), g = h("button", "aj-b si", "Guardar"), c2 = h("button", "aj-b", "Cancelar"); g.type = c2.type = "button";
    g.onclick = async () => { g.disabled = true; g.textContent = "Guardando…"; const ok = await o.onGuardar?.(val); if (ok !== false) cerrar(); else { g.disabled = false; g.textContent = "Guardar"; } };
    c2.onclick = cerrar; pie.append(c2, g); p.append(pie);
    fondo.append(p); document.body.append(fondo); x.focus();
  }
  function seccion(t, nodos) { const s = h("section", "aj-sec"); s.append(h("h4", null, t), ...nodos); return s; }
  function boton(txt, fn, cls = "") { const b = h("button", "aj-b " + cls, txt); b.type = "button"; b.onclick = fn; return b; }
  function enlace(txt, href, cls = "") { const a = h("a", "aj-b " + cls, txt); a.href = href; return a; }
  // Tamaño de letra de este dispositivo (se aplica a todo el panel)
  // ponytail: zoom escala todo (los paneles usan px); Safari, Chrome y Firefox 126+ lo soportan.
  const LETRA = { chica: 0.92, normal: 1, grande: 1.12, enorme: 1.25 };
  const letra = (v) => { if (v) { try { localStorage.setItem("aj-letra", v); } catch {} } let x = v; if (!x) { try { x = localStorage.getItem("aj-letra"); } catch {} } x = LETRA[x] ? x : "normal"; document.documentElement.style.zoom = LETRA[x]; return x; };
  letra();
  window.Ajustes = { abrir, seccion, boton, enlace, letra, LETRA, a24, aAmPm };
})();
