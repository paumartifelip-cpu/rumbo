import { createClient, SupabaseClient } from "@supabase/supabase-js";

// The Supabase URL and anon key are public by design — the anon key is
// exposed in the client and PostgREST expects it on every request. We embed
// them as defaults so the static export works without depending on the
// hosting platform injecting build-time env vars (Cloudflare Pages currently
// doesn't pass `NEXT_PUBLIC_*` to `next build` for git-triggered deploys).
const DEFAULT_URL = "https://rwizskngajpmuisbdsaz.supabase.co";
const DEFAULT_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3aXpza25nYWpwbXVpc2Jkc2F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDQzNTMsImV4cCI6MjA5MjkyMDM1M30.x3PEfKvCheUYesI0PnSno5k6-YhYlMC976nOGnfpSgU";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !anon) return null;
  if (!client) client = createClient(url, anon);
  return client;
}

export const supabaseEnabled = Boolean(url && anon);
