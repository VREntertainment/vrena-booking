import type { SupabaseClient } from '@supabase/supabase-js'

export async function hasVerifiedAal2Session(authClient: SupabaseClient, accessToken: string) {
  const { data, error } = await authClient.auth.getClaims(accessToken)
  return !error && data?.claims?.aal === 'aal2'
}

export async function hasVerifiedMfaFactor(adminClient: SupabaseClient, userId: string) {
  const { data, error } = await adminClient.auth.admin.mfa.listFactors({ userId })
  return !error && Boolean(data?.factors?.some((factor) => factor.status === 'verified'))
}
