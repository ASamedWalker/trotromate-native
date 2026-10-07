import { authedFetch } from '@/lib/services/authedFetch'
import { signOutAndWipe } from '@/lib/services/signOut'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'

/** Deletes the signed-in account server-side, then wipes this phone like a sign-out.
 *  Passes deviceId=null so signOutAndWipe does not re-create the deleted profile via save_push_token. */
export async function deleteAccount(resetIdentity: () => Promise<void>): Promise<{ error: string | null; code?: string }> {
  const res = await authedFetch(`${API_URL}/api/account/delete`, { method: 'POST' })
  // 401 = the session is already dead, e.g. the account was deleted but the
  // response was lost. Wipe the phone so the rider isn't stuck signed in.
  if (res.status === 401) {
    await signOutAndWipe(null, resetIdentity)
    return {
      error: 'Your session has ended. If you already confirmed deletion, your account is gone. Otherwise sign in and try again.',
      code: 'session_ended',
    }
  }
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    return { error: j.error || 'Could not delete account.', code: typeof j.code === 'string' ? j.code : undefined }
  }
  await signOutAndWipe(null, resetIdentity)
  return { error: null }
}
