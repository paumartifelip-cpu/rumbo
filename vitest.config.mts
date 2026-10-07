import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Zona horaria fija: la generación de recurrentes y los totales mensuales
// dependen de fechas locales, y los tests no deben cambiar según dónde corran.
process.env.TZ = "UTC";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    pool: "forks",
  },
});
