// Recibe los avisos del Puente aunque la app esté cerrada y abre la pantalla correcta al tocarlos.
self.addEventListener("push", (e) => {
  let a = {}; try { a = e.data.json(); } catch { a = { titulo: "Puente de mando", cuerpo: e.data?.text() || "" }; }
  e.waitUntil(self.registration.showNotification(a.titulo || "Puente de mando", { body: a.cuerpo || "", tag: a.tag, renotify: !!a.tag, icon: "/icono-192.png", badge: "/icono-192.png", data: { url: a.url || "/" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => { const w = ws.find((x) => x.url.startsWith(self.location.origin)); return w ? w.navigate(url).then((x) => (x || w).focus()) : clients.openWindow(url); }));
});
