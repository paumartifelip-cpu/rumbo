import coreWebVitals from "eslint-config-next/core-web-vitals";

// ESLint 9 (flat config). Next 16 ya no trae `next lint`: se ejecuta eslint directo.
const config = [
  ...coreWebVitals,
  {
    // Reglas nuevas de React (modo "compiler") que eslint-config-next 16 activa
    // como error. Señalan patrones que ya existían y funcionan (p. ej. reiniciar
    // un formulario en un efecto al abrir una hoja). Se dejan como AVISO para ir
    // reduciéndolos con tests de por medio, sin bloquear la CI ni forzar una
    // reescritura grande de efectos en un cambio de versión.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  { ignores: [".next/**", "out/**", "node_modules/**", "next-env.d.ts"] },
];

export default config;
