/**
 * Locale dictionaries. SCAFFOLD — a starter set of keys is translated; the rest
 * of the app is still English (untranslated keys fall back to English at lookup,
 * so nothing is ever blank). Add keys + translations incrementally.
 *
 * ⚠️ Non-English translations below are best-effort starters and MUST be
 * reviewed by native speakers before launch. Keep keys flat + namespaced by
 * screen, e.g. 'wallet.balance'.
 *
 * Languages chosen for Ghana transit reach: Twi (Akan, dominant), Ewe (Volta),
 * Ga (Accra), Hausa (northern + markets/lorry-park lingua franca). Next to add:
 * Dagbani (Northern), Fante (Akan variant).
 */
export type LangCode = 'en' | 'tw' | 'ee' | 'ga' | 'ha'

export const LANGUAGES: { code: LangCode; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'tw', label: 'Twi', native: 'Twi' },
  { code: 'ee', label: 'Ewe', native: 'Eʋegbe' },
  { code: 'ga', label: 'Ga', native: 'Gã' },
  { code: 'ha', label: 'Hausa', native: 'Hausa' },
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

// Twi (Akan) — starter; needs native review.
const tw: Dict = {
  'common.cancel': 'Gyae',
  'common.done': 'Awie',
  'common.seeAll': 'Hwɛ ne nyinaa',
  'wallet.title': 'Sika Kotokuo',
  'wallet.balance': 'Sika a Ɛwɔ Kotokuo Mu',
  'wallet.addMoney': 'Fa Sika Gu Mu',
  'wallet.myTickets': 'Me Tikiti',
  'wallet.recentTransactions': 'Nsɛm a Asi Nnansa Yi',
  'wallet.topupWallet': 'Fa Sika Gu Mu',
  'tickets.title': 'Me Tikiti',
}

// Ewe (Eʋegbe) — starter; needs native review.
const ee: Dict = {
  'common.cancel': 'Tɔ te',
  'common.done': 'Vɔ',
  'wallet.title': 'Gakotoku',
  'wallet.balance': 'Ga si le Gakotoku me',
  'wallet.addMoney': 'Tsɔ Ga De Eme',
  'wallet.myTickets': 'Nye Tikitiwo',
  'wallet.topupWallet': 'Tsɔ Ga De Eme',
  'tickets.title': 'Nye Tikitiwo',
}

// Ga (Gã) — starter; needs native review.
const ga: Dict = {
  'common.cancel': 'Gbã',
  'common.done': 'Egbe naa',
  'wallet.title': 'Shika Kotoku',
  'wallet.balance': 'Shika ni Yɔɔ Kotoku lɛ Mli',
  'wallet.addMoney': 'Kɛ Shika Wo Mli',
  'wallet.myTickets': 'Mi Tikiti',
  'wallet.topupWallet': 'Kɛ Shika Wo Mli',
  'tickets.title': 'Mi Tikiti',
}

// Hausa — starter; needs native review.
const ha: Dict = {
  'common.cancel': 'Soke',
  'common.done': 'An gama',
  'common.seeAll': 'Duba duka',
  'wallet.title': 'Walat',
  'wallet.balance': 'Jimlar Kuɗin Walat',
  'wallet.addMoney': 'Saka Kuɗi',
  'wallet.myTickets': 'Tikitina',
  'wallet.recentTransactions': 'Mu’amalolin Kwanan Nan',
  'wallet.topupWallet': 'Sake Kuɗi',
  'tickets.title': 'Tikitina',
}

export const STRINGS: Record<LangCode, Dict> = { en, tw, ee, ga, ha }
