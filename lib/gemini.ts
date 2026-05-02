import { Goal, Task } from "./types";

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export interface GeminiPriorityResponse {
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

function getKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rumbo_gemini_key") || null;
}

async function callGemini<T>(
  prompt: string,
  temperature = 0.3
): Promise<T | null> {
  const apiKey = getKey();
  if (!apiKey) return null;
  try {
    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature,
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
    return JSON.parse(typeof text === "string" ? text : JSON.stringify(text)) as T;
  } catch {
    return null;
  }
}

export async function geminiPrioritize(
  tasks: Task[],
  goals: Goal[],
  context: { current_money: number; monthly_target?: number }
): Promise<GeminiPriorityResponse | null> {
  if (!getKey()) return null;
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

  const prompt = `Eres un asistente experto en foco, productividad, negocio y dinero.
Las tareas pueden estar escritas o dictadas en lenguaje natural — interprétalas tú.
Tu trabajo:
1. Entiende cada tarea aunque esté mal escrita o sea muy corta.
2. Estima su impacto real (0-100) en los objetivos del usuario. Sé riguroso, coherente y NADA aleatorio.
3. Penaliza tareas que parecen productivas pero no acercan al usuario a sus metas (puntuación baja).
4. Premia las que generan dinero, clientes, aprendizaje aplicado o desbloquean objetivos importantes.
5. Da una razón más detallada (2-3 frases) explicando claramente por qué merece esa puntuación, cómo impacta en sus objetivos a corto/largo plazo, y qué pasaría si no se hace. Sé persuasivo y claro.

Fecha actual: ${today}
Dinero actual del usuario: ${context.current_money} €
Objetivo económico mensual: ${context.monthly_target ?? "—"} €

Objetivos del usuario:
${JSON.stringify(simpleGoals, null, 2)}

Tareas a evaluar:
${JSON.stringify(simpleTasks, null, 2)}

Devuelve SOLO un JSON válido con esta forma exacta. CRÍTICO: debes devolver EXACTAMENTE una entrada en "ordered_tasks" por cada tarea que se te pasa, usando su "id" original. No omitas ninguna.
{
  "ordered_tasks": [
    { "task_id": "id", "priority_score": 0-100, "reason": "razonamiento detallado", "next_action": "primer micro-paso", "risk_if_skipped": "qué pasa si no se hace" }
  ],
  "distractions": [ { "task_id": "id", "reason": "por qué es distracción" } ],
  "financial_advice": "consejo concreto sobre el dinero del usuario",
  "today_focus": "una frase diciéndole exactamente qué hacer hoy primero"
}

No incluyas texto adicional fuera del JSON.`;

  return callGemini<GeminiPriorityResponse>(prompt, 0.3);
}

export async function geminiCategorize(input: {
  title: string;
  amount?: number;
  existing_categories?: string[];
}): Promise<string | null> {
  if (!getKey()) return null;
  const prompt = `Eres un clasificador de gastos personales en español.
Te paso el concepto de un gasto y su importe. Tu trabajo es asignarle UNA categoría corta (1-2 palabras), en singular, en español, que tenga sentido.
Si la lista de categorías existentes ya contiene una que encaje, REUTILÍZALA tal cual (mismo texto, mismas mayúsculas).
Si ninguna encaja, inventa una nueva categoría útil y compacta.

Categorías existentes: ${JSON.stringify(input.existing_categories ?? [])}
Concepto: "${input.title}"
Importe: ${input.amount ?? "?"} €

Devuelve SOLO un JSON válido con esta forma exacta:
{ "category": "..." }
Sin texto adicional.`;
  const r = await callGemini<{ category: string }>(prompt, 0.2);
  return r?.category?.trim() || null;
}

// Heuristic fallback used when there's no API key.
export function heuristicCategorize(title: string): string {
  const t = title.toLowerCase();
  if (/(alquiler|hipoteca|piso|casa|comunidad|ibi|luz|agua|gas|wifi|internet|electric)/.test(t))
    return "Vivienda";
  if (/(super|mercadona|carrefour|lidl|comida|supermercado|fruta|carniceria)/.test(t))
    return "Comida";
  if (/(restaurante|bar|cena|menu|tapas|bocata)/.test(t)) return "Restaurantes";
  if (/(uber|cabify|taxi|gasolin|metro|bus|tren|renfe|peaje|park)/.test(t))
    return "Transporte";
  if (/(netflix|spotify|hbo|prime|disney|youtube|chatgpt|notion|figma|adobe|github|saas)/.test(t))
    return "Suscripciones";
  if (/(medico|farma|gimnasio|gym|dentista|salud|crossfit)/.test(t))
    return "Salud";
  if (/(amazon|zalando|ropa|zapat|nike|adidas)/.test(t)) return "Compras";
  if (/(cine|concierto|viaje|hotel|booking|airbnb|vacacion)/.test(t))
    return "Ocio";
  return "Otros";
}
