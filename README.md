# Rumbo

Rumbo es una app SaaS para no perder el foco. Funciona como una lista de tareas conectada a tus objetivos personales, profesionales y financieros, y usa IA (Gemini) para ordenar lo que más te acerca a tu meta.

## Stack

- Next.js 14 (App Router)
- Tailwind CSS
- Framer Motion
- Recharts
- Supabase (opcional)
- API de Gemini (opcional)
- Listo para Cloudflare Pages

## Empezar

```bash
npm install
cp .env.example .env.local   # añade tus claves si las tienes
npm run dev
```

Abre http://localhost:3000.

Sin claves de Supabase ni Gemini, Rumbo funciona en modo demo con datos de ejemplo y prioriza tareas con una heurística local. Al añadir las variables se activan persistencia real (Supabase) e IA real (Gemini).

## Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
```

## Pantallas

- `/` Landing
- `/onboarding` Configuración inicial
- `/today` Foco diario
- `/dashboard` Visión general
- `/goals` Objetivos
- `/tasks` Tareas con IA
- `/money` Dinero, gráficos, proyección
- `/tree` Árbol de objetivos
- `/race` Carrera hacia la meta
- `/settings` Cuenta y planes

## Supabase

Ejecuta `supabase/schema.sql` en tu proyecto para crear las tablas (`users`, `goals`, `tasks`, `financial_entries`, `ai_recommendations`).

## Deploy en Cloudflare Pages

- Build command: `npm run build`
- Output: `.next` (usa el adaptador `@cloudflare/next-on-pages` si quieres el edge runtime completo).
- Configura las variables de entorno en el panel.
