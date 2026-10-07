/* Rumbo · service worker (programa de fondo de la app instalada).
 *
 * Hace tres cosas: permite que el móvil instale Rumbo como una app, MUESTRA los avisos
 * (notificaciones) cuando llegan y abre Rumbo cuando se toca uno.
 *
 * NO guarda páginas ni datos en caché, a propósito: así lo que ve el usuario es siempre
 * la última versión y no hay riesgo de enseñar pantallas viejas ni datos desfasados de
 * dinero. Si algún día se quiere que funcione sin conexión, se decide con cuidado.
 */

self.addEventListener("install", () => {
  // Se activa enseguida, sin esperar a que se cierren las pestañas abiertas.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Necesario para que algunos navegadores consideren la web "instalable". No toca nada:
// al no llamar a respondWith, cada petición va a la red como siempre.
self.addEventListener("fetch", () => {});

// ── Avisos ────────────────────────────────────────────────────────────────────

const RUTA_POR_DEFECTO = "/dashboard/";

// Solo se abre una dirección de Rumbo: nunca una externa, aunque el aviso la traiga.
function rutaSegura(url) {
  // Sin dirección (o algo que no es texto) → el panel. Sin esto, `undefined` se convertía en "/undefined".
  if (typeof url !== "string" || url.length === 0) return RUTA_POR_DEFECTO;
  try {
    const u = new URL(url, self.location.origin);
    return u.origin === self.location.origin ? u.pathname + u.search : RUTA_POR_DEFECTO;
  } catch (e) {
    return RUTA_POR_DEFECTO;
  }
}

// IMPORTANTE: cada aviso que llega TIENE que mostrar una notificación. Si no, Safari
// (iPhone) decide que la web abusa y le retira el permiso. Por eso aquí no hay ningún
// camino que termine sin mostrar algo, ni siquiera si el contenido llega vacío o roto.
self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch (e) {
    datos = { body: event.data ? event.data.text() : "" };
  }
  const titulo = (datos && datos.title) || "Rumbo";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: (datos && datos.body) || "Tienes gastos por apuntar.",
      icon: "/icons/icon-192.png",
      badge: "/icons/favicon-32.png",
      // Mismo "tag" = el aviso nuevo sustituye al anterior en vez de apilarse.
      tag: (datos && datos.tag) || "rumbo-recordatorio",
      data: { url: rutaSegura(datos && datos.url) },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = rutaSegura(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ("focus" in v) {
          // Ya hay Rumbo abierto: se lleva a esa pantalla y se trae al frente.
          if ("navigate" in v) v.navigate(url).catch(() => {});
          return v.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
