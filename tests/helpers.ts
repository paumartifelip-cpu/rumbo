import type { FinancialEntry, Task } from "@/lib/types";

export const fin = (over: Partial<FinancialEntry> & { id: string }): FinancialEntry => ({
  user_id: "u",
  type: "gasto",
  title: "Concepto",
  amount: 10,
  date: "2026-10-06T12:00:00.000Z",
  created_at: "2026-10-06T12:00:00.000Z",
  ...over,
});

export const task = (over: Partial<Task> & { id: string }): Task => ({
  user_id: "u",
  title: "Tarea",
  status: "pendiente",
  created_at: "2026-10-01T12:00:00.000Z",
  ...over,
});

/** Generador de ids predecible: t1, t2, t3… */
export const seqIds = () => {
  let n = 0;
  return () => `t${++n}`;
};
