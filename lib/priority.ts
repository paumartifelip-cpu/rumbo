import { Goal, Task } from "./types";

// Heuristic fallback when Gemini is not configured.
export function localPrioritize(tasks: Task[], goals: Goal[]) {
  const goalById = new Map(goals.map((g) => [g.id, g]));

  const scored = tasks
    .filter((t) => t.status !== "completada" && t.status !== "descartada")
    .map((t) => {
      const goal = t.goal_id ? goalById.get(t.goal_id) : undefined;
      const importance = goal?.importance ?? 5;
      const money = Math.min(100, (t.money_impact ?? 0) / 50);
      const urgency = (t.urgency ?? 3) * 8;
      const energyPenalty = t.energy_level === "baja" ? 5 : 0;
      const aligned = goal?.status === "activo" ? 10 : -10;

      const raw =
        importance * 4 + money * 0.6 + urgency + aligned - energyPenalty;
      const score = Math.max(0, Math.min(100, Math.round(raw)));

      const reason = buildReason(t, goal, score);
      return { task: t, score, reason, goal };
    })
    .sort((a, b) => b.score - a.score);

  const distractions = scored.filter((s) => s.score < 30);
  const top = scored.filter((s) => s.score >= 30);

  return {
    ordered: scored,
    top,
    distractions,
    today_focus: top[0]
      ? `Hoy enfócate en: "${top[0].task.title}". ${top[0].reason}`
      : "Define una primera tarea concreta para hoy y empieza por la más pequeña.",
    financial_advice: buildFinancialAdvice(goals),
  };
}

function buildReason(task: Task, goal?: Goal, score?: number) {
  if (!goal)
    return "Sin objetivo asociado. Conéctala a un objetivo para que tenga más impacto.";
  if ((task.money_impact ?? 0) >= 500)
    return `Tiene impacto económico directo (~${task.money_impact} €) sobre "${goal.title}".`;
  if ((score ?? 0) < 30)
    return `Parece productiva pero no acerca al objetivo "${goal.title}".`;
  return `Avanza directamente tu objetivo "${goal.title}" (importancia ${goal.importance}/10).`;
}

function buildFinancialAdvice(goals: Goal[]) {
  const money = goals.find(
    (g) => g.category === "dinero" && g.target_amount && g.status === "activo"
  );
  if (!money || !money.target_amount) return "Define un objetivo económico claro para medir tu avance.";
  const current = money.current_amount ?? 0;
  const diff = Math.max(0, money.target_amount - current);
  if (diff === 0) return "¡Has alcanzado tu objetivo económico! Define el siguiente.";
  return `Te faltan ${Math.round(diff)} € para llegar a tu objetivo "${money.title}". Prioriza tareas con impacto económico directo.`;
}
