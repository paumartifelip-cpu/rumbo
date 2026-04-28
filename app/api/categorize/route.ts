import { NextResponse } from "next/server";

export const runtime = "edge";

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      title: string;
      amount?: number;
      existing_categories?: string[];
    };

    const userKey = req.headers.get("x-gemini-key") ?? undefined;
    const apiKey = userKey || process.env.GEMINI_API_KEY;

    // Fallback heurístico si no hay clave.
    if (!apiKey) {
      return NextResponse.json({
        ok: true,
        source: "fallback",
        category: heuristic(body.title),
      });
    }

    const prompt = `Eres un clasificador de gastos personales en español.
Te paso el concepto de un gasto y su importe. Tu trabajo es asignarle UNA categoría corta (1-2 palabras), en singular, en español, que tenga sentido.
Si la lista de categorías existentes ya contiene una que encaje, REUTILÍZALA tal cual (mismo texto, mismas mayúsculas).
Si ninguna encaja, inventa una nueva categoría útil y compacta.

Categorías existentes: ${JSON.stringify(body.existing_categories ?? [])}
Concepto: "${body.title}"
Importe: ${body.amount ?? "?"} €

Devuelve SOLO un JSON válido con esta forma exacta:
{ "category": "..." }
Sin texto adicional.`;

    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    });
    if (!res.ok) {
      return NextResponse.json({
        ok: true,
        source: "fallback",
        category: heuristic(body.title),
      });
    }
    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      data?.candidates?.[0]?.content?.parts?.[0] ??
      null;
    if (!text) {
      return NextResponse.json({
        ok: true,
        source: "fallback",
        category: heuristic(body.title),
      });
    }
    const parsed = JSON.parse(typeof text === "string" ? text : JSON.stringify(text));
    const category = String(parsed.category ?? "").trim() || heuristic(body.title);
    return NextResponse.json({ ok: true, source: "gemini", category });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

function heuristic(title: string): string {
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
