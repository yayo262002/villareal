// El avisador del panel: recibe los avisos que manda la web (el resumen de
// cada mañana, un aviso de prueba) y los enseña como notificaciones del
// teléfono, aunque el panel esté cerrado. No guarda páginas ni toca nada
// más. Se registra desde el Resumen, en «Avisos en el teléfono».
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener("push", (evento) => {
  let datos = {};
  try {
    datos = evento.data ? evento.data.json() : {};
  } catch {
    datos = { cuerpo: evento.data ? evento.data.text() : "" };
  }
  evento.waitUntil(
    self.registration.showNotification(datos.titulo || "Villa Real", {
      body: datos.cuerpo || "",
      icon: "/marca/icono-192.png",
      badge: "/marca/icono-192.png",
      tag: datos.etiqueta || "villareal",
      renotify: true,
      data: { url: datos.url || "/admin" },
    }),
  );
});

// Al tocar el aviso se abre el panel en la pantalla que diga el aviso (o se trae al frente si ya está abierto).
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = new URL((evento.notification.data && evento.notification.data.url) || "/admin", self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const ventana of ventanas) {
        if ("focus" in ventana) {
          if ("navigate" in ventana) ventana.navigate(url);
          return ventana.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
