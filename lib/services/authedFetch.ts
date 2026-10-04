import { supabase } from '@/lib/supabase/client'

/**
 * fetch() for the Troski backend's account routes (wallet, bookings, tickets,
 * addresses). Attaches the signed-in user's Supabase access token — the server
 * no longer trusts a bare auth_user_id, it checks this token matches it.
 */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  return fetch(input, { ...init, headers })
}
