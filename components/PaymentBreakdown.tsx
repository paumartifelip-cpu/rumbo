"use client";

import { useMemo } from "react";
import { Card, SectionTitle } from "@/components/Card";
import {
  PAYMENT_METHODS,
  PayFilter,
  spendByPayment,
} from "@/lib/paymentMethods";
import { useFormatMoney, useRumbo } from "@/lib/store";
import { FinancialEntry } from "@/lib/types";

const META = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.key, m]));

// Desglose del mes por forma de pago. Solo aparece si algún gasto indica
// método: sin datos sería una tarjeta vacía que no aporta nada.
export function PaymentBreakdownCard({
  items,
  filter,
  onFilter,
}: {
  items: FinancialEntry[];
  filter: PayFilter;
  onFilter: (f: PayFilter) => void;
}) {
  const { amountInPrimary } = useRumbo();
  const format = useFormatMoney();
  const { slices, total } = useMemo(() => spendByPayment(items, amountInPrimary), [items, amountInPrimary]);

  if (!items.some((f) => f.payment_method)) return null;

  const pick = (f: PayFilter) => {
    const same = filter && f && filter.method === f.method && filter.account === f.account;
    onFilter(same ? null : f);
    if (!same) document.getElementById("movimientos")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Card className="card-hover">
      <SectionTitle title="¿Con qué pagas?" hint="Toca un método para ver solo esos gastos." />
      <div className="mt-3 flex flex-col gap-4">
        {slices.map((s) => {
          const none = s.key === "none";
          const m = none ? null : META[s.key];
          const pct = total > 0 ? (s.total / total) * 100 : 0;
          const active = filter?.method === s.key && !filter.account;
          return (
            <div key={s.key}>
              <button
                type="button"
                onClick={() => pick({ method: s.key })}
                aria-pressed={active}
                className={`w-full text-left rounded-xl -mx-2 px-2 py-1 transition-colors ${active ? "bg-slate-100" : "hover:bg-slate-50"}`}
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className={`font-medium ${none ? "text-rumbo-muted" : "text-rumbo-ink"}`}>
                    {none ? "➖ Sin indicar" : `${m!.icon} ${m!.label}`}
                    <span className="text-xs font-normal text-rumbo-muted ml-1.5">
                      {s.count} {s.count === 1 ? "gasto" : "gastos"}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-rumbo-muted font-medium">{Math.round(pct)}%</span>
                    <span className="font-bold tabular-nums">{format(s.total)}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${none ? "bg-slate-300" : "bg-indigo-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>

              {s.accounts.length > 0 && (
                <div className="mt-1.5 ml-3 pl-3 border-l-2 border-rumbo-line flex flex-col gap-1">
                  {s.accounts.map((a) => {
                    const on = filter?.method === s.key && filter.account?.toLowerCase() === a.name.toLowerCase();
                    return (
                      <button
                        key={a.name}
                        type="button"
                        onClick={() => pick({ method: s.key, account: a.name })}
                        aria-pressed={on}
                        className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-xs transition-colors ${on ? "bg-slate-100" : "hover:bg-slate-50"}`}
                      >
                        <span className="text-rumbo-muted">
                          {a.name} · {a.count} {a.count === 1 ? "gasto" : "gastos"}
                        </span>
                        <span className="font-semibold text-rumbo-ink tabular-nums">{format(a.total)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
