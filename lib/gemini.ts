import { Goal, Task } from "./types";

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

interface GeminiPriorityResponse {
  ordered_tasks: Array<{
    task_id: string;
    priority_score: number;
    reason: string;
    next_action?: string;
    risk_if_skipped?: string;
  }>;
  distractions: Array<{ task_id: string; reason: string }>;
  financial_advice: string;
  today_focus: string;
}

export async function geminiPrioritize(
  tasks: Task[],
  goals: Goal[],
  context: { current_money: number; monthly_target?: number },
  keyOverride?: string
): Promise<GeminiPriorityResponse | null> {
  const apiKey = keyOverride || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = buildPrompt(tasks, goals, context);

  try {
    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      data?.candidates?.[0]?.content?.parts?.[0] ??
      null;
    if (!text) return null;
    const parsed = JSON.parse(typeof text === "string" ? text : JSON.stringify(text));
    return parsed as GeminiPriorityResponse;
  } catch {
    return null;
  }
}

function buildPrompt(
  tasks: Task[],
  goals: Goal[],
  context: { current_money: number; monthly_target?: number }
) {
  const today = new Date().toISOString().slice(0, 10);

  const simpleTasks = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description ?? null,
    goal_id: t.goal_id ?? null,
  }));

  const simpleGoals = goals.map((g) => ({
    id: g.id,
    title: g.title,
    category: g.category,
    importance: g.importance,
    target_amount: g.target_amount ?? null,
    current_amount: g.current_amount ?? null,
    deadline: g.deadline ?? null,
    status: g.status,
  }));

  return `Eres un asistente experto en foco, productividad, negocio y dinero.
Las tareas pueden estar escritas o dictadas en lenguaje natural — interprétalas tú.
Tu trabajo:
1. Entiende cada tarea aunque esté mal escrita o sea muy corta.
2. Estima su impacto real (0-100) en los objetivos del usuario.
3. Penaliza tareas que parecen productivas pero no acercan al usuario a sus metas (puntuación baja).
4. Premia las que generan dinero, clientes, aprendizaje aplicado o desbloquean objetivos importantes.
5. Da una razón corta y concreta (máx 1 frase) por la que merece esa puntuación.

Fecha actual: ${today}
Dinero actual del usuario: ${context.current_money} €
Objetivo económico mensual: ${context.monthly_target ?? "—"} €

Objetivos del usuario:
${JSON.stringify(simpleGoals, null, 2)}

Tareas a evaluar:
${JSON.stringify(simpleTasks, null, 2)}

Devuelve SOLO un JSON válido con esta forma exacta (todas las tareas deben aparecer en ordered_tasks):
{
  "ordered_tasks": [
    { "task_id": "id", "priority_score": 0-100, "reason": "frase corta", "next_action": "primer micro-paso", "risk_if_skipped": "qué pasa si no se hace" }
  ],
  "distractions": [ { "task_id": "id", "reason": "por qué es distracción" } ],
  "financial_advice": "consejo concreto sobre el dinero del usuario",
  "today_focus": "una frase diciéndole exactamente qué hacer hoy primero"
}

No incluyas texto adicional fuera del JSON.`;
}
