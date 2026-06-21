/**
 * Locale dictionaries. SCAFFOLD — a starter set of keys is translated; the rest
 * of the app is still English. Add keys + translations incrementally. Twi (tw)
 * and Ga (ga) are placeholders where not yet translated (fall back to English
 * at lookup time, so untranslated keys are never blank).
 *
 * Keep keys flat + namespaced by screen, e.g. 'wallet.addMoney'.
 */
export type LangCode = 'en' | 'tw' | 'ga'

export const LANGUAGES: { code: LangCode; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'tw', label: 'Twi', native: 'Twi' },
  { code: 'ga', label: 'Ga', native: 'Gã' },
]

type Dict = Record<string, string>

const en: Dict = {
  'common.cancel': 'Cancel',
  'common.done': 'Done',
  'common.seeAll': 'See All',
  'common.retry': 'Retry',
  'wallet.title': 'Wallet',
  'wallet.balance': 'Total Wallet Balance',
  'wallet.addMoney': 'Add Money',
  'wallet.scanToPay': 'Scan To Pay',
  'wallet.myTickets': 'My Tickets',
  'wallet.recentTransactions': 'Recent Transactions',
  'wallet.activePass': 'Active Pass',
  'wallet.topupWallet': 'Topup Wallet',
  'tickets.title': 'My Tickets',
  'tickets.active': 'ACTIVE',
  'tickets.past': 'PAST',
}

// Twi — starter translations; untranslated keys fall back to English.
const tw: Dict = {
  'common.cancel': 'Gyae',
  'common.done': 'Awie',
  'wallet.title': 'Sika Kotokuo',
  'wallet.addMoney': 'Fa Sika Gu Mu',
  'wallet.myTickets': 'Me Tikiti',
  'wallet.balance': 'Sika a Ɛwɔ Kotokuo Mu',
}

// Ga — starter translations; untranslated keys fall back to English.
const ga: Dict = {
  'common.cancel': 'Gbã',
  'wallet.title': 'Shika Kotoku',
  'wallet.addMoney': 'Kɛ Shika Wo Mli',
  'wallet.myTickets': 'Mi Tikiti',
}

export const STRINGS: Record<LangCode, Dict> = { en, tw, ga }
