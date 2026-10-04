import { supabase } from '@/lib/supabase/client'

const DEVICE_ID = /^[0-9a-f-]{16,64}$/i

export type NameRow = { id: string; display_name: string | null; first_name: string | null }

/**
 * The profiles that belong to this person: the signed-in account's, plus
 * THIS phone's only when no OTHER account owns it (phones get shared, so a
 * phone's row can be someone else's). Separate queries, no filter strings
 * built from local values.
 */
export async function ownProfiles(uid: string | undefined, deviceId: string | null): Promise<NameRow[]> {
  const rows: NameRow[] = []
  if (uid) {
    const { data } = await supabase.from('contributor_profiles').select('id, display_name, first_name').eq('auth_user_id', uid)
    rows.push(...(data ?? []))
  }
  if (deviceId && DEVICE_ID.test(deviceId)) {
    const { data } = await supabase.from('contributor_profiles').select('id, display_name, first_name, auth_user_id').eq('device_id', deviceId)
    for (const r of data ?? []) {
      if ((!r.auth_user_id || r.auth_user_id === uid) && !rows.some((x) => x.id === r.id)) rows.push(r)
    }
  }
  return rows
}

