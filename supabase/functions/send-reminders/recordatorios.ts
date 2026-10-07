// Textos del recordatorio diario (lógica pura, sin red, para poder probarla).
// Nunca llevan importes ni datos de la persona: un aviso puede verse en la pantalla bloqueada.

import type { AvisoPush } from "./push.ts";

export const TEXTOS: { title: string; body: string }[] = [
  { title: "Rumbo", body: "¿Qué tal el día? Apunta en un minuto lo que has gastado 📝" },
  { title: "Rumbo", body: "Un momento para tus cuentas: ¿algún gasto de hoy por apuntar?" },
  { title: "Rumbo", body: "Si apuntas hoy, mañana no tendrás que acordarte 😉" },
  { title: "Rumbo", body: "Tu Rumbo te espera. ¿Anotamos lo de hoy?" },
  { title: "Rumbo", body: "Pequeño hábito, gran diferencia: apunta tus gastos de hoy 💪" },
  { title: "Rumbo", body: "¿Café, comida, transporte…? Apúntalo antes de que se te olvide" },
  { title: "Rumbo", body: "Cierra el día con tus cuentas al día ✅" },
];

/** Número de día (estable) de una fecha «AAAA-MM-DD»: la misma fecha da siempre el mismo número. */
function diaNumero(fechaLocal: string): number {
  const [a, m, d] = fechaLocal.split("-").map(Number);
  return Math.floor(Date.UTC(a, m - 1, d) / 86_400_000);
}

/** El aviso de ese día. Sin azar: días seguidos dan textos distintos y la misma fecha, el mismo. */
export function avisoRecordatorio(fechaLocal: string): AvisoPush {
  const t = TEXTOS[((diaNumero(fechaLocal) % TEXTOS.length) + TEXTOS.length) % TEXTOS.length];
  return { title: t.title, body: t.body, tag: "rumbo-recordatorio", url: "/gastos/" };
}
