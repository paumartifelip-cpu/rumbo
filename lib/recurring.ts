import { convertAmount, Currency } from "./currency";
import { FinancialEntry, Task } from "./types";

export interface RecurringInput {
  tasks: Task[];
  finances: FinancialEntry[];
  deletedIds?: string[];
  primaryCurrency: Currency;
}

/**
 * Genera las instancias pendientes de tareas y gastos/ingresos recurrentes.
 * Pura: recibe "ahora" y el generador de ids, así se puede probar sin reloj ni
 * aleatoriedad. Devuelve el MISMO objeto `s` si no hay nada nuevo (para que React
 * no re-renderice), o una copia con las listas actualizadas.
 */
export function generateRecurring<S extends RecurringInput>(
  s: S,
  now: Date,
  newId: () => string
): S {
  const newTasks = [...s.tasks];
  const newFinances = [...s.finances];
  let hasNew = false;
  const todayStr = now.toISOString().slice(0, 10);
  const thisMonthStr = todayStr.slice(0, 7);

  // Deterministic id for a generated recurring finance instance. Using a
  // stable key (parent id + period) instead of a random uid makes
  // regeneration idempotent: running the generator twice — or on two
  // devices — produces the SAME id, so an upsert overwrites instead of
  // creating a duplicate. This is what prevents the double/triple counting.
  const tombstoned = new Set(s.deletedIds ?? []);
  const existingFinanceIds = new Set(newFinances.map((f) => f.id));
  // Month-level logical signature: a recurring instance must appear AT MOST
  // ONCE per month. This guards against duplicating a row that already
  // exists for the same month under a different (legacy random) id or on a
  // slightly different day — the real cause of the recurring duplication.
  const financeSig = (f: { type: string; title: string; amount: number; date: string }) =>
    `${f.type}|${f.title.trim().toLowerCase()}|${f.amount}|${f.date.slice(0, 7)}`;
  const existingFinanceSigs = new Set(newFinances.map(financeSig));
  const recurringChildId = (parentId: string, period: string) =>
    `${parentId}__rec__${period}`;
  const pushFinanceInstance = (instance: FinancialEntry) => {
    // Never recreate something the user deleted, and never duplicate an
    // instance that already exists — by id OR by logical signature.
    if (
      tombstoned.has(instance.id) ||
      existingFinanceIds.has(instance.id) ||
      existingFinanceSigs.has(financeSig(instance))
    ) {
      return;
    }
    existingFinanceIds.add(instance.id);
    existingFinanceSigs.add(financeSig(instance));
    newFinances.push(instance);
    hasNew = true;
  };

  s.tasks.forEach((t) => {
    if (!t.recurrence) return;
    const lastGen = t.last_generated_date ? t.last_generated_date.slice(0, 10) : t.created_at.slice(0, 10);
    let shouldGenerate = false;
    
    if (t.recurrence === "diaria" && lastGen < todayStr) {
      shouldGenerate = true;
    } else if (t.recurrence === "semanal") {
       const diff = now.getTime() - new Date(t.last_generated_date || t.created_at).getTime();
       if (diff >= 7 * 24 * 60 * 60 * 1000) shouldGenerate = true;
    } else if (t.recurrence === "mensual" && lastGen.slice(0, 7) < thisMonthStr) {
      shouldGenerate = true;
    }

    if (shouldGenerate) {
      // Guard: don't duplicate if a pending copy already exists
      const alreadyHasPending = newTasks.some(
        (x) => x.id !== t.id && x.title === t.title && x.status === "pendiente"
      );
      if (alreadyHasPending) return;

      const idx = newTasks.findIndex(x => x.id === t.id);
      if (idx >= 0) {
        newTasks[idx] = { ...newTasks[idx], last_generated_date: now.toISOString() };
      }
      const { recurrence, last_generated_date, ...taskWithoutRecurrence } = t;
      newTasks.push({
        ...taskWithoutRecurrence,
        id: newId(),
        created_at: now.toISOString(),
        status: "pendiente",
      });
      hasNew = true;
    }
  });

  const getMissedMonths = (lastGenStr: string, currentMonthStr: string): string[] => {
    const result: string[] = [];
    let [year, month] = lastGenStr.split("-").map(Number);
    const [curYear, curMonth] = currentMonthStr.split("-").map(Number);
    while (true) {
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
      if (year > curYear || (year === curYear && month > curMonth)) {
        break;
      }
      result.push(`${year}-${String(month).padStart(2, "0")}`);
    }
    return result;
  };

  const getMissedYears = (lastGenStr: string, currentYearStr: string): string[] => {
    const result: string[] = [];
    let year = Number(lastGenStr);
    const curYear = Number(currentYearStr);
    while (true) {
      year++;
      if (year > curYear) {
        break;
      }
      result.push(String(year));
    }
    return result;
  };

  s.finances.forEach((f) => {
    if (!f.recurrence) return;
    
    // Fallback to f.date instead of f.created_at so backdated recurring finances generate correctly
    const lastGen = f.last_generated_date ? f.last_generated_date.slice(0, 7) : f.date.slice(0, 7);
    const entryCurrency = f.currency ?? s.primaryCurrency;
    const currentPrimaryAmt = convertAmount(f.amount, entryCurrency, s.primaryCurrency);
    const { recurrence, last_generated_date, ...financeWithoutRecurrence } = f;

    if (f.recurrence === "mensual" && lastGen < thisMonthStr) {
      const missedMonths = getMissedMonths(lastGen, thisMonthStr);
      if (missedMonths.length > 0) {
        const idx = newFinances.findIndex(x => x.id === f.id);
        if (idx >= 0) {
          newFinances[idx] = { ...newFinances[idx], last_generated_date: now.toISOString() };
          hasNew = true;
        }
        missedMonths.forEach((monthStr) => {
          const origDate = new Date(f.date);
          const origDay = origDate.getDate();
          const [genYear, genMonth] = monthStr.split("-").map(Number);
          const genDate = new Date(origDate);
          genDate.setFullYear(genYear);
          genDate.setMonth(genMonth - 1, 1);
          const lastDay = new Date(genYear, genMonth, 0).getDate();
          genDate.setDate(Math.min(origDay, lastDay));

          pushFinanceInstance({
            ...financeWithoutRecurrence,
            id: recurringChildId(f.id, monthStr),
            date: genDate.toISOString(),
            amount_in_primary: currentPrimaryAmt,
            created_at: now.toISOString(),
          });
        });
      }
    } else if (f.recurrence === "anual") {
      const lastYear = f.last_generated_date ? f.last_generated_date.slice(0, 4) : f.date.slice(0, 4);
      const curYear = todayStr.slice(0, 4);
      if (lastYear < curYear) {
        const missedYears = getMissedYears(lastYear, curYear);
        if (missedYears.length > 0) {
          const idx = newFinances.findIndex(x => x.id === f.id);
          if (idx >= 0) {
            newFinances[idx] = { ...newFinances[idx], last_generated_date: now.toISOString() };
            hasNew = true;
          }
          missedYears.forEach((yearStr) => {
            const origDate = new Date(f.date);
            const origDay = origDate.getDate();
            const origMonth = origDate.getMonth();
            const genYear = Number(yearStr);
            const genDate = new Date(origDate);
            genDate.setFullYear(genYear);
            genDate.setMonth(origMonth, 1);
            const lastDay = new Date(genYear, origMonth + 1, 0).getDate();
            genDate.setDate(Math.min(origDay, lastDay));

            pushFinanceInstance({
              ...financeWithoutRecurrence,
              id: recurringChildId(f.id, yearStr),
              date: genDate.toISOString(),
              amount_in_primary: currentPrimaryAmt,
              created_at: now.toISOString(),
            });
          });
        }
      }
    }
  });

  if (hasNew) {
    return { ...s, tasks: newTasks, finances: newFinances };
  }
  return s;
}
