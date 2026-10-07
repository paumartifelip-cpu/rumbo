// Herramienta de un solo uso (fase 2) YA USADA el 2026-10-07 y APAGADA.
// Se deja este stub en su lugar: no hace nada, no lee Stripe y exige JWT.
// Se puede borrar desde Supabase → Edge Functions cuando se quiera.
Deno.serve(() => new Response(JSON.stringify({ error: 'gone: herramienta de un solo uso, ya utilizada' }), {
  status: 410,
  headers: { 'Content-Type': 'application/json' },
}));
