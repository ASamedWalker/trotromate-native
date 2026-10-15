import { Redirect, useLocalSearchParams } from 'expo-router'

/**
 * Top-up is one screen now (UX v2 TU2/TU3): the network is chosen once on
 * app/wallet/momo.tsx, and bank / card stay hidden until they work. This route
 * stays so existing links (Home's "Top up", deep links) land on that screen
 * with their params (amount pre-fill, return=checkout).
 */
export default function FundRedirect() {
  const { amount, return: returnTo } = useLocalSearchParams<{ amount?: string; return?: string }>()
  return (
    <Redirect
      href={{
        pathname: '/wallet/momo',
        params: { ...(amount ? { amount } : {}), ...(returnTo ? { return: returnTo, pops: '1' } : {}) },
      } as never}
    />
  )
}
