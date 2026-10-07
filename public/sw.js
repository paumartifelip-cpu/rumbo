/* Rumbo · service worker (programa de fondo de la app instalada).
 *
 * Por ahora solo hace dos cosas: permite que el móvil instale Rumbo como una app y
 * deja preparado el sitio donde llegarán las notificaciones (siguiente fase).
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
