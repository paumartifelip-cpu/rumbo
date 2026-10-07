// Textos de las pantallas de error. Separados del diseño para poder probarlos.
// Tono: cercano y con humor, sin culpar al usuario ni dar detalles técnicos que
// asusten. Regla: no prometer lo que no sabemos (p. ej. que "ya lo estamos arreglando").

export interface VarianteError {
  emoji: string;
  title: string;
  text: string;
}

export const VARIANTES_ERROR: VarianteError[] = [
  {
    emoji: "🧭",
    title: "Ups, nos hemos salido del rumbo",
    text: "Algo se ha torcido por nuestro lado, no por el tuyo. Lo que ya habías apuntado sigue guardado.",
  },
  {
    emoji: "😵‍💫",
    title: "A la brújula se le ha ido la cabeza",
    text: "Hasta los mejores navegantes pierden el norte alguna vez. Respira, que tus datos siguen donde los dejaste.",
  },
  {
    emoji: "🗺️",
    title: "Esto no estaba en el mapa",
    text: "Ha pasado algo que no esperábamos. Prueba otra vez: muchas veces se arregla solo.",
  },
  {
    emoji: "🐙",
    title: "Un pulpo ha enredado los cables",
    text: "Cosas que pasan en alta mar. Tu dinero apuntado está a salvo; intenta de nuevo y seguimos.",
  },
];

/** Elige una variante de forma estable a partir de un número (p. ej. la hora). */
export function elegirVariante(semilla: number): VarianteError {
  const n = VARIANTES_ERROR.length;
  return VARIANTES_ERROR[((Math.floor(semilla) % n) + n) % n];
}

export const PAGINA_NO_ENCONTRADA: VarianteError = {
  emoji: "✈️",
  title: "Esta página se ha ido de viaje",
  text: "No sabemos dónde está, y mira que la hemos buscado. Vuelve al inicio y seguimos desde ahí.",
};

export const ERROR_GRAVE: VarianteError = {
  emoji: "🛟",
  title: "Hemos tenido un pequeño naufragio",
  text: "Algo ha fallado en lo más básico de la aplicación. Recarga la página; tus datos siguen guardados.",
};
