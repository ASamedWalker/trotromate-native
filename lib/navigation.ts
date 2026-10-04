import type { Router } from 'expo-router'

/**
 * Leave the auth flow for good: pop every screen under it (auth/phone,
 * auth/verify…) before landing, so a later dismissAll() — e.g. closing the
 * booking receipt — can't fall back onto the sign-in screen.
 */
export function replaceStackWith(router: Router, href: string) {
  if (router.canDismiss()) router.dismissAll()
  router.replace(href as never)
}
