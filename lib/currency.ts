export type Currency = "EUR" | "USD" | "MXN" | "ARS";

export const CURRENCIES: Record<
  Currency,
  {
    code: Currency;
    symbol: string;
    name: string;
    flag: string;
    short: string; // shown after amount when symbol is ambiguous
  }
> = {
  EUR: { code: "EUR", symbol: "€", name: "Euros", flag: "🇪🇺", short: "" },
  USD: {
    code: "USD",
    symbol: "$",
    name: "Dólares estadounidenses",
    flag: "🇺🇸",
    short: "USD",
  },
  MXN: {
    code: "MXN",
    symbol: "$",
    name: "Pesos mexicanos",
    flag: "🇲🇽",
    short: "MX",
  },
  ARS: {
    code: "ARS",
    symbol: "$",
    name: "Pesos argentinos",
    flag: "🇦🇷",
    short: "AR",
  },
};

// Approximate fallback rates relative to EUR (1 EUR = X). Updated 2025.
const FALLBACK_RATES: Record<Currency, number> = {
  EUR: 1,
  USD: 1.08,
  MXN: 22,
  ARS: 1100,
};

const RATES_KEY = "rumbo_fx_rates_v1";
const RATES_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedRates {
  base: "EUR";
  rates: Record<Currency, number>;
  fetchedAt: number;
}

let cachedRates: CachedRates | null = null;
let inflight: Promise<CachedRates> | null = null;

// Una tasa solo es usable si es un número finito y positivo. Un 0 o un null
// que se cuele (API caída, caché corrupta) provocaría divisiones por cero y
// convertiría TODAS las sumas del usuario en NaN/Infinity durante 24h.
const isValidRate = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

function sanitizeRates(raw: Partial<Record<Currency, unknown>> | undefined): Record<Currency, number> {
  const usd = raw?.USD, mxn = raw?.MXN, ars = raw?.ARS;
  return {
    EUR: 1,
    USD: isValidRate(usd) ? usd : FALLBACK_RATES.USD,
    MXN: isValidRate(mxn) ? mxn : FALLBACK_RATES.MXN,
    ARS: isValidRate(ars) ? ars : FALLBACK_RATES.ARS,
  };
}

function loadCached(): CachedRates | null {
  if (cachedRates) return cachedRates;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RATES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRates;
    if (Date.now() - parsed.fetchedAt > RATES_TTL_MS) return null;
    // Sanea también lo que viene de la caché: una tasa corrupta guardada ayer
    // no debe seguir rompiendo las cuentas hoy.
    parsed.rates = sanitizeRates(parsed.rates);
    cachedRates = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export async function fetchRates(): Promise<CachedRates> {
  const cached = loadCached();
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/EUR");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const rates = sanitizeRates(data.rates);
      const result: CachedRates = {
        base: "EUR",
        rates,
        fetchedAt: Date.now(),
      };
      cachedRates = result;
      try {
        localStorage.setItem(RATES_KEY, JSON.stringify(result));
      } catch {}
      return result;
    } catch {
      const fallback: CachedRates = {
        base: "EUR",
        rates: { ...FALLBACK_RATES },
        fetchedAt: Date.now(),
      };
      cachedRates = fallback;
      return fallback;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function getRates(): Record<Currency, number> {
  const cached = loadCached();
  return cached ? cached.rates : FALLBACK_RATES;
}

export function convertAmount(
  amount: number,
  from: Currency,
  to: Currency
): number {
  if (from === to) return amount;
  const rates = getRates();
  const out = (amount / rates[from]) * rates[to];
  // Última red de seguridad: un NaN aquí envenenaría todas las sumas del mes
  // y hasta el push a Supabase (numeric rechaza NaN). Mejor 0 y visible.
  return Number.isFinite(out) ? out : 0;
}

export function formatCurrency(amount: number, currency: Currency): string {
  const meta = CURRENCIES[currency];
  const rounded = Math.round(amount);
  const formatted = new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 0,
  }).format(rounded);
  if (currency === "EUR") return `${formatted} €`;
  if (currency === "USD") return `$${formatted}`;
  return `$${formatted} ${meta.short}`;
}
