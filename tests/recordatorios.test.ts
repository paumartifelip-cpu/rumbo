import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

// Prueba la decisión de A QUIÉN avisar y CUÁNDO (public.recordatorios_pendientes) con horas
// inventadas, personas en varias ciudades y zonas horarias, gastos de hoy y de ayer.
// Corre en una base de datos de mentira en memoria; es la misma función que se publica.

const SQL = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const ESTRUCTURA_SUPABASE = `
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
  end $$;
  create publication supabase_realtime;
`;

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(ESTRUCTURA_SUPABASE);
  await db.exec(SQL);
}, 60_000);

beforeEach(async () => {
  await db.exec("delete from public.financial_entries; delete from public.notification_prefs;");
});

const ID = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

async function persona(n: number, o: { hora?: string; zona?: string; activo?: boolean; saltar?: boolean; ultimo?: string | null } = {}) {
  await db.query(
    `insert into public.notification_prefs (user_id, reminder_enabled, reminder_time, timezone, skip_if_logged, last_reminder_on)
     values ($1,$2,$3,$4,$5,$6)`,
    [ID(n), o.activo ?? true, o.hora ?? "21:00", o.zona ?? "UTC", o.saltar ?? true, o.ultimo ?? null]
  );
}
async function gasto(n: number, creado: string, id = `g-${Math.random()}`) {
  await db.query(
    `insert into public.financial_entries (id, user_id, type, title, amount, created_at) values ($1,$2,'gasto','x',1,$3)`,
    [id, ID(n), creado]
  );
}
/** Quién tiene recordatorio pendiente en el instante `ahora` (UTC). */
async function pendientes(ahora: string) {
  const r = await db.query<{ usuario: string; fecha_local: string; hora_local: string }>(
    `select usuario, fecha_local::text, hora_local from public.recordatorios_pendientes($1::timestamptz) order by usuario`, [ahora]
  );
  return r.rows;
}
const ids = (r: { usuario: string }[]) => r.map((x) => x.usuario);

describe("la hora local de cada persona (cada una en su ciudad)", () => {
  it("Asunción (UTC−3), recordatorio a las 21:00: avisa entre las 21:00 y las 21:59 locales, y no antes ni después", async () => {
    await persona(1, { hora: "21:00", zona: "America/Asuncion" });
    expect(ids(await pendientes("2026-10-07T23:59:00Z")), "20:59 local: aún no").toEqual([]);
    expect(ids(await pendientes("2026-10-08T00:00:00Z")), "21:00 local: sí").toEqual([ID(1)]);
    expect(ids(await pendientes("2026-10-08T00:59:00Z")), "21:59 local: sí").toEqual([ID(1)]);
    expect(ids(await pendientes("2026-10-08T01:00:00Z")), "22:00 local: ya tarde").toEqual([]);
  });

  it("devuelve el día y la hora LOCALES de la persona, no los de UTC", async () => {
    await persona(1, { hora: "21:00", zona: "America/Asuncion" });
    const r = await pendientes("2026-10-08T00:10:00Z"); // en UTC ya es 8 de octubre; en Asunción, 7 a las 21:10
    expect(r).toEqual([{ usuario: ID(1), fecha_local: "2026-10-07", hora_local: "21:10" }]);
  });

  it("tres personas con la misma hora pero en ciudades distintas reciben el aviso a horas distintas", async () => {
    await persona(1, { hora: "21:00", zona: "Europe/Madrid" }); // octubre: UTC+2 → 19:00Z
    await persona(2, { hora: "21:00", zona: "America/Asuncion" }); // UTC−3 → 00:00Z
    await persona(3, { hora: "21:00", zona: "America/Mexico_City" }); // UTC−6 → 03:00Z
    expect(ids(await pendientes("2026-10-07T19:05:00Z"))).toEqual([ID(1)]);
    expect(ids(await pendientes("2026-10-08T00:05:00Z"))).toEqual([ID(2)]);
    expect(ids(await pendientes("2026-10-08T03:05:00Z"))).toEqual([ID(3)]);
    expect(ids(await pendientes("2026-10-07T12:00:00Z")), "a mediodía UTC, nadie").toEqual([]);
  });

  it("cambio de hora en España (25 oct 2026, de verano a invierno): sigue avisando a las 21:00 locales", async () => {
    await persona(1, { hora: "21:00", zona: "Europe/Madrid" });
    expect(ids(await pendientes("2026-10-24T19:05:00Z")), "víspera, UTC+2").toEqual([ID(1)]);
    expect(ids(await pendientes("2026-10-25T20:05:00Z")), "día del cambio, ya UTC+1 → 21:05 local").toEqual([ID(1)]);
    expect(ids(await pendientes("2026-10-25T19:05:00Z")), "19:05Z ya serían las 20:05 locales").toEqual([]);
  });

  it("hora tardía (23:30): avisa hasta la medianoche, nunca cruza al día siguiente", async () => {
    await persona(1, { hora: "23:30", zona: "UTC" });
    expect(ids(await pendientes("2026-10-07T23:45:00Z"))).toEqual([ID(1)]);
    expect(ids(await pendientes("2026-10-08T00:10:00Z")), "00:10 del día siguiente: no es «hoy»").toEqual([]);
  });
});

describe("no avisar dos veces el mismo día", () => {
  it("si ya se le avisó hoy (en su día local), no toca; si fue ayer, sí", async () => {
    await persona(1, { zona: "America/Asuncion", ultimo: "2026-10-07" });
    await persona(2, { zona: "America/Asuncion", ultimo: "2026-10-06" });
    expect(ids(await pendientes("2026-10-08T00:10:00Z"))).toEqual([ID(2)]);
  });

  it("«hoy» es el día LOCAL: a las 00:10Z del día 8 sigue siendo el 7 en Asunción", async () => {
    await persona(1, { zona: "America/Asuncion", ultimo: "2026-10-08" }); // marcado con el día UTC por error: no debe frenar
    expect(ids(await pendientes("2026-10-08T00:10:00Z"))).toEqual([ID(1)]);
  });
});

describe("«no avisarme si ya he apuntado algo hoy»", () => {
  it("con gasto apuntado hoy (su día local): no avisa", async () => {
    await persona(1, { zona: "America/Asuncion", saltar: true });
    await gasto(1, "2026-10-07T15:00:00Z"); // 12:00 locales del día 7
    expect(ids(await pendientes("2026-10-08T00:10:00Z"))).toEqual([]);
  });

  it("con gasto de ayer: sí avisa", async () => {
    await persona(1, { zona: "America/Asuncion", saltar: true });
    await gasto(1, "2026-10-06T15:00:00Z");
    expect(ids(await pendientes("2026-10-08T00:10:00Z"))).toEqual([ID(1)]);
  });

  it("el gasto de las 02:00Z del día 8 es de la noche del día 7 en Asunción: cuenta como de hoy", async () => {
    await persona(1, { zona: "America/Asuncion", saltar: true });
    await gasto(1, "2026-10-08T00:05:00Z"); // 21:05 del 7
    expect(ids(await pendientes("2026-10-08T00:10:00Z"))).toEqual([]);
  });

  it("si NO marcó la casilla, avisa aunque haya apuntado hoy", async () => {
    await persona(1, { zona: "America/Asuncion", saltar: false });
    await gasto(1, "2026-10-07T15:00:00Z");
    expect(ids(await pendientes("2026-10-08T00:10:00Z"))).toEqual([ID(1)]);
  });

  it("los gastos fijos que la app genera sola (__rec__) NO cuentan como «haber apuntado»", async () => {
    await persona(1, { zona: "America/Asuncion", saltar: true });
    await gasto(1, "2026-10-07T15:00:00Z", "alquiler__rec__2026-10");
    expect(ids(await pendientes("2026-10-08T00:10:00Z"))).toEqual([ID(1)]);
  });

  it("los gastos de OTRA persona no afectan", async () => {
    await persona(1, { zona: "America/Asuncion", saltar: true });
    await persona(2, { zona: "America/Asuncion", saltar: true });
    await gasto(2, "2026-10-07T15:00:00Z");
    expect(ids(await pendientes("2026-10-08T00:10:00Z"))).toEqual([ID(1)]);
  });
});

describe("casos raros", () => {
  it("recordatorio apagado: nunca avisa", async () => {
    await persona(1, { zona: "America/Asuncion", activo: false });
    expect(ids(await pendientes("2026-10-08T00:10:00Z"))).toEqual([]);
  });

  it("una zona horaria inventada en UNA fila no rompe el aviso a las demás", async () => {
    await persona(1, { zona: "Marte/Olympus" });
    await persona(2, { zona: "America/Asuncion" });
    await persona(3, { zona: "" });
    expect(ids(await pendientes("2026-10-08T00:10:00Z"))).toEqual([ID(2)]);
  });

  it("sin nadie con recordatorio, devuelve vacío sin fallar", async () => {
    expect(await pendientes("2026-10-08T00:10:00Z")).toEqual([]);
  });

  it("la función no es llamable por usuarios de la web, solo por el servidor", async () => {
    const r = await db.query<{ anon: boolean; auth: boolean; servidor: boolean }>(
      `select has_function_privilege('anon','public.recordatorios_pendientes(timestamptz)','execute') as anon,
              has_function_privilege('authenticated','public.recordatorios_pendientes(timestamptz)','execute') as auth,
              has_function_privilege('service_role','public.recordatorios_pendientes(timestamptz)','execute') as servidor`
    );
    expect(r.rows[0]).toEqual({ anon: false, auth: false, servidor: true });
  });
});
