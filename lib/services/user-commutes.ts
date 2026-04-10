import { supabase } from '@/lib/supabase/client'

export interface UserCommute {
  id: string
  device_id: string
  route_id: string | null
  from_location: string
  to_location: string
  label: string
  commute_type: 'morning' | 'evening' | 'custom'
  is_primary: boolean
  notify_enabled: boolean
  notify_time: string
  created_at: string
  updated_at: string
}

export type CreateCommuteInput = {
  device_id: string
  from_location: string
  to_location: string
  route_id?: string | null
  label?: string
  commute_type?: 'morning' | 'evening' | 'custom'
  is_primary?: boolean
  notify_enabled?: boolean
  notify_time?: string
}

export async function fetchUserCommutes(deviceId: string): Promise<UserCommute[]> {
  const { data, error } = await supabase
    .from('user_commutes')
    .select('*')
    .eq('device_id', deviceId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data as UserCommute[]) ?? []
}

export async function upsertUserCommute(input: CreateCommuteInput): Promise<UserCommute> {
  // If setting as primary, un-primary all others first
  if (input.is_primary !== false) {
    await supabase
      .from('user_commutes')
      .update({ is_primary: false })
      .eq('device_id', input.device_id)
  }

  const { data, error } = await supabase
    .from('user_commutes')
    .insert({
      ...input,
      is_primary: input.is_primary ?? true,
      notify_enabled: input.notify_enabled ?? true,
      notify_time: input.notify_time ?? '06:15',
      label: input.label ?? 'Morning commute',
      commute_type: input.commute_type ?? 'morning',
    })
    .select()
    .single()

  if (error) throw error
  return data as UserCommute
}

export async function updateUserCommute(
  id: string,
  updates: Partial<Omit<UserCommute, 'id' | 'device_id' | 'created_at'>>
): Promise<UserCommute> {
  const { data, error } = await supabase
    .from('user_commutes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as UserCommute
}

export async function deleteUserCommute(id: string): Promise<void> {
  const { error } = await supabase
    .from('user_commutes')
    .delete()
    .eq('id', id)

  if (error) throw error
}

/**
 * Try to match a from/to pair to an existing route.
 * Returns the route_id if found, null otherwise.
 */
export async function matchRoute(
  from: string,
  to: string
): Promise<string | null> {
  const { data } = await supabase
    .from('routes')
    .select('id')
    .ilike('from_location', `%${from}%`)
    .ilike('to_location', `%${to}%`)
    .limit(1)
    .single()

  return data?.id ?? null
}
