import React, { createContext, useContext } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import type { Session, User } from '@supabase/supabase-js'

interface AuthContextValue {
  session: Session | null
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  signInWithPhone: (phone: string) => Promise<{ success: boolean; error?: string }>
  verifyOtp: (phone: string, token: string) => Promise<{ success: boolean; error?: string }>
  linkToDevice: (deviceId: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
  signInWithPhone: async () => ({ success: false }),
  verifyOtp: async () => ({ success: false }),
  linkToDevice: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  return useContext(AuthContext)
}
