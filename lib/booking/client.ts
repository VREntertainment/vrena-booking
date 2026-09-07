let supabaseClientPromise: Promise<typeof import('../supabase/client').supabase> | null = null

export function getSupabase() {
  supabaseClientPromise ??= import('../supabase/client').then((module) => module.supabase)
  return supabaseClientPromise
}
