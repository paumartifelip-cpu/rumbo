import { Goal, Task } from "./types";

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// Lighter, faster model used only for expense categorization
const CATEGORIZE_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";

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

function getOpenAIKey(): string | null {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_OPENAI_API_KEY || null;
  return localStorage.getItem("rumbo_gpt_key") || process.env.NEXT_PUBLIC_OPENAI_API_KEY || null;
}

function getKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rumbo_gemini_key") || null;
}

async function callGemini<T>(
  prompt: string,
  temperature = 0.3,
  endpoint = ENDPOINT
): Promise<T | null> {
  const apiKey = getKey();
  if (!apiKey) return null;
  try {
    const res = await fetch(`${endpoint}?key=${apiKey}`, {
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

async function callOpenAI<T>(prompt: string, temperature = 0.3): Promise<T | null> {
  const apiKey = getOpenAIKey();
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", "content": prompt }],
        temperature,
        response_format: { type: "json_object" }
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function aiPrioritize(
  tasks: Task[],
  goals: Goal[],
  context: { current_money: number; monthly_target?: number }
): Promise<{ source: "openai" | "gemini"; data: GeminiPriorityResponse } | null> {
  const hasOpenAI = !!getOpenAIKey();
  const hasGemini = !!getKey();
  if (!hasOpenAI && !hasGemini) return null;
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
3. Penaliza fuertemente las tareas que parecen productivas pero no acercan al usuario a sus metas.
4. El MAYOR POTENCIAL y la máxima puntuación (85-100) DEBEN ser exclusivamente para tareas que generen ingresos económicos directos o que lleven a alcanzar de forma clave los objetivos principales.
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

  if (hasOpenAI) {
    const data = await callOpenAI<GeminiPriorityResponse>(prompt, 0.3);
    if (data) return { source: "openai", data };
  }
  
  if (hasGemini) {
    const data = await callGemini<GeminiPriorityResponse>(prompt, 0.3);
    if (data) return { source: "gemini", data };
  }

  return null;
}

/**
 * Fast rule-based categorizer. Returns null when no rule matches so the
 * caller knows it needs to fall back to AI.
 */
export function heuristicCategorize(title: string): string | null {
  const t = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  // Vivienda
  if (
    /(alquiler|hipoteca|comunidad|ibi|derrama|portero|ascensor|piso|casa|apartamento|habitacion|studio|flat|rent|mortgage|electricity|electric|luz|agua|calefaccion|caldera|gas natural|wifi|internet|fibra|router|modem|vodafone|movistar|orange|digi|yoigo|euskaltel)/.test(t)
  )
    return "Vivienda";

  // Comida (supermercados y alimentación)
  if (
    /(mercadona|carrefour|lidl|aldi|dia |eroski|consum|alcampo|hipercor|bonpreu|condis|covirán|spar|froiz|supercor|supermercado|fruteria|verduleria|carniceria|pescaderia|panaderia|pasteleria|charcuteria|colmado|ultramarinos|alimentacion|grocery|supermarket|glovo|just eat|deliveroo|uber eats|rappi|getir|gorillas)/.test(t)
  )
    return "Comida";

  // Restaurantes y bares
  if (
    /(restaurante|restaurant|bar |cafeteria|cafe |coffee|starbucks|mcdonalds|mcdonald|burger king|kfc|dominos|telepizza|pizza hut|subway|five guys|popeyes|foster|taco bell|tapas|bocadillo|bocata|menu del dia|cena|almuerzo|desayuno|brunch|sushi|ramen|kebab|chino|italiano|mexicano|hamburgues|poke|sандwich)/.test(t)
  )
    return "Restaurantes";

  // Transporte
  if (
    /(uber|cabify|bolt|taxi|blablacar|gasolina|gasolinera|repsol|bp |cepsa|shell|esso|carburante|fuel|metro|bus |autobus|renfe|ave |cercanias|fgc|emt |tmb|tram|bicing|nextbike|voi |lime |tier |peaje|autopista|parking|aparcamiento|garaje|itv|seguro.*coche|coche|moto|ciclomotor|patinete|bicicleta|vueling|iberia|ryanair|easyjet|wizz|air europa|level|transavia|ferry|barco|crucero|aerolinea|flight|avion)/.test(t)
  )
    return "Transporte";

  // Suscripciones y software
  if (
    /(netflix|hbo|max |disney|prime video|apple tv|mubi|filmin|rakuten|crunchyroll|spotify|apple music|tidal|deezer|youtube premium|twitch|patreon|chatgpt|openai|claude|anthropic|notion|obsidian|figma|adobe|photoshop|illustrator|premiere|lightroom|canva|sketch|framer|webflow|github|gitlab|vercel|netlify|heroku|aws |azure |google cloud|gcp |dropbox|icloud|onedrive|google one|1password|lastpass|bitwarden|nordvpn|expressvpn|linear|jira|asana|trello|slack|zoom|loom|calendly|typeform|airtable|hubspot|mailchimp|convertkit|substack|beehiiv|plus|pro |premium|plan |subscription|suscripcion|mensualidad|anualidad|licencia)/.test(t)
  )
    return "Suscripciones";

  // Salud y bienestar
  if (
    /(farmacia|medicamento|medicina|pastilla|receta|medico|doctor|consulta|clinica|hospital|dentista|ortodoncista|optica|gafas|lentillas|fisioterapia|psicólogo|psicologo|terapeuta|quiropractico|gym|gimnasio|crossfit|pilates|yoga|padel|tenis|natacion|running|maratón|maraton|suplemento|proteina|vitamina|health|wellness|sanitas|adeslas|asisa|dkv|mapfre salud|mutua)/.test(t)
  )
    return "Salud";

  // Compras y moda
  if (
    /(amazon|ebay|aliexpress|shein|zara|h&m|mango|bershka|stradivarius|pull.*bear|massimo dutti|el corte ingles|primark|lefties|calzedonia|intimissimi|decathlon|nike|adidas|puma|new balance|vans|converse|timberland|zalando|asos|farfetch|vinted|wallapop|fnac|media markt|pc componentes|phone house|apple store|ikea|leroy merlin|aki |bricomart|bauhaus|worten|ropa|zapatillas|zapatos|vestido|pantalon|camisa|chaqueta|abrigo|complementos|bolso|cartera|reloj|joya|mueble|sofa|cama|colchon|electrodomestico|nevera|lavadora|secadora|microondas|television|movil|ordenador|portatil|tablet|auriculares|altavoz|camara)/.test(t)
  )
    return "Compras";

  // Ocio y entretenimiento
  if (
    /(cine|teatro|museo|concierto|festival|espectaculo|entrada|ticketmaster|viagogo|eventbrite|bowling|escape room|karting|lasertag|parque.*atrac|parque.*acuat|zoo|aquarium|arcade|videojuego|steam|playstation|xbox|nintendo|ps5|ps4|switch|juego|hobby|manualidades|pintura|fotografia)/.test(t)
  )
    return "Ocio";

  // Viajes y alojamiento
  if (
    /(hotel|hostal|pension|airbnb|booking|trivago|edreams|rumbo|lastminute|viaje|vacacion|vacation|holiday|travel|turismo|excursion|tour|crucero|resort|spa |balneario|camping|glamping)/.test(t)
  )
    return "Viajes";

  // Educación
  if (
    /(udemy|coursera|linkedin learning|masterclass|domestika|platzi|skillshare|duolingo|babbel|academia|curso|formacion|máster|master|universidad|colegio|escuela|libro|libros|amazon kindle|audible|fnac.*libro|libreria|material escolar|clase particular)/.test(t)
  )
    return "Educación";

  // Finanzas y seguros
  if (
    /(seguro|aseguradora|mapfre|allianz|axa|generali|zurich|mutua|fondo|pension|inversion|broker|trading|comision bancaria|transferencia|tarjeta|cuota.*banco|mantenimiento.*cuenta|prestamo|credito|hipoteca|interes|asesor)/.test(t)
  )
    return "Finanzas";

  return null; // no match → let AI decide
}

/**
 * Makes a minimal 1-token call to verify the OpenAI key works.
 * Returns "ok", "no_key", or "error:<message>".
 */
export async function verifyOpenAI(): Promise<"ok" | "no_key" | string> {
  const apiKey = getOpenAIKey();
  if (!apiKey) return "no_key";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "di hola" }],
        max_tokens: 3,
        temperature: 0,
      }),
    });
    if (res.ok) return "ok";
    const err = await res.json().catch(() => ({}));
    return `error:${err?.error?.message ?? res.statusText}`;
  } catch (e: any) {
    return `error:${e?.message ?? "network error"}`;
  }
}

export async function aiCategorize(input: {
  title: string;
  amount?: number;
  existing_categories?: string[];
}): Promise<string | null> {
  // Rule-based first — instant, no API call needed
  const fast = heuristicCategorize(input.title);
  if (fast !== null) return fast;

  // Nothing matched → fall back to AI with the lightest/fastest model
  const hasOpenAI = !!getOpenAIKey();
  const hasGemini = !!getKey();
  if (!hasOpenAI && !hasGemini) return null;

  const prompt = `Clasifica este gasto personal en UNA categoría corta (1-2 palabras) en español.
Si alguna de las categorías existentes encaja, reutilízala exactamente igual.
Categorías existentes: ${JSON.stringify(input.existing_categories ?? [])}
Gasto: "${input.title}"${input.amount ? ` — ${input.amount}` : ""}
Responde SOLO con JSON: { "category": "..." }`;

  if (hasOpenAI) {
    const r = await callOpenAI<{ category: string }>(prompt, 0.1);
    if (r?.category) return r.category.trim();
  }

  if (hasGemini) {
    const r = await callGemini<{ category: string }>(prompt, 0.1, CATEGORIZE_ENDPOINT);
    if (r?.category) return r.category.trim();
  }

  return null;
}
