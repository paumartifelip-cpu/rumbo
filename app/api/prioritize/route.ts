import { NextResponse } from "next/server";
import { geminiPrioritize } from "@/lib/gemini";
import { Goal, Task } from "@/lib/types";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      tasks: Task[];
      goals: Goal[];
      current_money?: number;
      monthly_target?: number;
    };

    // Permite enviar la clave desde el cliente (localStorage) vía header.
    const userKey = req.headers.get("x-gemini-key") ?? undefined;
    const key = userKey || process.env.GEMINI_API_KEY;

    const result = await geminiPrioritize(
      body.tasks,
      body.goals,
      {
        current_money: body.current_money ?? 0,
        monthly_target: body.monthly_target,
      },
      key
    );

    if (!result) {
      return NextResponse.json({ ok: false, source: "fallback" }, { status: 200 });
    }
    return NextResponse.json({ ok: true, source: "gemini", data: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
