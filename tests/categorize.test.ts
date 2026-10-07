import { describe, expect, it } from "vitest";
import { heuristicCategorize as h } from "@/lib/gemini";

describe("clasificación automática: lo que ya funcionaba sigue igual", () => {
  const casos: Array<[string, string]> = [
    ["Mercadona", "Comida"],
    ["Alquiler", "Alojamiento"],
    ["Uber", "Transporte"],
    ["Zara", "Compras"],
    ["Farmacia", "Salud"],
    ["Curso Udemy", "Educación"],
    ["Donación Cruz Roja", "Caridad"],
    ["Netflix en casa", "Alojamiento"], // "casa" ya era vivienda: no se toca
  ];
  it.each(casos)("%s → %s", (titulo, categoria) => {
    expect(h(titulo)).toBe(categoria);
  });

  it("lo desconocido sigue devolviendo null (el llamador pone «Otros»)", () => {
    expect(h("Estética")).toBeNull();
    expect(h("zzz")).toBeNull();
  });
});

describe("vocabulario de México y Latinoamérica", () => {
  it("comida: súper, tianguis, mercado, cadenas habituales y la palabra «comida»", () => {
    for (const t of ["Super", "Súper", "Tianguis", "Mercado", "Oxxo", "Walmart", "Soriana", "Chedraui", "Costco", "Tortillería", "Abarrotes", "Cómida chicas", "Comida", "Taquería"]) {
      expect(h(t), t).toBe("Comida");
    }
  });

  it("«Mercado Libre» es una compra, no comida; «Mercado Pago» no se clasifica como comida", () => {
    expect(h("Mercado Libre")).toBe("Compras");
    expect(h("MercadoLibre")).toBe("Compras");
    expect(h("Mercado Pago")).not.toBe("Comida");
  });

  it("alojamiento: cuota de mantenimiento, predial y servicios del hogar", () => {
    for (const t of ["Mantto", "Mantto Sendero", "Cuota de mantenimiento", "Mantenimiento edificio", "Predial", "CFE", "Telmex", "Totalplay", "Izzi"]) {
      expect(h(t), t).toBe("Alojamiento");
    }
  });

  it("transporte: Pemex, casetas, camión, Didi y la palabra «transporte»", () => {
    for (const t of ["Pemex", "Caseta", "Camión", "Metrobús", "Didi", "Transporte", "Estacionamiento"]) {
      expect(h(t), t).toBe("Transporte");
    }
  });

  it("compras: cadenas habituales", () => {
    for (const t of ["Liverpool", "Coppel", "Elektra", "Temu"]) {
      expect(h(t), t).toBe("Compras");
    }
  });

  it("no confunde palabras que solo contienen estas letras", () => {
    expect(h("Superman")).toBeNull();
    expect(h("Mantenimiento del coche")).not.toBe("Alojamiento");
    expect(h("Comercial")).toBeNull();
  });
});
