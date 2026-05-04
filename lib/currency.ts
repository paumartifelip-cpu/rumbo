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

function loadCached(): CachedRates | null {
  if (cachedRates) return cachedRates;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RATES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRates;
    if (Date.now() - parsed.fetchedAt > RATES_TTL_MS) return null;
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
      const rates: Record<Currency, number> = {
        EUR: 1,
        USD: data.rates?.USD ?? FALLBACK_RATES.USD,
        MXN: data.rates?.MXN ?? FALLBACK_RATES.MXN,
        ARS: data.rates?.ARS ?? FALLBACK_RATES.ARS,
      };
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
  const eurAmount = amount / rates[from];
  return eurAmount * rates[to];
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
