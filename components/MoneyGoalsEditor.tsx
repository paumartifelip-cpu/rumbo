"use client";

import { useState } from "react";
import { Card, SectionTitle } from "./Card";
import { useFormatMoney, useRumbo } from "@/lib/store";
import { OnboardingData } from "@/lib/types";
import { CURRENCIES } from "@/lib/currency";

export function MoneyGoalsEditor() {
  const { onboarding, updateOnboarding } = useRumbo();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<OnboardingData>>({
    current_money: onboarding?.current_money ?? 0,
    total_target: onboarding?.total_target ?? 0,
    current_monthly_income: onboarding?.current_monthly_income ?? 0,
    monthly_target: onboarding?.monthly_target ?? 0,
    target_date: onboarding?.target_date ?? new Date().toISOString(),
  });

  function open() {
    setForm({
      current_money: onboarding?.current_money ?? 0,
      total_target: onboarding?.total_target ?? 0,
      current_monthly_income: onboarding?.current_monthly_income ?? 0,
      monthly_target: onboarding?.monthly_target ?? 0,
      target_date: onboarding?.target_date ?? new Date().toISOString(),
    });
    setEditing(true);
  }

  function save() {
    updateOnboarding(form);
    setEditing(false);
  }

  return (
    <Card>
      <SectionTitle
        title="Mis objetivos económicos"
        hint="Estos son los cuatro números que la app usa para todo. Cámbialos cuando quieras."
        action={
          !editing ? (
            <button onClick={open} className="btn-soft">
              Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="btn-ghost"
              >
                Cancelar
              </button>
              <button onClick={save} className="btn-primary">
                Guardar
              </button>
            </div>
          )
        }
      />

      {!editing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReadRow
            label="Tienes en total"
            value={onboarding?.current_money ?? 0}
          />
          <ReadRow
            label="Quieres tener en total"
            value={onboarding?.total_target ?? 0}
          />
          <ReadRow
            label="Cobras al mes"
            value={onboarding?.current_monthly_income ?? 0}
            suffix="/ mes"
          />
          <ReadRow
            label="Quieres ganar al mes"
            value={onboarding?.monthly_target ?? 0}
            suffix="/ mes"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Tienes en total"
            value={form.current_money ?? 0}
            onChange={(v) => setForm({ ...form, current_money: v })}
          />
          <Field
            label="Quieres tener en total"
            value={form.total_target ?? 0}
            onChange={(v) => setForm({ ...form, total_target: v })}
          />
          <Field
            label="Cobras al mes"
            value={form.current_monthly_income ?? 0}
            onChange={(v) => setForm({ ...form, current_monthly_income: v })}
          />
          <Field
            label="Quieres ganar al mes"
            value={form.monthly_target ?? 0}
            onChange={(v) => setForm({ ...form, monthly_target: v })}
          />
          <div className="md:col-span-2">
            <label className="label">Fecha objetivo</label>
            <input
              type="date"
              className="input mt-1"
              value={(form.target_date ?? "").slice(0, 10)}
              onChange={(e) =>
                setForm({
                  ...form,
                  target_date: new Date(e.target.value).toISOString(),
                })
              }
            />
          </div>
        </div>
      )}
    </Card>
  );
}

function ReadRow({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  const formatMoney = useFormatMoney();
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-rumbo-muted">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <div className="text-xl font-semibold">{formatMoney(value)}</div>
        {suffix && <span className="text-xs text-rumbo-muted">{suffix}</span>}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const { primaryCurrency } = useRumbo();
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative mt-1">
        <input
          type="number"
          inputMode="numeric"
          className="input pr-8 text-lg font-semibold"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rumbo-muted text-sm">
          {CURRENCIES[primaryCurrency].symbol}
        </span>
      </div>
    </div>
  );
}
