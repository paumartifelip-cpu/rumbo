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

  it("alojamiento: cuota de mantenimiento, predial y luz de la casa", () => {
    for (const t of ["Mantto", "Mantto Sendero", "Cuota de mantenimiento", "Mantenimiento edificio", "Predial", "CFE"]) {
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

describe("Alojamiento es la renta o el hotel; internet y teléfono son Compras", () => {
  it("renta, alquiler, hipoteca y hoteles son alojamiento", () => {
    for (const t of ["Renta", "Alquiler", "Hipoteca", "Hotel", "Airbnb", "Hostal", "Vivienda", "Hospedaje", "Alojamiento"]) {
      expect(h(t), t).toBe("Alojamiento");
    }
  });

  it("internet y telefonía NO son alojamiento: van a Compras", () => {
    for (const t of ["Internet", "Wifi", "Fibra", "Router", "Telmex", "Totalplay", "Izzi", "Megacable", "Movistar", "Vodafone", "Orange", "Digi"]) {
      expect(h(t), t).toBe("Compras");
    }
  });

  it("no confunde palabras parecidas", () => {
    expect(h("Digital")).toBeNull();
    expect(h("Ibiza")).toBeNull();
    expect(h("Estudios")).toBe("Educación"); // contiene «studio», pero son estudios
  });
});

describe("si el concepto es el nombre de la categoría (o un sinónimo claro), se clasifica solo", () => {
  const casos: Array<[string, string]> = [
    ["Comida", "Comida"], ["Comidas", "Comida"], ["Supermercado", "Comida"], ["Restaurante", "Comida"],
    ["Super", "Comida"], ["Desayuno", "Comida"], ["Cafetería", "Comida"],
    ["Transporte", "Transporte"], ["Gasolina", "Transporte"], ["Taxi", "Transporte"], ["Vuelo", "Transporte"], ["Tren", "Transporte"],
    ["Alojamiento", "Alojamiento"], ["Renta", "Alojamiento"],
    ["Compras", "Compras"], ["Compra", "Compras"], ["Tienda", "Compras"], ["Ropa", "Compras"],
    ["Salud", "Salud"], ["Médico", "Salud"], ["Farmacia", "Salud"], ["Dentista", "Salud"],
    ["Educación", "Educación"], ["Curso", "Educación"], ["Colegio", "Educación"],
    ["Caridad", "Caridad"], ["Donación", "Caridad"],
    ["Trabajo", "Trabajo"], ["Oficina", "Trabajo"], ["Coworking", "Trabajo"],
  ];
  it.each(casos)("%s → %s", (titulo, categoria) => {
    expect(h(titulo)).toBe(categoria);
  });

  it("si el concepto menciona otra categoría, gana esa: «Comida de trabajo» es comida", () => {
    expect(h("Comida de trabajo")).toBe("Comida");
  });

  it("las mayúsculas y las tildes no importan", () => {
    expect(h("COMIDA")).toBe("Comida");
    expect(h("educación")).toBe("Educación");
    expect(h("Súper")).toBe("Comida");
  });
});
