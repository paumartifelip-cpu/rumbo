import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

// Comprueba que supabase/schema.sql reconstruye la base de datos REAL de producción
// (estructura leída el 2026-10-07). Si alguien cambia la base de datos y no actualiza el
// archivo (o al revés), esta prueba falla. Corre en una base de datos de mentira en memoria.

const SQL = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

// Piezas que en Supabase ya existen y aquí hay que simular.
const ESTRUCTURA_SUPABASE = `
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  end $$;
  create publication supabase_realtime;
`;

// columna | tipo | ¿admite vacío? | valor por defecto
type Col = [string, string, "YES" | "NO", string | null];
const TS = "timestamp with time zone";
const REAL: Record<string, Col[]> = {
  profiles: [
    ["user_id", "uuid", "NO", null], ["name", "text", "YES", null], ["email", "text", "YES", null],
    ["current_money", "numeric", "YES", "0"], ["total_target", "numeric", "YES", "0"],
    ["current_monthly_income", "numeric", "YES", "0"], ["monthly_target", "numeric", "YES", "0"],
    ["target_date", TS, "YES", null], ["updated_at", TS, "YES", "now()"], ["primary_currency", "text", "YES", null],
    ["profile_id", "text", "YES", null], ["emoji", "text", "YES", null], ["color", "text", "YES", null],
    ["initials", "text", "YES", null], ["income_type", "text", "YES", null], ["pin_hash", "text", "YES", null],
  ],
  goals: [
    ["id", "text", "NO", null], ["user_id", "uuid", "NO", null], ["title", "text", "NO", null],
    ["description", "text", "YES", null], ["category", "text", "NO", null], ["target_amount", "numeric", "YES", null],
    ["current_amount", "numeric", "YES", "0"], ["deadline", TS, "YES", null], ["importance", "integer", "YES", "5"],
    ["status", "text", "YES", "'activo'::text"], ["progress", "integer", "YES", "0"], ["created_at", TS, "YES", "now()"],
    ["timeframe", "text", "YES", null], ["unit", "text", "YES", null],
  ],
  tasks: [
    ["id", "text", "NO", null], ["user_id", "uuid", "NO", null], ["goal_id", "text", "YES", null],
    ["title", "text", "NO", null], ["description", "text", "YES", null], ["due_date", TS, "YES", null],
    ["estimated_minutes", "integer", "YES", null], ["energy_level", "text", "YES", null], ["difficulty", "integer", "YES", null],
    ["urgency", "integer", "YES", null], ["money_impact", "numeric", "YES", "0"], ["ai_priority_score", "integer", "YES", null],
    ["ai_reason", "text", "YES", null], ["status", "text", "YES", "'pendiente'::text"], ["created_at", TS, "YES", "now()"],
    ["recurrence", "text", "YES", null], ["last_generated_date", TS, "YES", null], ["manual_order_index", "integer", "YES", null],
  ],
  financial_entries: [
    ["id", "text", "NO", null], ["user_id", "uuid", "NO", null], ["type", "text", "NO", null], ["title", "text", "NO", null],
    ["amount", "numeric", "NO", null], ["date", TS, "YES", "now()"], ["category", "text", "YES", null],
    ["created_at", TS, "YES", "now()"], ["currency", "text", "YES", null], ["amount_in_primary", "numeric", "YES", null],
    ["recurrence", "text", "YES", null], ["last_generated_date", TS, "YES", null],
    ["payment_method", "text", "YES", null], ["payment_account", "text", "YES", null],
  ],
  money_snapshots: [
    ["id", "text", "NO", null], ["user_id", "uuid", "NO", null], ["date", TS, "NO", null], ["total", "numeric", "NO", null],
    ["note", "text", "YES", null], ["created_at", TS, "YES", "now()"],
  ],
  user_tools: [
    ["id", "text", "NO", null], ["user_id", "uuid", "NO", null], ["name", "text", "NO", null], ["description", "text", "YES", null],
    ["url", "text", "YES", null], ["category", "text", "NO", "'Productividad'::text"], ["tags", "ARRAY", "YES", "'{}'::text[]"],
    ["free", "boolean", "YES", "true"], ["rating", "integer", "YES", "5"], ["icon", "text", "YES", "'🔧'::text"],
    ["highlight", "boolean", "YES", "false"], ["created_at", TS, "YES", "now()"], ["cost", "numeric", "YES", "0"],
    ["billing_period", "text", "YES", "'monthly'::text"], ["order_index", "integer", "YES", null],
    ["is_favorite", "boolean", "YES", "false"], ["updated_at", TS, "YES", "now()"],
  ],
  budgets: [
    ["id", "text", "NO", null], ["user_id", "uuid", "NO", null], ["category", "text", "NO", null], ["amount", "numeric", "NO", null],
    ["currency", "text", "YES", null], ["month", "text", "YES", null], ["updated_at", TS, "YES", "now()"], ["created_at", TS, "YES", "now()"],
  ],
  paid_codes: [
    ["code", "text", "NO", null], ["name", "text", "YES", null], ["paid_at", TS, "YES", "now()"],
    ["stripe_session_id", "text", "YES", null], ["used", "boolean", "YES", "false"], ["created_at", TS, "YES", "now()"],
    ["email", "text", "YES", null],
  ],
  subscriptions: [
    ["id", "uuid", "NO", "gen_random_uuid()"], ["email", "text", "NO", null], ["user_id", "uuid", "YES", null],
    ["plan_kind", "text", "NO", "'paid'::text"], ["status", "text", "NO", null], ["stripe_customer_id", "text", "YES", null],
    ["stripe_subscription_id", "text", "YES", null], ["current_period_end", TS, "YES", null],
    ["cancel_at_period_end", "boolean", "NO", "false"], ["trial_end", TS, "YES", null], ["last_event_at", TS, "YES", null],
    ["note", "text", "YES", null], ["created_at", TS, "NO", "now()"], ["updated_at", TS, "NO", "now()"],
  ],
  stripe_events: [
    ["id", "text", "NO", null], ["type", "text", "NO", null], ["received_at", TS, "NO", "now()"],
    ["processed_at", TS, "YES", null], ["error", "text", "YES", null],
  ],
};

const INDICES = [
  "goals_user_id_idx", "tasks_user_id_idx", "financial_entries_user_id_idx", "money_snapshots_user_id_idx",
  "budgets_user_id_idx", "user_tools_favorite_idx", "user_tools_order_idx", "paid_codes_session_idx",
  "paid_codes_email_idx", "subscriptions_email_idx", "subscriptions_user_idx", "subscriptions_one_free_per_email",
];

const POLITICAS: Record<string, string> = {
  profiles: "own_profiles", goals: "own_goals", tasks: "own_tasks", financial_entries: "own_financial_entries",
  money_snapshots: "own_money_snapshots", user_tools: "own_user_tools", budgets: "own_budgets",
  paid_codes: "read_own_paid_code", subscriptions: "read_own_subscription",
};

async function nuevaBase() {
  const db = new PGlite();
  await db.exec(ESTRUCTURA_SUPABASE);
  return db;
}

async function columnas(db: PGlite, tabla: string): Promise<Col[]> {
  const r = await db.query<{ column_name: string; data_type: string; is_nullable: "YES" | "NO"; column_default: string | null }>(
    `select column_name, data_type, is_nullable, column_default from information_schema.columns
     where table_schema='public' and table_name=$1 order by column_name`, [tabla]);
  return r.rows.map((c) => [c.column_name, c.data_type, c.is_nullable, c.column_default]);
}
const ordenadas = (c: Col[]) => [...c].sort((a, b) => a[0].localeCompare(b[0]));

describe("schema.sql reconstruye la base de datos real", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await nuevaBase();
    await db.exec(SQL);
  }, 60_000);

  it.each(Object.keys(REAL))("tabla %s: mismas columnas, tipos, obligatoriedad y valores por defecto", async (tabla) => {
    expect(await columnas(db, tabla)).toEqual(ordenadas(REAL[tabla]));
  });

  it("no crea tablas de más ni de menos", async () => {
    const r = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`);
    expect(r.rows.map((x) => x.table_name)).toEqual(Object.keys(REAL).sort());
  });

  it("claves primarias correctas", async () => {
    const r = await db.query<{ t: string; c: string }>(
      `select tc.table_name as t, string_agg(kcu.column_name, ',') as c
       from information_schema.table_constraints tc join information_schema.key_column_usage kcu
         on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
       where tc.table_schema='public' and tc.constraint_type='PRIMARY KEY' group by tc.table_name order by 1`);
    const esperado: Record<string, string> = Object.fromEntries(
      Object.entries(REAL).map(([t, cols]) => [t, t === "profiles" ? "user_id" : t === "paid_codes" ? "code" : "id"])
    );
    expect(Object.fromEntries(r.rows.map((x) => [x.t, x.c]))).toEqual(esperado);
  });

  it("todas las tablas tienen la seguridad por filas activada", async () => {
    const r = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' order by 1`);
    for (const x of r.rows) expect(x.relrowsecurity, x.relname).toBe(true);
  });

  it("cada tabla tiene su política con el nombre de producción", async () => {
    const r = await db.query<{ tablename: string; policyname: string }>(
      `select tablename, policyname from pg_policies where schemaname='public' order by 1`);
    expect(Object.fromEntries(r.rows.map((x) => [x.tablename, x.policyname]))).toEqual(POLITICAS);
    // stripe_events NO tiene política a propósito: invisible para el cliente.
    expect(r.rows.some((x) => x.tablename === "stripe_events")).toBe(false);
  });

  it("los usuarios solo pueden LEER paid_codes y subscriptions (nada de escribir)", async () => {
    const r = await db.query<{ tablename: string; cmd: string }>(
      `select tablename, cmd from pg_policies where schemaname='public' and tablename in ('paid_codes','subscriptions')`);
    for (const x of r.rows) expect(x.cmd, x.tablename).toBe("SELECT");
  });

  it("existen todos los índices", async () => {
    const r = await db.query<{ indexname: string }>(`select indexname from pg_indexes where schemaname='public'`);
    const hay = new Set(r.rows.map((x) => x.indexname));
    for (const i of INDICES) expect(hay.has(i), i).toBe(true);
  });

  it("restricciones: presupuesto > 0, valoración 1-5, plan válido, correo en minúsculas, id de Stripe único", async () => {
    const r = await db.query<{ conname: string }>(
      `select conname from pg_constraint where connamespace='public'::regnamespace and contype in ('c','u') order by 1`);
    const nombres = r.rows.map((x) => x.conname);
    for (const n of ["budgets_amount_check", "user_tools_rating_check", "subscriptions_plan_kind_check", "subscriptions_email_check", "subscriptions_stripe_subscription_id_key"]) {
      expect(nombres, n).toContain(n);
    }
  });

  it("el disparador de herramientas actualiza updated_at en cada cambio", async () => {
    const t = await db.query<{ trigger_name: string; action_timing: string; event_manipulation: string }>(
      `select trigger_name, action_timing, event_manipulation from information_schema.triggers where trigger_schema='public'`);
    expect(t.rows).toEqual([{ trigger_name: "user_tools_touch_updated_at_trg", action_timing: "BEFORE", event_manipulation: "UPDATE" }]);

    const uid = "11111111-1111-1111-1111-111111111111";
    await db.query(`insert into public.user_tools (id, user_id, name, updated_at) values ('t1', $1, 'x', '2020-01-01')`, [uid]);
    await db.query(`update public.user_tools set name = 'y' where id = 't1'`);
    const r = await db.query<{ viejo: boolean }>(`select updated_at > '2024-01-01' as viejo from public.user_tools where id='t1'`);
    expect(r.rows[0].viejo).toBe(true);
  });

  it("restricciones en acción: no admite presupuestos de 0, ni plan inventado, ni dos 'gratis' para el mismo correo", async () => {
    const uid = "22222222-2222-2222-2222-222222222222";
    await expect(db.query(`insert into public.budgets (id,user_id,category,amount) values ('b0',$1,'Comida',0)`, [uid])).rejects.toThrow();
    await expect(db.query(`insert into public.subscriptions (email,plan_kind,status) values ('a@b.c','regalo','active')`)).rejects.toThrow();
    await expect(db.query(`insert into public.subscriptions (email,plan_kind,status) values ('A@B.C','paid','active')`)).rejects.toThrow();
    await db.query(`insert into public.subscriptions (email,plan_kind,status) values ('uno@x.com','free_forever','active')`);
    await expect(db.query(`insert into public.subscriptions (email,plan_kind,status) values ('uno@x.com','free_forever','active')`)).rejects.toThrow();
  });

  it("tiempo real: las siete tablas de la app están publicadas", async () => {
    const r = await db.query<{ tablename: string }>(`select tablename from pg_publication_tables where pubname='supabase_realtime' order by 1`);
    expect(r.rows.map((x) => x.tablename)).toEqual(["budgets", "financial_entries", "goals", "money_snapshots", "profiles", "tasks", "user_tools"]);
  });

  it("no mete cuentas de demostración", async () => {
    const r = await db.query<{ n: number }>(`select count(*)::int as n from public.profiles`);
    expect(r.rows[0].n).toBe(0);
  });
});

describe("schema.sql es seguro de repetir y de aplicar sobre bases antiguas", () => {
  it("ejecutarlo dos veces seguidas no falla ni cambia nada", async () => {
    const db = await nuevaBase();
    await db.exec(SQL);
    const antes = await Promise.all(Object.keys(REAL).map((t) => columnas(db, t)));
    await db.exec(SQL);
    const despues = await Promise.all(Object.keys(REAL).map((t) => columnas(db, t)));
    expect(despues).toEqual(antes);
    const pol = await db.query<{ n: number }>(`select count(*)::int as n from pg_policies where schemaname='public'`);
    expect(pol.rows[0].n).toBe(Object.keys(POLITICAS).length);
  }, 60_000);

  it("sobre una base antigua (sin las columnas nuevas) añade lo que falta y conserva los datos", async () => {
    const db = await nuevaBase();
    // Tablas como las dejó la primera versión del archivo: sin moneda, PIN, recurrentes, favoritos…
    await db.exec(`
      create table public.profiles (user_id uuid primary key, name text, email text, current_money numeric default 0,
        total_target numeric default 0, current_monthly_income numeric default 0, monthly_target numeric default 0,
        target_date timestamptz, updated_at timestamptz default now());
      create table public.goals (id text primary key, user_id uuid not null, title text not null, description text,
        category text not null, target_amount numeric, current_amount numeric default 0, deadline timestamptz,
        importance int default 5, status text default 'activo', progress int default 0, created_at timestamptz default now());
      create table public.tasks (id text primary key, user_id uuid not null, goal_id text, title text not null, description text,
        due_date timestamptz, estimated_minutes int, energy_level text, difficulty int, urgency int, money_impact numeric default 0,
        ai_priority_score int, ai_reason text, status text default 'pendiente', manual_order_index int, created_at timestamptz default now());
      create table public.financial_entries (id text primary key, user_id uuid not null, type text not null, title text not null,
        amount numeric not null, date timestamptz default now(), category text, created_at timestamptz default now());
      create table public.money_snapshots (id text primary key, user_id uuid not null, date timestamptz not null, total numeric not null,
        note text, created_at timestamptz default now());
      create table public.user_tools (id text primary key, user_id uuid not null, name text not null, description text, url text,
        category text not null default 'Productividad', tags text[] default '{}', free boolean default true, cost numeric default 0,
        billing_period text default 'monthly', rating int default 5 check (rating between 1 and 5), icon text default '🔧',
        highlight boolean default false, created_at timestamptz default now());
      create table public.paid_codes (code text primary key, name text, email text, paid_at timestamptz default now(),
        stripe_session_id text, used boolean default false, created_at timestamptz default now());
      insert into public.financial_entries (id, user_id, type, title, amount) values ('f1', '33333333-3333-3333-3333-333333333333', 'gasto', 'Antiguo', 12.5);
    `);
    await db.exec(SQL);
    for (const t of Object.keys(REAL)) expect(await columnas(db, t), t).toEqual(ordenadas(REAL[t]));
    const r = await db.query<{ title: string; amount: string; payment_method: string | null }>(
      `select title, amount::text, payment_method from public.financial_entries where id='f1'`);
    expect(r.rows[0]).toEqual({ title: "Antiguo", amount: "12.5", payment_method: null });
  }, 60_000);
});
