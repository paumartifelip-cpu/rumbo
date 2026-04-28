# Rumbo

App SaaS para no perder el foco. Tareas conectadas a tus objetivos personales y económicos, priorizadas con IA. Dos sesiones (Pau y Michelle), datos sincronizados con Supabase.

## Stack

- Next.js 14 (App Router)
- Tailwind CSS + Framer Motion
- Recharts
- Supabase (sync multi-dispositivo)
- API de Gemini 2.5 Flash (priorización + categorización)
- Cloudflare Pages ready

## Pantallas

- `/` Landing
- `/login` Selector de sesión (Pau / Michelle)
- `/onboarding` Configuración inicial
- `/today` Foco del día con Gemini
- `/dashboard` Visión general
- `/goals` Objetivos con círculos de progreso
- `/tasks` Composer con dictado por voz + IA
- `/money` Patrimonio + ingresos + evolución
- `/gastos` Gastos con auto-categorización IA + bubble chart
- `/settings` Cuenta, API key, planes

## Arrancar local

```bash
npm install
cp .env.example .env.local
# Edita .env.local con tus claves
npm run dev
```

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
GEMINI_API_KEY=opcional, también puedes pegarla en /settings
```

Sin Supabase, los datos viven en `localStorage` por perfil. Con Supabase, todo se sincroniza en la nube y nunca se pierde aunque cambies de navegador.

## Configurar Supabase (una vez)

1. Crea un proyecto en https://supabase.com (o usa uno existente).
2. Copia el `Project URL` y la `anon public key` en `.env.local`.
3. Ve al SQL Editor del proyecto y ejecuta el contenido de [`supabase/schema.sql`](supabase/schema.sql) tal cual.
   - Crea las tablas: `profiles`, `goals`, `tasks`, `financial_entries`, `money_snapshots`.
   - Pre-carga los perfiles Pau y Michelle con UUIDs estables.
   - Activa políticas abiertas (sin auth) — pensado para uso personal de dos sesiones.
4. Reinicia el dev server.

A partir de ahí, cualquier cambio en la app se guarda en Supabase de forma automática (debounce 800ms). En la barra lateral aparece un punto verde cuando está sincronizado, ámbar mientras sube, rojo si hay error.

## Sincronización

- **Login** → pull desde Supabase (sobrescribe el cache local).
- **Cualquier cambio** → push debounced (`goals`, `tasks`, `financial_entries`, `money_snapshots`, `profiles`).
- **Estrategia** → "replace all rows for this user_id" — simple y consistente para datasets pequeños.
- **Cache local** → siempre se mantiene en `localStorage` por perfil para arranques instantáneos y modo offline.

## IA (Gemini)

- `/api/prioritize` — puntúa todas las tareas pendientes (0–100) y genera un consejo del día. Se dispara automáticamente al añadir o cambiar tareas.
- `/api/categorize` — clasifica un gasto en una categoría escogida por la IA (reutiliza categorías existentes para coherencia visual).

Pega tu API key en `/settings` (se guarda solo en tu navegador) o ponla como `GEMINI_API_KEY` en el server.

## Deploy en Cloudflare Pages

- Build command: `npm run build`
- Output directory: `.next`
- Adaptador recomendado: [`@cloudflare/next-on-pages`](https://github.com/cloudflare/next-on-pages) si necesitas el edge runtime completo.
- Configura las variables de entorno en el panel de Cloudflare.

## Privacidad y avisos

- La `anon key` de Supabase es pública por diseño — el cliente la usa para hablar con PostgREST.
- Las políticas RLS están abiertas (sin auth) porque la app usa dos perfiles preconfigurados con UUIDs fijos. Para uso real con auth, añade `supabase.auth` y reemplaza las políticas por `auth.uid() = user_id`.
