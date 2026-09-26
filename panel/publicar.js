// Publicar en 1 toque (lo usan los 3 paneles). En el cel manda el archivo al menú Compartir del sistema,
// de donde TikTok, YouTube e Instagram lo abren directo en su editor; el texto va copiado para pegarlo.
// En compu baja el video y abre la página de subida. Publicar.abrir({titulo, video, textos:{tiktok,youtube,instagram}, redes, nota, hecho:{red:bool}, onHecho(red),
//   hd: key R2 del final en 1080 (se descarga y se comparte ese; el panel reproduce la vista previa ligera), mb: tamaño
//   links:{red:url}, onLink(red, url)   -> links de los posts ya publicados (se piden al confirmar y se comparten desde aquí)
//   vyro?: {registrado, onRegistrado()}}) agrega los pasos 2 y 3 de Vyro: pegar el link del post de TikTok y registrarlo.
// ponytail: no hay API directa; TikTok/Meta piden app auditada y YouTube deja privado lo subido por apps sin verificar. El menú Compartir no pide permisos.
(() => {
  const REDES = {
    tiktok: { n: "TikTok", i: "♪", c: "#ff2d55", subir: "https://www.tiktok.com/upload", pista: "Pega el texto en la descripción. Sin música de TikTok: el video ya trae su audio." },
    youtube: { n: "YouTube Shorts", i: "▶", c: "#ff0000", subir: "https://www.youtube.com/upload", pista: "Pega el texto en el título. Si lo subes desde el cel sale como Short solo." },
    instagram: { n: "Instagram Reels", i: "◎", c: "#c13584", subir: "https://www.instagram.com/", pista: "Elige Reel y pega el texto en la descripción." },
  };
  const css = `
  .pub-fondo{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.6);display:grid;align-items:end;justify-items:center}
  .pub{width:min(560px,100%);max-height:92vh;overflow:auto;background:#0e0f16;color:#f2f4ff;border:1px solid #2a2f45;border-bottom:0;border-radius:20px 20px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));display:grid;gap:12px;font:600 16px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}
  .pub-top{display:grid;grid-template-columns:72px 1fr auto;gap:12px;align-items:center}
  .pub video{width:72px;aspect-ratio:9/16;object-fit:cover;border-radius:10px;background:#000}
  .pub h3{margin:0;font-size:17px;line-height:1.25}
  .pub small{color:#9aa3c7;font-weight:600}
  .pub-x{appearance:none;background:#1b1f30;color:#f2f4ff;border:1px solid #2a2f45;border-radius:999px;width:40px;height:40px;font-size:20px;cursor:pointer}
  .pub-red{appearance:none;display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:center;text-align:left;width:100%;padding:12px;border-radius:14px;border:1px solid #2a2f45;background:#151827;color:inherit;font:inherit;cursor:pointer}
  .pub-red:hover{border-color:var(--rc)}
  .pub-red i{width:44px;height:44px;border-radius:12px;background:var(--rc);display:grid;place-items:center;font-style:normal;font-weight:900;color:#fff;font-size:22px}
  .pub-red b{display:block}.pub-red small{display:block;font-size:13px}
  .pub-red.hecho{border-color:#35d07f}.pub-red.hecho::after{content:"✓ publicado";color:#35d07f;font-size:13px}
  .pub-txt{background:#151827;border:1px solid #2a2f45;border-radius:12px;padding:10px;font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere}
  .pub-fila{display:flex;flex-wrap:wrap;gap:8px}
  .pub-btn{appearance:none;flex:1;min-width:130px;padding:12px;border-radius:12px;border:1px solid #2a2f45;background:#1b1f30;color:#f2f4ff;font:800 14px system-ui,sans-serif;cursor:pointer;text-align:center;text-decoration:none}
  .pub-btn.si{background:#35d07f;border-color:#35d07f;color:#04120a}
  .pub-aviso{font-size:14px;color:#ffc857}
  .pub :focus-visible{outline:2px solid #ffc857;outline-offset:2px}
  .pub-paso{display:grid;gap:8px;padding:12px;border-radius:14px;border:1px solid #2a2f45;background:#151827}
  .pub-paso b{font-size:15px}.pub-paso.hecho{border-color:#35d07f}
  .pub-links{display:grid;gap:8px;padding:12px;border-radius:14px;border:1px solid #35d07f;background:rgba(53,208,127,.07)}
  .pub-links .pub-fila{align-items:center}.pub-links span{flex:1;min-width:120px;font-size:14px}
  .pub-fila input{flex:1;min-width:0;padding:11px;border-radius:10px;border:1px solid #2a2f45;background:#0e0f16;color:#f2f4ff;font:600 16px system-ui,sans-serif}
  .pub-paso input{width:100%;padding:11px;border-radius:10px;border:1px solid #2a2f45;background:#0e0f16;color:#f2f4ff;font:600 16px system-ui,sans-serif}`;
  const st = document.createElement("style"); st.textContent = css; document.head.append(st);
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const copiar = (t) => (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).catch(() => {});
  const movil = matchMedia("(pointer: coarse)").matches;
  const RE = { tiktok: /^https:\/\/([\w-]+\.)*tiktok\.com\//, youtube: /^https:\/\/(([\w-]+\.)*youtube\.com|youtu\.be)\//, instagram: /^https:\/\/([\w-]+\.)*instagram\.com\// };
  // Campo para pegar el link de un post: valida que sea de esa red y avisa con onOk(url).
  function campoLink(red, valor, onOk) {
    const caja = h("div", "pub-fila"), inp = h("input"), pegar = h("button", "pub-btn", "Pegar"), ok = h("button", "pub-btn si", "Guardar link");
    inp.type = "url"; inp.inputMode = "url"; inp.value = valor || ""; inp.placeholder = `Link del post en ${REDES[red].n}`; inp.setAttribute("aria-label", inp.placeholder); inp.style.flexBasis = "100%";
    pegar.type = ok.type = "button";
    pegar.onclick = async () => { try { inp.value = (await navigator.clipboard.readText()).trim(); } catch { inp.focus(); } };
    ok.onclick = () => { const l = inp.value.trim(); if (!RE[red].test(l)) { inp.setCustomValidity(`Pega el link de ${REDES[red].n} (Compartir → Copiar enlace)`); inp.reportValidity(); return; } inp.setCustomValidity(""); ok.textContent = "✓ Guardado"; onOk(l); };
    caja.append(inp, pegar, ok); return caja;
  }

  function abrir(o) {
    const redes = o.redes || ["tiktok", "youtube", "instagram"];
    let archivo = null;
    const fondo = h("div", "pub-fondo"), hoja = h("div", "pub"); hoja.setAttribute("role", "dialog"); hoja.setAttribute("aria-label", "Publicar " + o.titulo);
    const cerrar = () => { fondo.remove(); document.removeEventListener("keydown", esc); };
    const esc = (e) => e.key === "Escape" && cerrar();
    fondo.onclick = (e) => e.target === fondo && cerrar(); document.addEventListener("keydown", esc);

    const vid = h("video"); vid.src = o.video; vid.muted = true; vid.playsInline = true; vid.autoplay = true; vid.loop = true;
    const x = h("button", "pub-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Cerrar"); x.onclick = cerrar;
    const tt = h("div"); tt.append(h("h3", null, o.titulo), h("small", null, "Toca la red: se copia el texto y se abre para subir."));
    const top = h("div", "pub-top"); top.append(vid, tt, x);
    const estado = h("small", null, movil ? "Preparando el video…" : ""); estado.setAttribute("aria-live", "polite");
    hoja.append(top); if (o.nota) hoja.append(h("div", "pub-aviso", o.nota)); hoja.append(estado);
    const links = { ...(o.links || {}) }, cajaLinks = h("div", "pub-links");
    const pintaLinks = () => { // links de los posts: copiar, compartir o abrir
      const hay = Object.entries(links).filter(([, u]) => u); cajaLinks.hidden = !hay.length; cajaLinks.replaceChildren(h("b", null, "Links para compartir"));
      hay.forEach(([red, u]) => {
        const f = h("div", "pub-fila"), c = h("button", "pub-btn", "Copiar"), sh = h("button", "pub-btn si", "Compartir"), ab = h("a", "pub-btn", "Abrir");
        c.type = sh.type = "button"; ab.href = u; ab.target = "_blank"; ab.rel = "noopener";
        c.onclick = () => { copiar(u); c.textContent = "¡Copiado!"; };
        sh.onclick = async () => { try { await navigator.share({ title: o.titulo, url: u }); } catch (e) { if (e.name !== "AbortError") { copiar(u); sh.textContent = "Copiado"; } } };
        f.append(h("span", null, REDES[red]?.n || red), c, sh, ab); cajaLinks.append(f);
      });
      if (hay.length > 1) { const todos = h("button", "pub-btn", "Compartir todos"); todos.type = "button"; const txt = `${o.titulo}\n` + hay.map(([r, u]) => `${REDES[r]?.n || r}: ${u}`).join("\n"); todos.onclick = async () => { try { await navigator.share({ title: o.titulo, text: txt }); } catch { copiar(txt); todos.textContent = "Copiados"; } }; cajaLinks.append(todos); }
    };
    const guardarLink = (red, u) => { links[red] = u; o.onLink?.(red, u); pintaLinks(); };
    pintaLinks(); hoja.append(cajaLinks);

    // El archivo que se comparte/descarga: el 1080 si existe. Se baja al abrir para que el toque siguiente
    // pueda compartir sin perder el permiso del gesto. ponytail: más de 300 MB no se precarga (el cel se queda sin memoria): se descarga y se sube desde Fotos.
    const fuente = o.hd ? `/api/crudos/bajar?key=${encodeURIComponent(o.hd)}` : o.video, descarga = o.hd ? fuente + "&descargar=1" : o.video;
    if (o.hd) hoja.insertBefore(h("small", null, `Calidad: 1080×1920${o.mb ? ` · ${o.mb} MB` : ""}${o.dur ? ` · ${Math.round(o.dur)} s` : ""} (la que pide TikTok)`), estado);
    if (movil && navigator.canShare && !(o.mb > 300)) fetch(fuente).then((r) => r.blob()).then((b) => {
      const f = new File([b], (o.titulo || "video").replace(/[^\w-]+/g, "-").slice(0, 40) + ".mp4", { type: "video/mp4" });
      if (navigator.canShare({ files: [f] })) { archivo = f; estado.textContent = "Listo: al tocar una red se abre tu menú Compartir con el video."; }
      else estado.textContent = "";
    }).catch(() => (estado.textContent = ""));
    else if (o.mb > 300) estado.textContent = "Video pesado: toca Guardar en 1080p, y luego súbelo desde Fotos en TikTok.";

    const confirmar = (red) => {
      const c = h("div", "pub-fila"), si = h("button", "pub-btn si", `Sí, ya quedó en ${REDES[red].n}`), no = h("button", "pub-btn", "Todavía no");
      si.type = no.type = "button";
      si.onclick = () => { o.onHecho?.(red); btns[red].classList.add("hecho"); c.replaceChildren(h("small", null, `¿Tienes el link del post? Pégalo para compartirlo después (opcional).`), campoLink(red, links[red], (u) => guardarLink(red, u))); };
      no.onclick = () => c.remove();
      c.append(si, no); hoja.append(c); c.scrollIntoView({ block: "nearest" });
    };
    const btns = {};
    redes.forEach((red) => {
      const R = REDES[red], txt = o.textos?.[red] || o.textos?.tiktok || "";
      const b = h("button", "pub-red" + (o.hecho?.[red] ? " hecho" : "")); b.type = "button"; b.style.setProperty("--rc", R.c);
      const t = h("div"); t.append(h("b", null, `Subir a ${R.n}`), h("small", null, R.pista));
      b.append(h("i", null, R.i), t);
      b.onclick = async () => {
        copiar(txt); // mismo toque: el texto queda listo para pegar
        if (archivo) { try { await navigator.share({ files: [archivo] }); return confirmar(red); } catch (e) { if (e.name === "AbortError") return; } }
        const a = h("a"); a.href = descarga; a.download = ""; document.body.append(a); a.click(); a.remove();
        window.open(R.subir, "_blank", "noopener");
        confirmar(red);
      };
      btns[red] = b; hoja.append(b);
    });
    if (o.vyro) { // Vyro: 2) link del post de TikTok, 3) registrarlo en app.vyro.com
      const V = o.vyro;
      const p2 = h("div", "pub-paso" + (links.tiktok ? " hecho" : ""));
      p2.append(h("b", null, "Paso 2 · Pega el link del post"), h("small", null, "En TikTok: tu video → Compartir → Copiar enlace."), campoLink("tiktok", links.tiktok, (u) => { guardarLink("tiktok", u); p2.classList.add("hecho"); }));
      const p3 = h("div", "pub-paso" + (V.registrado ? " hecho" : "")), ir = h("button", "pub-btn si", V.registrado ? "✓ Ya está en Vyro" : "Registrar en Vyro →"); ir.type = "button";
      ir.onclick = () => {
        const l = links.tiktok; if (!l) { p2.querySelector("input").focus(); return; }
        copiar(l); window.open("https://app.vyro.com", "_blank", "noopener");
        const c = h("div", "pub-fila"), si = h("button", "pub-btn si", "Sí, ya lo registré"), no = h("button", "pub-btn", "Todavía no"); si.type = no.type = "button";
        si.onclick = () => { V.onRegistrado?.(); p3.classList.add("hecho"); ir.textContent = "✓ Ya está en Vyro"; c.remove(); }; no.onclick = () => c.remove();
        c.append(si, no); p3.append(c);
      };
      p3.append(h("b", null, "Paso 3 · Regístralo en Vyro"), h("small", null, "Se copia el link y se abre Vyro: pégalo en la campaña Ketone-IQ. Vyro solo deja 3 en revisión a la vez."), ir);
      if (btns.tiktok) btns.tiktok.querySelector("b").textContent = "Paso 1 · Subir a TikTok";
      hoja.append(p2, p3);
    }
    const texto = o.textos?.tiktok || "";
    if (texto) { const box = h("div", "pub-txt", texto); hoja.append(box); }
    const fila = h("div", "pub-fila"), g = h("a", "pub-btn", o.hd ? "Guardar en 1080p" : "Guardar video"), c = h("button", "pub-btn", "Copiar texto");
    g.href = descarga; g.download = ""; c.type = "button"; c.onclick = () => { copiar(texto); c.textContent = "¡Copiado!"; };
    fila.append(g, c); hoja.append(fila);
    fondo.append(hoja); document.body.append(fondo); x.focus();
  }
  window.Publicar = { abrir, REDES };
})();
