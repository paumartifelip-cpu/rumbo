import { defineConfig } from "vitest/config";
import path from "node:path";

// Zona horaria fija: la generación de recurrentes y los totales mensuales
// dependen de fechas locales, y los tests no deben cambiar según dónde corran.
process.env.TZ = "UTC";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    pool: "forks",
  },
});
