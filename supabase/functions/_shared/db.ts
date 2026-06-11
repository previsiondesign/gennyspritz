// Service-role client — bypasses RLS; these env vars are auto-injected
// into Supabase Edge Functions at runtime.
import { createClient } from 'jsr:@supabase/supabase-js@2';

export function db() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

export function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
}

export function delay(): Promise<void> {
  // uniform 400–900ms on auth failures (timing noise + brute-force friction)
  return new Promise((r) => setTimeout(r, 400 + Math.random() * 500));
}
