/**
 * Locale dictionaries: English and French (owner 2026-10-21: only these two
 * until a native speaker reviews Ghanaian-language copy; the Twi/Ewe/Ga/Hausa/
 * Dagbani/Fante starters are in git history before this change). Keys are
 * flat + namespaced by screen; untranslated keys fall back to English.
 */
export type LangCode = 'en' | 'fr'

export const LANGUAGES: { code: LangCode; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'fr', label: 'French', native: 'Français' },
]

import { SCREENS } from './screens'

export type Dict = Record<string, string>

// French typography: no-break space before : ; ? ! (and inside « »)
const NB = '\u00a0'

const enBase: Dict = {
  'common.cancel': 'Cancel',
  'common.done': 'Done',
  'common.seeAll': 'See All',
  'common.retry': 'Retry',
  // Bottom nav (keep short — small tab labels)
  'nav.home': 'Home',
  'nav.lines': 'Lines',
  'nav.train': 'Train',
  'nav.wallet': 'Wallet',
  'nav.pulse': 'Pulse',
  'nav.fares': 'Fares',
  'nav.stations': 'Stations',
  'nav.rewards': 'Rewards',
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
  'wallet.addMoney': 'Top up',
  'wallet.scanToPay': 'Scan To Pay',
  'wallet.myTickets': 'My Tickets',
  'wallet.recentTransactions': 'Recent Transactions',
  'wallet.activePass': 'Active Pass',
  'wallet.topupWallet': 'Topup Wallet',
  'tickets.title': 'My Tickets',
  'tickets.active': 'ACTIVE',
  'tickets.past': 'PAST',
}

// French (West Africa: Togo, Bénin, Côte d'Ivoire) — full coverage; every
// English key must exist here (tests/i18n-fr.test.ts).
const frBase: Dict = {
  'common.cancel': 'Annuler',
  'common.done': 'Terminé',
  'common.seeAll': 'Tout voir',
  'common.retry': 'Réessayer',
  'nav.home': 'Accueil',
  'nav.lines': 'Lignes',
  'nav.train': 'Train',
  'nav.wallet': 'Portefeuille',
  'nav.pulse': 'Pulse',
  'nav.fares': 'Tarifs',
  'nav.stations': 'Gares',
  'nav.rewards': 'Bonus',
  'home.hello': 'Bonjour',
  'home.walletBalance': 'Solde du portefeuille',
  'home.topupWallet': 'Recharger',
  'home.scanToPay': 'Scanner pour payer',
  'home.whereTo': `Où allez-vous${NB}?`,
  'home.directions': 'Itinéraires',
  'home.buses': 'Bus',
  'home.nearby': 'À proximité',
  'home.queue': "File d'attente",
  'home.status': 'État',
  'home.services': 'Services',
  'wallet.title': 'Portefeuille',
  'wallet.balance': 'Solde total du portefeuille',
  'wallet.addMoney': 'Recharger',
  'wallet.scanToPay': 'Scanner pour payer',
  'wallet.myTickets': 'Mes billets',
  'wallet.recentTransactions': 'Transactions récentes',
  'wallet.activePass': 'Pass actif',
  'wallet.topupWallet': 'Recharger le portefeuille',
  'tickets.title': 'Mes billets',
  'tickets.active': 'ACTIFS',
  'tickets.past': 'PASSÉS',
}

const en: Dict = Object.assign({}, enBase, ...SCREENS.map((m) => m.en))
const fr: Dict = Object.assign({}, frBase, ...SCREENS.map((m) => m.fr))

export const STRINGS: Record<LangCode, Dict> = { en, fr }
