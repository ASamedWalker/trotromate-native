import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Session, User } from '@supabase/supabase-js'

interface UseAuthReturn {
  session: Session | null
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  signInWithPhone: (phone: string) => Promise<{ success: boolean; error?: string }>
  verifyOtp: (phone: string, token: string) => Promise<{ success: boolean; error?: string }>
  linkToDevice: (deviceId: string) => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithPhone = useCallback(async (phone: string) => {
    const fullPhone = phone.startsWith('+') ? phone : `+233${phone.replace(/^0/, '')}`
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }, [])

  const verifyOtp = useCallback(async (phone: string, token: string) => {
    const fullPhone = phone.startsWith('+') ? phone : `+233${phone.replace(/^0/, '')}`
    const { error } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token,
      type: 'sms',
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }, [])

  const linkToDevice = useCallback(async (deviceId: string) => {
    if (!session?.user) return
    const phone = session.user.phone || ''

    // Link device to auth account
    await supabase.rpc('link_auth_to_device', {
      p_device_id: deviceId,
      p_auth_user_id: session.user.id,
      p_phone: phone,
    })

    // Auto-link any WhatsApp bookings made with same phone
    if (phone) {
      const phones = [phone, phone.replace('+', ''), `+${phone.replace('+', '')}`]
      for (const p of phones) {
        try {
          await supabase.rpc('link_tickets_to_user', { p_phone: p, p_user_id: session.user.id })
        } catch {} // non-critical, don't block login
      }
    }
  }, [session])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
  }, [])

  return {
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session,
    isLoading,
    signInWithPhone,
    verifyOtp,
    linkToDevice,
    signOut,
  }
}
