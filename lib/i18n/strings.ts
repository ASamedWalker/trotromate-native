/**
 * Locale dictionaries. SCAFFOLD — translated key-by-key; untranslated keys fall
 * back to English at lookup, so nothing is ever blank. Add incrementally.
 *
 * ⚠️ Non-English translations are best-effort starters and MUST be reviewed by
 * native speakers before launch. Keys are flat + namespaced by screen.
 *
 * Ghana transit reach: Twi (Akan, dominant) · Ewe (Volta) · Ga (Accra) ·
 * Hausa (north + markets/lorry-park lingua franca) · Dagbani (Northern/Tamale) ·
 * Fante (Akan, Central/Western).
 */
export type LangCode = 'en' | 'tw' | 'ee' | 'ga' | 'ha' | 'dag' | 'fat'

export const LANGUAGES: { code: LangCode; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'tw', label: 'Twi', native: 'Twi' },
  { code: 'fat', label: 'Fante', native: 'Mfantse' },
  { code: 'ee', label: 'Ewe', native: 'Eʋegbe' },
  { code: 'ga', label: 'Ga', native: 'Gã' },
  { code: 'ha', label: 'Hausa', native: 'Hausa' },
  { code: 'dag', label: 'Dagbani', native: 'Dagbanli' },
]

type Dict = Record<string, string>

const en: Dict = {
  'common.cancel': 'Cancel',
  'common.done': 'Done',
  'common.seeAll': 'See All',
  'common.retry': 'Retry',
  // Home
  'home.hello': 'Hello',
  'home.walletBalance': 'Wallet Balance',
  'home.topupWallet': 'Topup Wallet',
  'home.scanToPay': 'Scan To Pay',
  'home.whereTo': 'Where to?',
  'home.directions': 'Directions',
  'home.buses': 'Buses',
  'home.nearby': 'Nearby',
  'home.queue': 'Queue',
  'home.status': 'Status',
  'home.services': 'Services',
  // Wallet
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

// Twi (Akan) — starter; native review needed.
const tw: Dict = {
  'common.cancel': 'Gyae',
  'common.done': 'Awie',
  'common.seeAll': 'Hwɛ ne nyinaa',
  'home.hello': 'Akwaaba',
  'home.walletBalance': 'Sika a Ɛwɔ Kotokuo Mu',
  'home.topupWallet': 'Fa Sika Gu Mu',
  'home.scanToPay': 'Scan na Tua',
  'home.whereTo': 'Wopɛ sɛ wokɔ he?',
  'home.directions': 'Akwan',
  'home.buses': 'Bɔs',
  'home.nearby': 'Bɛn',
  'home.queue': 'Santen',
  'home.status': 'Tebea',
  'home.services': 'Nnwuma',
  'wallet.title': 'Sika Kotokuo',
  'wallet.balance': 'Sika a Ɛwɔ Kotokuo Mu',
  'wallet.addMoney': 'Fa Sika Gu Mu',
  'wallet.myTickets': 'Me Tikiti',
  'wallet.recentTransactions': 'Nsɛm a Asi Nnansa Yi',
  'wallet.topupWallet': 'Fa Sika Gu Mu',
  'tickets.title': 'Me Tikiti',
}

// Fante (Akan variant) — close to Twi; starter; native review needed.
const fat: Dict = {
  'common.cancel': 'Gyae',
  'home.hello': 'Akwaaba',
  'home.walletBalance': 'Sika a Ɔwɔ Kotokur Mu',
  'home.topupWallet': 'Fa Sika Hyɛ Mu',
  'home.scanToPay': 'Scan na Tua',
  'home.whereTo': 'Ɛhefa na ɔrokɔ?',
  'home.buses': 'Bɔs',
  'home.nearby': 'Bɛn',
  'home.queue': 'Santen',
  'home.status': 'Tebea',
  'home.services': 'Ndwuma',
  'wallet.myTickets': 'Me Tikiti',
  'tickets.title': 'Me Tikiti',
}

// Ewe (Eʋegbe) — starter; native review needed.
const ee: Dict = {
  'common.cancel': 'Tɔ te',
  'common.done': 'Vɔ',
  'home.hello': 'Woezɔ',
  'home.walletBalance': 'Ga si le Gakotoku me',
  'home.topupWallet': 'Tsɔ Ga De Eme',
  'home.scanToPay': 'Scan ne Naxe Fe',
  'home.whereTo': 'Afi ka nèyina?',
  'home.directions': 'Mɔwo',
  'home.buses': 'Ʋuwo',
  'home.nearby': 'Te ɖe',
  'home.queue': 'Fli',
  'home.status': 'Nɔnɔme',
  'home.services': 'Dɔwɔwɔwo',
  'wallet.title': 'Gakotoku',
  'wallet.balance': 'Ga si le Gakotoku me',
  'wallet.addMoney': 'Tsɔ Ga De Eme',
  'wallet.myTickets': 'Nye Tikitiwo',
  'wallet.topupWallet': 'Tsɔ Ga De Eme',
  'tickets.title': 'Nye Tikitiwo',
}

// Ga (Gã) — starter; native review needed.
const ga: Dict = {
  'common.cancel': 'Gbã',
  'common.done': 'Egbe naa',
  'home.hello': 'Ojekoo',
  'home.walletBalance': 'Shika ni Yɔɔ Kotoku lɛ Mli',
  'home.topupWallet': 'Kɛ Shika Wo Mli',
  'home.scanToPay': 'Scan ni Owo',
  'home.whereTo': 'Nɛgbɛ oyaa?',
  'home.directions': 'Gbɛ̀i',
  'home.buses': 'Tsɔji',
  'home.nearby': 'Bɛŋ',
  'home.queue': 'Gbɛjegbɛ',
  'home.status': 'Shihilɛ',
  'home.services': 'Nitsumɔi',
  'wallet.title': 'Shika Kotoku',
  'wallet.balance': 'Shika ni Yɔɔ Kotoku lɛ Mli',
  'wallet.addMoney': 'Kɛ Shika Wo Mli',
  'wallet.myTickets': 'Mi Tikiti',
  'wallet.topupWallet': 'Kɛ Shika Wo Mli',
  'tickets.title': 'Mi Tikiti',
}

// Hausa — starter; native review needed.
const ha: Dict = {
  'common.cancel': 'Soke',
  'common.done': 'An gama',
  'common.seeAll': 'Duba duka',
  'home.hello': 'Sannu',
  'home.walletBalance': 'Kuɗin Walat',
  'home.topupWallet': 'Sake Kuɗi',
  'home.scanToPay': 'Skana ka Biya',
  'home.whereTo': 'Ina za ka?',
  'home.directions': 'Hanyoyi',
  'home.buses': 'Bas',
  'home.nearby': 'Kusa',
  'home.queue': 'Layi',
  'home.status': 'Matsayi',
  'home.services': 'Ayyuka',
  'wallet.title': 'Walat',
  'wallet.balance': 'Jimlar Kuɗin Walat',
  'wallet.addMoney': 'Saka Kuɗi',
  'wallet.myTickets': 'Tikitina',
  'wallet.recentTransactions': 'Mu’amalolin Kwanan Nan',
  'wallet.topupWallet': 'Sake Kuɗi',
  'tickets.title': 'Tikitina',
}

// Dagbani (Dagbanli, Northern Ghana) — starter; native review needed.
const dag: Dict = {
  'common.cancel': 'Chɛ',
  'home.hello': 'Dasiba',
  'home.walletBalance': 'Laɣiri din be Kotoku ni',
  'home.topupWallet': 'Niŋ Laɣiri',
  'home.scanToPay': 'Scan ka Yo',
  'home.whereTo': 'Ya ka a chana?',
  'home.buses': 'Loori',
  'home.nearby': 'Miri',
  'home.queue': 'Zali',
  'home.status': 'Yɛltɔɣa',
  'home.services': 'Tuma',
  'wallet.myTickets': 'N Tikiti',
  'tickets.title': 'N Tikiti',
}

export const STRINGS: Record<LangCode, Dict> = { en, tw, fat, ee, ga, ha, dag }
