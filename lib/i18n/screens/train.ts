import type { ScreenDict } from './index'

/**
 * Train tab, train line pages, Travel (intercity bus fares) and Terminals.
 * TRAIN = INFORMATION ONLY: no booking/ticket/payment wording; times are
 * "horaires prévus", never live. French: standard, "vous", no-break space
 * before : ; ? ! (NB below).
 */
const NB = '\u00a0'

type Lang = string

// ─── Language helpers (pure; callers pass `lang` from useLanguage()) ───

const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const MONTHS_LONG_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_LONG_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** Weekday name (0 = Sunday). French is lower case: "lundi". */
export function weekdayName(dow: number, lang: Lang): string {
  return (lang === 'fr' ? WEEKDAYS_FR : WEEKDAYS_EN)[((dow % 7) + 7) % 7]
}

/** "2026-09-15" -> "15 Sep 2026" / "15 sept. 2026" (string parse, no time-zone shift). */
export function shortDate(iso: string, lang: Lang, withYear = true): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const months = lang === 'fr' ? MONTHS_FR : MONTHS_EN
  const day = lang === 'fr' && d === 1 ? '1er' : String(d)
  return `${day} ${months[m - 1]}${withYear ? ` ${y}` : ''}`
}

/** News date: "21 May 2026" / "21 mai 2026"; month precision: "October 2026" / "octobre 2026". */
export function newsDate(iso: string, lang: Lang, precision?: 'month'): string {
  const [y, m, d] = iso.split('-').map(Number)
  const months = lang === 'fr' ? MONTHS_LONG_FR : MONTHS_LONG_EN
  if (precision === 'month') return `${months[m - 1]} ${y}`
  return `${lang === 'fr' && d === 1 ? '1er' : d} ${months[m - 1]} ${y}`
}

/** "in 12 min" / "dans 12 min", "in 1 h 22 min", "in 2 h". */
export function inMinutes(minutes: number, lang: Lang): string {
  const m = Math.max(0, Math.round(minutes))
  const w = lang === 'fr' ? 'dans' : 'in'
  if (m < 60) return `${w} ${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `${w} ${h} h ${m % 60} min` : `${w} ${h} h`
}

/** French relative age ("à l'instant", "il y a 5 min"); null for English (use the app's timeAgo). */
export function agoFr(iso: string, now: number = Date.now()): string {
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return ''
  const mins = Math.max(0, Math.round((now - ms) / 60000))
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 60) return `il y a ${days} j`
  return `il y a ${Math.floor(days / 30)} mois`
}

const vowel = (name: string) => /^[aeiouyéèêâîô]/i.test(name)
/** French "de" with elision: "de Tema", "d'Afienya". English: the bare name. */
export function deName(name: string, lang: Lang): string {
  if (lang !== 'fr') return name
  return vowel(name) ? `d'${name}` : `de ${name}`
}
/** Sentence-start "De Tema" / "D'Accra". English: the bare name. */
export function DeName(name: string, lang: Lang): string {
  if (lang !== 'fr') return name
  return vowel(name) ? `D'${name}` : `De ${name}`
}

/** Service days: "Daily" -> "Tous les jours", "Mon – Sat" -> "Mon–Sat" / "lun.–sam.". */
export function daysText(days: string, lang: Lang): string {
  const compact = days.replace(/ – /g, '–')
  if (lang !== 'fr') return compact
  if (days === 'Daily') return 'Tous les jours'
  const abbr: Record<string, string> = { Sun: 'dim.', Mon: 'lun.', Tue: 'mar.', Wed: 'mer.', Thu: 'jeu.', Fri: 'ven.', Sat: 'sam.' }
  return compact.replace(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/g, (d) => abbr[d])
}

// ─── English data strings (lib/constants/train-*.ts, lib/utils/train-stations.ts,
// lib/utils/intercity.ts) → French. The data files stay English; screens call
// trData() at render. Aligned with the web's lib/i18n/train-fr.ts. ───

const DATA_FR: Record<string, string> = {
  // Search + fares
  'Pick two stations from the suggestions.': 'Choisissez deux gares dans la liste.',
  'Choose two different stations.': 'Choisissez deux gares différentes.',
  'Fare unconfirmed': 'Tarif non confirmé',
  'Fare not published · confirm at the station': 'Tarif non publié · à confirmer en gare',
  'Fare not published · confirm at station': 'Tarif non publié · à confirmer en gare',
  'Fare: confirm at station': `Tarif${NB}: à confirmer en gare`,
  'Fare unconfirmed (GRCL site lists GH₵5–GH₵7) · confirm at station': 'Tarif non confirmé (le site de GRCL indique GH₵5–GH₵7) · à confirmer en gare',
  'Fare unconfirmed (GRCL site lists GH₵5–GH₵7) · confirm at station.': 'Tarif non confirmé (le site de GRCL indique GH₵5–GH₵7) · à confirmer en gare.',
  'GH₵10 to Doryumu JC (child GH₵5) · other stops: confirm at station': `GH₵10 jusqu'à Doryumu JC (enfant GH₵5) · autres arrêts${NB}: à confirmer en gare`,
  'Afienya–Adomi fares other than Doryumu Junction are not published — confirm at station.':
    "Les tarifs Afienya–Adomi autres que Doryumu Junction ne sont pas publiés — à confirmer en gare.",
  'Buy the train card at the station (GRDA lists the card at GH₵10 adult, GH₵5 child). Troski does not sell train tickets.':
    'Achetez la carte de train en gare (GRDA indique GH₵10 adulte, GH₵5 enfant). Troski ne vend pas de billets de train.',
  'Adomi (full trip)': 'Adomi (trajet complet)',
  'launch fares, Oct 2025, may have changed': 'tarifs de lancement, oct. 2025, peut-être modifiés',
  // Run notes
  'Last train (Adomi mop-up)': "Dernier train (navette retour d'Adomi)",
  'Direction wording unclear on GRDA site — confirm at station': 'Sens peu clair sur le site de GRDA — à confirmer en gare',
  'Arrival time unclear on GRDA site': "Heure d'arrivée peu claire sur le site de GRDA",
  // Line info (sources and notes)
  'last published schedule — confirm at station': 'dernier horaire publié — à confirmer en gare',
  'per GRDA website · checked 14 Oct 2026': 'selon le site de GRDA · vérifié le 14 oct. 2026',
  'Run by Ghana Railway Company Ltd (GRCL). Times are the last published schedule — confirm at the station.':
    'Exploitée par Ghana Railway Company Ltd (GRCL). Les horaires sont les derniers publiés — confirmez en gare.',
  'Last published as Monday to Saturday. Confirm Sunday service at the station.':
    `Dernier horaire publié${NB}: du lundi au samedi. Confirmez le service du dimanche en gare.`,
  'Some reports also list an Avenor stop between Odaw and Alajo — confirm at the station.':
    'Certaines sources signalent aussi un arrêt à Avenor entre Odaw et Alajo — à confirmer en gare.',
  'Two shuttles that meet at Afienya — not one through train. Change at Afienya.':
    'Deux navettes qui se rejoignent à Afienya — pas de train direct. Changez à Afienya.',
  'Tema Harbour – Afienya shuttle stops at Tema Industrial Area and Ashaiman.':
    "La navette Tema Harbour – Afienya s'arrête à Tema Industrial Area et Ashaiman.",
  'Afienya – Adomi shuttle stops at Shai Hills, Doryumu Junction, Akuse Halt, Kpong and Senchi Halt.':
    "La navette Afienya – Adomi s'arrête à Shai Hills, Doryumu Junction, Akuse Halt, Kpong et Senchi Halt.",
  'No passenger trains to Juapong or Mpakadan — Mpakadan is a freight terminal.':
    'Aucun train de voyageurs vers Juapong ou Mpakadan — Mpakadan est un terminal de fret.',
  'Two shuttles from Kojokrom: one to Sekondi (via Gyandu Halt), one to Takoradi (via Ketan, Adiembra, Essaman and Butuah).':
    `Deux navettes au départ de Kojokrom${NB}: l'une vers Sekondi (par Gyandu Halt), l'autre vers Takoradi (par Ketan, Adiembra, Essaman et Butuah).`,
  'Shuttle buses run from Takoradi station to the business district.':
    'Des bus navettes relient la gare de Takoradi au quartier des affaires.',
  // News (Troski's own words)
  'Reported in Ghanaian media': 'Rapporté par les médias ghanéens',
  'Reported in Ghanaian media, May 2026': 'Rapporté par les médias ghanéens, mai 2026',
  'Ministry of Transport': 'Ministère des Transports',
  'GRDA website': 'site de GRDA',
  'Freight services planned on the Tema–Afienya–Adomi corridor': "Trains de fret prévus sur l'axe Tema–Afienya–Adomi",
  'Freight trains were expected to start around mid-October 2026 (unconfirmed). Passenger times could change, so check at the station.':
    `Des trains de fret devaient démarrer vers la mi-octobre 2026 (non confirmé). Les horaires des voyageurs pourraient changer${NB}: vérifiez en gare.`,
  'Livestock struck on the Tema–Afienya section': 'Du bétail heurté sur le tronçon Tema–Afienya',
  'On 30 July 2026 a passenger train hit goats on the track. GRDA asked residents to keep animals off the line and not to put stones on the rails.':
    'Le 30 juillet 2026, un train de voyageurs a heurté des chèvres sur la voie. GRDA a demandé aux riverains de tenir les animaux loin de la ligne et de ne pas poser de pierres sur les rails.',
  'Cattle on the line halt Accra–Tema service for a day': `Du bétail sur la voie${NB}: le service Accra–Tema arrêté une journée`,
  'On 21 May 2026 a train came off the rails after striking stray cattle near Avenor, and service was suspended for the rest of that day.':
    'Le 21 mai 2026, un train a déraillé après avoir heurté du bétail errant près d\'Avenor, et le service a été suspendu pour le reste de la journée.',
  'Accra–Nsawam: no passenger trains yet': `Accra–Nsawam${NB}: pas encore de trains de voyageurs`,
  'In May 2026 GRDA said the line could take about 17 months to finish once dedicated funding was in place. No passenger trains run on it.':
    "En mai 2026, GRDA a indiqué que la ligne pourrait être achevée en 17 mois environ une fois un financement dédié trouvé. Aucun train de voyageurs n'y circule.",
  'Western Region commuter trains back in service': 'Retour des trains de banlieue dans la région Ouest',
  'Passenger trains between Sekondi, Kojokrom and Takoradi resumed on 24 April 2026 after rehabilitation, with shuttle buses linking Takoradi station to the business district.':
    'Les trains de voyageurs entre Sekondi, Kojokrom et Takoradi ont repris le 24 avril 2026 après rénovation, avec des bus navettes entre la gare de Takoradi et le quartier des affaires.',
  'Signalling funding for the Tema line': 'Financement de la signalisation pour la ligne de Tema',
  'In April 2026 a €20m EU grant for new signalling was reported as approved, with a final decision expected in October 2026. Better signalling could allow more trains a day.':
    `En avril 2026, une subvention de l'UE de 20${NB}M€ pour une nouvelle signalisation a été annoncée comme approuvée, avec une décision finale attendue en octobre 2026. Une meilleure signalisation pourrait permettre plus de trains par jour.`,
  'Commuters push for evening trains on Tema–Afienya': 'Les usagers demandent des trains en soirée sur Tema–Afienya',
  'In January 2026 residents asked for longer operating hours so the service fits the working day.':
    'En janvier 2026, des habitants ont demandé des horaires plus étendus pour que le service corresponde à la journée de travail.',
  'Tema–Afienya–Adomi opens to passengers': 'Tema–Afienya–Adomi ouvre aux voyageurs',
  'GRDA began commercial passenger services on the new standard-gauge line on 1 October 2025.':
    'GRDA a lancé le service commercial de voyageurs sur la nouvelle ligne à écartement standard le 1er octobre 2025.',
  Disruption: 'Perturbation',
  Project: 'Projet',
  Safety: 'Sécurité',
  // Line status
  Running: 'En service',
  'Not running': 'Hors service',
  Planned: 'En projet',
  'Two trains a day on the last published schedule. Confirm times at the station.':
    'Deux trains par jour selon le dernier horaire publié. Confirmez les horaires en gare.',
  'Two shuttles, daily. Change at Afienya.': 'Deux navettes, tous les jours. Changez à Afienya.',
  'Two shuttles from Kojokrom, daily.': 'Deux navettes au départ de Kojokrom, tous les jours.',
  'Infrastructure partly built. GRDA says about 17 months to finish once funded.':
    'Infrastructure en partie construite. Selon GRDA, environ 17 mois de travaux une fois le financement trouvé.',
  'Planned, freight-led. No passenger trains.': "En projet, d'abord pour le fret. Pas de trains de voyageurs.",
  // Safety
  'Stay safe near the tracks': 'Restez prudents près des voies',
  'Keep animals and children off the railway line.': 'Tenez les animaux et les enfants loin de la voie ferrée.',
  'Never walk, sit or trade on the tracks.': 'Ne marchez pas, ne vous asseyez pas et ne vendez pas sur les voies.',
  'Report anyone throwing stones at trains or placing objects on the rails.':
    'Signalez toute personne qui jette des pierres sur les trains ou pose des objets sur les rails.',
  // How to ride
  'Buy the train card at the station': 'Achetez la carte de train en gare',
  'Buy the train card at the station (GRDA lists the card at GH₵10 adult, GH₵5 child), then pay your fare with it. Troski does not sell train tickets.':
    'Achetez la carte de train en gare (GRDA indique GH₵10 adulte, GH₵5 enfant), puis payez votre trajet avec. Troski ne vend pas de billets de train.',
  'Change at Afienya': 'Changez à Afienya',
  'The Tema–Mpakadan line runs as two shuttles: Tema Harbour–Afienya and Afienya–Adomi. To go beyond Afienya, change trains there. There is no passenger train to Mpakadan.':
    `La ligne Tema–Mpakadan fonctionne en deux navettes${NB}: Tema Harbour–Afienya et Afienya–Adomi. Pour aller au-delà d'Afienya, changez de train là-bas. Il n'y a pas de train de voyageurs vers Mpakadan.`,
  'Arrive early': 'Arrivez en avance',
  "Services are limited and the train doesn't wait. Get to the platform at least 10 minutes before departure.":
    "Les trains sont peu nombreux et n'attendent pas. Soyez sur le quai au moins 10 minutes avant le départ.",
  'Service days': 'Jours de circulation',
  "GRDA lists the Tema–Afienya–Adomi and Sekondi–Takoradi trains as daily. Tema–Accra's last published timetable is Monday to Saturday — confirm Sunday service at the station.":
    'Selon GRDA, les trains Tema–Afienya–Adomi et Sekondi–Takoradi circulent tous les jours. Le dernier horaire publié de Tema–Accra va du lundi au samedi — confirmez le service du dimanche en gare.',
  'Where fares come from': "D'où viennent les tarifs",
  "Tema–Afienya–Adomi and Sekondi–Takoradi fares are from the GRDA website (checked 14 Oct 2026). The Tema–Accra fare is unconfirmed (GRCL's site lists GH₵5–GH₵7). Where no fare is published we say so — confirm at the counter.":
    "Les tarifs Tema–Afienya–Adomi et Sekondi–Takoradi viennent du site de GRDA (vérifiés le 14 oct. 2026). Le tarif Tema–Accra n'est pas confirmé (le site de GRCL indique GH₵5–GH₵7). Quand aucun tarif n'est publié, nous le disons — confirmez au guichet.",
  // Line facts
  'Suburban commuter service run by GRCL — last published schedule.': 'Train de banlieue exploité par GRCL — dernier horaire publié.',
  'Connects Tema (Community 1) and Accra Central along the coastal corridor.': 'Relie Tema (Community 1) et Accra Central le long de la côte.',
  'Two services a day on the last published schedule — 06:00 from Tema, 17:40 return from Accra.':
    "Deux trains par jour selon le dernier horaire publié — 06:00 au départ de Tema, retour à 17:40 au départ d'Accra.",
  'Last published as Monday to Saturday — confirm Sunday service at the station.':
    'Dernier horaire publié du lundi au samedi — confirmez le service du dimanche en gare.',
  'Some reports list an Avenor stop between Odaw and Alajo — confirm at the station.':
    'Certaines sources signalent un arrêt à Avenor entre Odaw et Alajo — à confirmer en gare.',
  'Commercial service since 1 October 2025 — two shuttles that meet at Afienya.':
    'Service commercial depuis le 1er octobre 2025 — deux navettes qui se rejoignent à Afienya.',
  'Tema Harbour–Afienya shuttle (stops Tema Industrial Area, Ashaiman) and Afienya–Adomi shuttle (stops Shai Hills, Doryumu Junction, Akuse Halt, Kpong, Senchi Halt).':
    'Navette Tema Harbour–Afienya (arrêts Tema Industrial Area, Ashaiman) et navette Afienya–Adomi (arrêts Shai Hills, Doryumu Junction, Akuse Halt, Kpong, Senchi Halt).',
  'Change at Afienya — there is no through train.': "Changez à Afienya — il n'y a pas de train direct.",
  'No passenger trains to Juapong or Mpakadan; Mpakadan is a freight terminal.':
    `Aucun train de voyageurs vers Juapong ou Mpakadan${NB}; Mpakadan est un terminal de fret.`,
  'Standard-gauge line built towards Mpakadan near Akosombo.': "Ligne à écartement standard construite vers Mpakadan, près d'Akosombo.",
  'Relaunched 24 April 2026 — two daily shuttles from Kojokrom.': 'Relancée le 24 avril 2026 — deux navettes quotidiennes au départ de Kojokrom.',
  'Kojokrom–Sekondi via Gyandu Halt: GH₵5 adult, GH₵3 child.': `Kojokrom–Sekondi par Gyandu Halt${NB}: GH₵5 adulte, GH₵3 enfant.`,
  'Kojokrom–Takoradi via Ketan, Adiembra, Essaman and Butuah: GH₵7 adult, GH₵4 child.':
    `Kojokrom–Takoradi par Ketan, Adiembra, Essaman et Butuah${NB}: GH₵7 adulte, GH₵4 enfant.`,
  // Travel (intercity bus) data
  'STC booking site': 'site de réservation STC',
  'VIP booking site': 'site de réservation VIP',
  'Class not stated': 'Classe non précisée',
  'Luxury van': 'Minibus de luxe',
  'after the 26 Sep 2026 fare review': `après la révision des tarifs du 26${NB}sept. 2026`,
}

/** English data string → French (exact match, then short patterns); English unchanged. */
export function trData(s: string | null | undefined, lang: Lang): string {
  if (!s) return ''
  if (lang !== 'fr') return s
  const hit = DATA_FR[s]
  if (hit) return hit
  return s
    .replace(/^after (\d\d:\d\d)$/, 'après $1')
    .replace(/^by about (\d\d:\d\d)$/, 'vers $1')
    .replace(/^by (\d\d:\d\d)$/, 'avant $1')
    .replace(/^about (\d\d:\d\d)$/, 'vers $1')
    .replace(/^No same-evening connection to (.+)$/, 'Pas de correspondance le soir même pour $1')
    .replace(/^No same-day connection to (.+)$/, 'Pas de correspondance le jour même pour $1')
    .replace(/^To (.+)$/, 'Vers $1')
    .replace(/^From GH₵/, 'Dès GH₵')
    .replace(/\bchild GH₵/g, 'enfant GH₵')
}

// ─── UI strings ───

const en: Record<string, string> = {
  // Shared train labels
  'train.title': 'Trains',
  'train.headerSub': 'Timetables from GRDA and GRCL · checked {date}',
  'train.accraTime': 'Times shown in Accra time',
  'train.today': 'Today',
  'train.tomorrow': 'Tomorrow',
  'train.todayLower': 'today',
  'train.tomorrowLower': 'tomorrow',
  // mid-sentence day word: English keeps the capital, French is lower case
  'train.todayMid': 'Today',
  'train.tomorrowMid': 'Tomorrow',
  'train.timetableChip': 'TIMETABLE',
  // was "Not live tracking" — rewritten so no string mentions live tracking
  'train.scheduledOnly': 'Scheduled times only',
  'train.timetable': 'Timetable',
  'train.fareUnconfirmed': 'Fare unconfirmed',
  'train.minDeparts': 'min · departs {time}',
  'train.a11yDepartsAt': 'Departs at {time}, {when}',
  'train.lineName': '{line} line',
  'train.nStations': '{n} stations',
  'train.about': 'about {time}',
  // Next-train card
  'train.nextTrainLine': 'NEXT TRAIN · {line} LINE',
  'train.lineUpper': '{line} LINE',
  'train.noTrainsOn': 'No trains on {day}',
  'train.noMoreToday': 'No more trains today',
  'train.nextFrom': 'Next: {day} {time} from {origin}',
  'train.reminderSetBefore': 'Reminder set · {n} min before the {time}',
  'train.remindBefore': 'Remind me before the {time}',
  'train.remindBeforeTo': 'Remind me before the {time} to {dest}',
  'train.a11yReminderSetFor': 'Reminder set for the {time} from {origin}. Tap to cancel',
  'train.a11yRemindFull': 'Remind me {n} minutes before the {time} from {origin} to {dest}',
  // Departures list
  'train.departures': 'Departures · {day}',
  'train.departedScheduled': 'Departed (scheduled)',
  'train.a11yDepRow': '{time} from {origin} to {dest}',
  'train.a11yDepRowPast': 'Departed, scheduled {time} from {origin} to {dest}',
  'train.a11yArrives': ', arrives {time}',
  'train.a11yLine': ', {line} line',
  'train.showFewer': 'Show fewer',
  'train.showAllToday': "Show all today's trains",
  'train.showAllTomorrow': "Show all tomorrow's trains",
  'train.showAllDay': "Show all {day}'s trains",
  // My trip
  'train.myTrip': 'MY TRIP',
  'train.change': 'Change',
  'train.a11yChangeTrip': 'Change saved trip',
  'train.whenArrives': '{when} · arrives {time}',
  'train.leaves': 'Leaves {when}',
  'train.stopTimeNotPublished': '{station} time not published — {time} is when it leaves {origin}.',
  'train.a11yReminderOnCancel': 'Reminder on. Tap to cancel',
  'train.a11yRemindMinutes': 'Remind me {n} minutes before',
  'train.reminderOn': 'Reminder on',
  'train.remindMe': 'Remind me',
  'train.returnTimes': 'Return times',
  'train.noDirectReturn': 'No direct return train.',
  'train.notifyAt': "We'll notify you at {time}. Works offline.",
  'train.noUpcoming': 'No upcoming departure found.',
  'train.noDirectAnyMore': 'There is no direct train for this trip any more. Tap Change to pick another.',
  // Find a train
  'train.a11yFindFrom': 'Find a train. From station: {name}',
  'train.a11yToStation': 'To station: {name}',
  'train.notChosen': 'not chosen',
  'train.from': 'From',
  'train.to': 'To',
  'train.chooseStation': 'Choose station',
  'train.a11ySwap': 'Swap From and To',
  'train.noDirectBetween': 'No direct train between {from} and {to}.',
  'train.changeAtShuttles': 'Change at {via} · two separate shuttles',
  // was "... Timetable times, not live tracking." — rewritten (no live wording)
  'train.transferNote': '{days} · check the connection time at {via}. Scheduled times only.',
  'train.afterByNote': '“after” / “by” = the train’s first or last stop time. GRDA does not publish times for every stop.',
  'train.savedAsMyTrip': 'Saved as My trip',
  'train.saveAsMyTrip': 'Save as My trip',
  'train.fromStation': 'From station',
  'train.toStation': 'To station',
  'train.a11yClosePicker': 'Close station picker',
  'train.a11yChoose': 'Choose {name}',
  // Akosombo, lines, how to ride
  'train.akosomboQ': 'Going to Akosombo? ',
  'train.akosomboA': 'Take the Tema–Afienya train, change at Afienya, then ride to Adomi, the last passenger stop. There is no passenger train to Mpakadan.',
  'train.noLinesTitle': 'No train lines yet',
  'train.noLinesSub': 'Train lines will appear here once available',
  'train.a11yLineDetails': '{line} line details',
  'train.howToRide': 'How to ride',
  // Rail news + status
  'train.railNews': 'Rail news',
  'train.lineNews': 'Line news',
  'train.newsIntro': 'In our own words. Official sources open when tapped.',
  'train.opensInBrowser': ' Opens in browser.',
  'train.lineStatus': 'LINE STATUS',
  // was "Running = a published timetable exists. Not live tracking." — rewritten
  'train.runningNote': 'Running = a published timetable exists. Scheduled times only.',
  // Line page
  'train.loadLineError': "Couldn't load this train line. Check your connection.",
  'train.lineNotFound': 'Line not found',
  'train.grdaTrain': 'GRDA TRAIN',
  'train.timetableNotYet': 'Timetable not available yet',
  'train.checkTimesShare': 'Check times at the station. Seen the train? Share an update below.',
  'train.nextTrainTo': 'NEXT TRAIN · TO {dest}',
  'train.boardFromArrives': 'From {origin} · arrives {dest} {time} · {fare}',
  'train.a11yRemindTrain': 'Remind me {n} minutes before the {time} train',
  'train.reminderSetMin': 'Reminder set · {n} min before',
  'train.onItsWayTo': 'ON ITS WAY · TO {dest}',
  'train.near': 'Near {station}',
  'train.nextStopAt': 'Next stop {station} at {time} · ',
  'train.nextStop': 'Next stop {station} · ',
  'train.arrivesDest': 'arrives {dest} {time}',
  'train.nextLabel': 'Next: ',
  'train.fromSuffix': ' from {station}',
  'train.confirmAtStation': 'Confirm at the station.',
  'train.changeAt': 'Change at {station}',
  'train.stopsTimes': 'Stops & times',
  'train.aToB': '{from} to {to}',
  'train.a11yTimeNotPublished': ', time not published',
  'train.departs': 'Departs',
  'train.arrives': 'Arrives',
  'train.timeNotPublished': 'Time not published',
  // was "Timetable · not live tracking · {source}" — rewritten
  'train.scheduledSource': 'Scheduled times · {source}',
  'train.confirmAtStationLower': 'confirm at the station',
  'train.childFare': ' · child GH₵{n}',
  'train.otherTmpStops': 'Other Afienya–Adomi stops: not published · confirm at station.',
  'train.launchFares': 'Reported at launch: {list} ({label}).',
  'train.aboutLine': 'About this line',
  'train.riderUpdates': 'Rider updates',
  'train.noRiderUpdates': 'No rider updates yet. Seen the train? Tell other riders.',
  'train.shareUpdate': 'Share an update',
  'train.thisStation': 'this station',
  'train.crowd.empty': 'empty',
  'train.crowd.few_seats': 'few seats',
  'train.crowd.standing': 'standing room only',
  'train.crowd.packed': 'packed',
  'train.reportCrowd': 'Train is {level} at {at}.',
  'train.reportDelay': 'Train running about {n} minutes late at {at}.',
  'train.reportSpotted': 'Train spotted at {at}.',
  'train.reportSpottedTo': 'Train spotted at {at}, heading to {dest}.',
  'train.reportUpdate': 'Update from {at}.',
  // Reminder alerts + notification (lib/services/trainReminders.ts)
  'train.alertTooCloseTitle': 'Departure too close',
  'train.alertTooCloseBody': 'This train leaves within {n} minutes — too late for a {n}-minute heads-up. Pick a later departure.',
  'train.alertNotifOffTitle': 'Notifications are off',
  'train.alertNotifOffBody': 'Troski needs notification permission from your phone to remind you. Turn it on in system Settings.',
  'train.alertNotNow': 'Not now',
  'train.alertOpenSettings': 'Open Settings',
  'train.notifTitle': '{line} departs in {n} min',
  'train.notifBody': '{origin} → {dest} · leaves {time}. Head to the platform.',

  // Travel (intercity bus fares)
  'travel.multiPrice': '{op} lists more than one price on this route; it depends on the bus and terminal.',
  'travel.departs': 'Departs {terminal}',
  'travel.fareNote': 'Fare {note}',
  'travel.a11ySource': 'Source: {site}, checked {date}. Opens {url}',
  'travel.sourceChecked': 'Source: {site} · checked {date}',
  'travel.cedis': '{n} cedis',
  'travel.cedisRange': '{min} to {max} cedis',
  'travel.notFound': 'Travel fare not found',
  'travel.notFoundSub': 'We only list STC and VIP town pairs from their own booking sites.',
  'travel.seeAll': 'See all travel fares',
  'travel.kicker': 'TRAVEL · BUS FARE',
  'travel.fromTo': '{from} to {to}',
  'travel.operatorFares': 'Operator fares · checked {date}',
  'travel.confirm': 'Confirm at the terminal; fares can change.',
  'travel.noReverse': 'No operator fare listed for {from} to {to} yet.',

  // Terminals
  'terminals.back': 'Back',
  'terminals.title': 'Terminals',
  'terminals.nearestFirst': 'Nearest first',
  'terminals.subtitle': 'Bus stations & lorry parks',
  'terminals.searchPlaceholder': 'Where would you like to go?',
  'terminals.locPrompt': 'Turn on location to sort terminals by distance',
  'terminals.loading': 'Loading terminals…',
  'terminals.loadError': "Couldn't load terminals. Check your connection.",
  'terminals.noMatch': 'No terminals match',
  'terminals.noneYet': 'No terminals yet',
  'terminals.tryOther': 'Try a different name.',
  'terminals.appearHere': 'Terminals appear here as routes are mapped.',
  'terminals.nearby': 'Nearby Terminals',
  'terminals.all': 'All Terminals',
  'terminals.route1': '1 route',
  'terminals.routesN': '{n} routes',
  'terminals.major': 'Major station',
  'terminals.queue.empty': 'Empty queue',
  'terminals.queue.short': 'Short queue',
  'terminals.queue.moderate': 'Moderate queue',
  'terminals.queue.long': 'Long queue',
  'terminals.queue.very_long': 'Very Long queue',
  'terminals.queueReported': 'Queue reported {ago}',
}

const fr: Record<string, string> = {
  'train.title': 'Trains', // same word in French; needs SAME_OK
  'train.headerSub': 'Horaires GRDA et GRCL · vérifiés le {date}',
  'train.accraTime': "Heures affichées à l'heure d'Accra",
  'train.today': "Aujourd'hui",
  'train.tomorrow': 'Demain',
  'train.todayLower': "aujourd'hui",
  'train.tomorrowLower': 'demain',
  'train.todayMid': "aujourd'hui",
  'train.tomorrowMid': 'demain',
  'train.timetableChip': 'HORAIRES',
  'train.scheduledOnly': 'Horaires prévus uniquement',
  'train.timetable': 'Horaires',
  'train.fareUnconfirmed': 'Tarif non confirmé',
  'train.minDeparts': 'min · départ {time}',
  'train.a11yDepartsAt': 'Départ à {time}, {when}',
  'train.lineName': 'Ligne {line}',
  'train.nStations': '{n} gares',
  'train.about': 'vers {time}',
  'train.nextTrainLine': 'PROCHAIN TRAIN · LIGNE {line}',
  'train.lineUpper': 'LIGNE {line}',
  'train.noTrainsOn': 'Pas de train le {day}',
  'train.noMoreToday': "Plus de train aujourd'hui",
  'train.nextFrom': `Prochain${NB}: {day} {time} au départ {origin}`,
  'train.reminderSetBefore': 'Rappel activé · {n} min avant {time}',
  'train.remindBefore': 'Me rappeler avant {time}',
  'train.remindBeforeTo': 'Me rappeler avant {time} pour {dest}',
  'train.a11yReminderSetFor': 'Rappel activé pour le train de {time} au départ {origin}. Touchez pour annuler',
  'train.a11yRemindFull': 'Me rappeler {n} minutes avant le train de {time} au départ {origin}, vers {dest}',
  'train.departures': 'Départs · {day}',
  'train.departedScheduled': 'Parti (horaire prévu)',
  'train.a11yDepRow': '{time} au départ {origin}, vers {dest}',
  'train.a11yDepRowPast': 'Parti, prévu à {time} au départ {origin}, vers {dest}',
  'train.a11yArrives': ', arrivée {time}',
  'train.a11yLine': ', ligne {line}',
  'train.showFewer': 'Voir moins',
  'train.showAllToday': 'Voir tous les trains du jour',
  'train.showAllTomorrow': 'Voir tous les trains de demain',
  'train.showAllDay': 'Voir tous les trains de {day}',
  'train.myTrip': 'MON TRAJET',
  'train.change': 'Modifier',
  'train.a11yChangeTrip': 'Modifier le trajet enregistré',
  'train.whenArrives': '{when} · arrivée {time}',
  'train.leaves': 'Départ {when}',
  'train.stopTimeNotPublished': "Horaire non publié pour {station} — {time} est l'heure de départ {origin}.",
  'train.a11yReminderOnCancel': 'Rappel activé. Touchez pour annuler',
  'train.a11yRemindMinutes': 'Me rappeler {n} minutes avant',
  'train.reminderOn': 'Rappel activé',
  'train.remindMe': 'Me rappeler',
  'train.returnTimes': 'Horaires retour',
  'train.noDirectReturn': 'Pas de train retour direct.',
  'train.notifyAt': 'Nous vous préviendrons à {time}. Fonctionne hors ligne.',
  'train.noUpcoming': 'Aucun prochain départ trouvé.',
  'train.noDirectAnyMore': "Il n'y a plus de train direct pour ce trajet. Touchez Modifier pour en choisir un autre.",
  'train.a11yFindFrom': `Trouver un train. Gare de départ${NB}: {name}`,
  'train.a11yToStation': `Gare d'arrivée${NB}: {name}`,
  'train.notChosen': 'non choisie',
  'train.from': 'Départ',
  'train.to': 'Arrivée',
  'train.chooseStation': 'Choisir une gare',
  'train.a11ySwap': 'Inverser départ et arrivée',
  'train.noDirectBetween': 'Pas de train direct entre {from} et {to}.',
  'train.changeAtShuttles': 'Changement à {via} · deux navettes distinctes',
  'train.transferNote': "{days} · vérifiez l'heure de correspondance à {via}. Horaires prévus uniquement.",
  'train.afterByNote': `«${NB}après${NB}» / «${NB}avant${NB}» = l'heure du premier ou du dernier arrêt du train. GRDA ne publie pas l'heure de chaque arrêt.`,
  'train.savedAsMyTrip': 'Enregistré comme Mon trajet',
  'train.saveAsMyTrip': 'Enregistrer comme Mon trajet',
  'train.fromStation': 'Gare de départ',
  'train.toStation': "Gare d'arrivée",
  'train.a11yClosePicker': 'Fermer la liste des gares',
  'train.a11yChoose': 'Choisir {name}',
  'train.akosomboQ': `Vous allez à Akosombo${NB}? `,
  'train.akosomboA': "Prenez le train Tema–Afienya, changez à Afienya, puis continuez jusqu'à Adomi, le dernier arrêt voyageurs. Il n'y a pas de train de voyageurs vers Mpakadan.",
  'train.noLinesTitle': "Aucune ligne de train pour l'instant",
  'train.noLinesSub': "Les lignes de train apparaîtront ici dès qu'elles seront disponibles",
  'train.a11yLineDetails': 'Détails de la ligne {line}',
  'train.howToRide': 'Comment prendre le train',
  'train.railNews': 'Actualités ferroviaires',
  'train.lineNews': 'Actualités de la ligne',
  'train.newsIntro': 'Résumé par Troski. Touchez pour ouvrir les sources officielles.',
  'train.opensInBrowser': " S'ouvre dans le navigateur.",
  'train.lineStatus': 'ÉTAT DES LIGNES',
  'train.runningNote': 'En service = un horaire publié existe. Horaires prévus uniquement.',
  'train.loadLineError': 'Impossible de charger cette ligne de train. Vérifiez votre connexion.',
  'train.lineNotFound': 'Ligne introuvable',
  'train.grdaTrain': 'TRAIN GRDA',
  'train.timetableNotYet': 'Horaires pas encore disponibles',
  'train.checkTimesShare': `Vérifiez les horaires en gare. Vous avez vu le train${NB}? Partagez une info ci-dessous.`,
  'train.nextTrainTo': 'PROCHAIN TRAIN · VERS {dest}',
  'train.boardFromArrives': 'Départ {origin} · arrivée à {dest} {time} · {fare}',
  'train.a11yRemindTrain': 'Me rappeler {n} minutes avant le train de {time}',
  'train.reminderSetMin': 'Rappel activé · {n} min avant',
  'train.onItsWayTo': 'EN ROUTE · VERS {dest}',
  'train.near': 'Près {station}',
  'train.nextStopAt': 'Prochain arrêt {station} à {time} · ',
  'train.nextStop': 'Prochain arrêt {station} · ',
  'train.arrivesDest': 'arrivée à {dest} {time}',
  'train.nextLabel': `Prochain${NB}: `,
  'train.fromSuffix': ' au départ {station}',
  'train.confirmAtStation': 'Confirmez en gare.',
  'train.changeAt': 'Changement à {station}',
  'train.stopsTimes': 'Arrêts et horaires',
  'train.aToB': '{from} vers {to}',
  'train.a11yTimeNotPublished': ', horaire non publié',
  'train.departs': 'Départ',
  'train.arrives': 'Arrivée',
  'train.timeNotPublished': 'Horaire non publié',
  'train.scheduledSource': 'Horaires prévus · {source}',
  'train.confirmAtStationLower': 'à confirmer en gare',
  'train.childFare': ' · enfant GH₵{n}',
  'train.otherTmpStops': `Autres arrêts Afienya–Adomi${NB}: non publiés · à confirmer en gare.`,
  'train.launchFares': `Annoncés au lancement${NB}: {list} ({label}).`,
  'train.aboutLine': 'À propos de cette ligne',
  'train.riderUpdates': 'Infos des voyageurs',
  'train.noRiderUpdates': `Aucune info de voyageur pour l'instant. Vous avez vu le train${NB}? Dites-le aux autres.`,
  'train.shareUpdate': 'Partager une info',
  'train.thisStation': 'cette gare',
  'train.crowd.empty': 'vide',
  'train.crowd.few_seats': 'quelques places',
  'train.crowd.standing': 'places debout uniquement',
  'train.crowd.packed': 'bondé',
  'train.reportCrowd': `Affluence à {at}${NB}: {level}.`,
  'train.reportDelay': "Train en retard d'environ {n} minutes à {at}.",
  'train.reportSpotted': 'Train aperçu à {at}.',
  'train.reportSpottedTo': 'Train aperçu à {at}, vers {dest}.',
  'train.reportUpdate': `Info${NB}: {at}.`,
  'train.alertTooCloseTitle': 'Départ trop proche',
  'train.alertTooCloseBody': "Ce train part dans moins de {n} minutes — trop tard pour un rappel {n} minutes avant. Choisissez un départ plus tard.",
  'train.alertNotifOffTitle': 'Notifications désactivées',
  'train.alertNotifOffBody': "Troski a besoin de l'autorisation de notifications de votre téléphone pour vous prévenir. Activez-la dans les Réglages du système.",
  'train.alertNotNow': 'Plus tard',
  'train.alertOpenSettings': 'Ouvrir les Réglages',
  'train.notifTitle': '{line} part dans {n} min',
  'train.notifBody': '{origin} → {dest} · départ {time}. Rendez-vous sur le quai.',

  'travel.multiPrice': `{op} affiche plusieurs prix sur ce trajet${NB}; cela dépend du car et de la gare routière.`,
  'travel.departs': `Départ${NB}: {terminal}`,
  'travel.fareNote': 'Tarif {note}',
  'travel.a11ySource': `Source${NB}: {site}, vérifié le {date}. Ouvre {url}`,
  'travel.sourceChecked': `Source${NB}: {site} · vérifié le {date}`,
  'travel.cedis': '{n} cédis',
  'travel.cedisRange': '{min} à {max} cédis',
  'travel.notFound': 'Tarif de voyage introuvable',
  'travel.notFoundSub': 'Nous ne listons que les trajets STC et VIP publiés sur leurs propres sites de réservation.',
  'travel.seeAll': 'Voir tous les tarifs de voyage',
  'travel.kicker': 'VOYAGES · TARIF DU CAR',
  'travel.fromTo': '{from} à {to}',
  'travel.operatorFares': 'Tarifs des compagnies · vérifiés le {date}',
  'travel.confirm': `Confirmez à la gare routière${NB}; les tarifs peuvent changer.`,
  'travel.noReverse': "Aucun tarif de compagnie pour {from} → {to} pour l'instant.",

  'terminals.back': 'Retour',
  'terminals.title': 'Gares routières',
  'terminals.nearestFirst': "Les plus proches d'abord",
  'terminals.subtitle': 'Gares de cars et de trotros',
  'terminals.searchPlaceholder': `Où voulez-vous aller${NB}?`,
  'terminals.locPrompt': 'Activez la localisation pour trier les gares par distance',
  'terminals.loading': 'Chargement des gares…',
  'terminals.loadError': 'Impossible de charger les gares. Vérifiez votre connexion.',
  'terminals.noMatch': 'Aucune gare ne correspond',
  'terminals.noneYet': "Aucune gare pour l'instant",
  'terminals.tryOther': 'Essayez un autre nom.',
  'terminals.appearHere': 'Les gares apparaissent ici à mesure que les lignes sont cartographiées.',
  'terminals.nearby': 'Gares à proximité',
  'terminals.all': 'Toutes les gares',
  'terminals.route1': '1 ligne',
  'terminals.routesN': '{n} lignes',
  'terminals.major': 'Grande gare',
  'terminals.queue.empty': 'File vide',
  'terminals.queue.short': 'File courte',
  'terminals.queue.moderate': 'File moyenne',
  'terminals.queue.long': 'File longue',
  'terminals.queue.very_long': 'File très longue',
  'terminals.queueReported': 'File signalée {ago}',
}

// Data strings also go through the shared checks (typography, no live claims).
for (const [e, f] of Object.entries(DATA_FR)) {
  en[`train.data.${e}`] = e
  fr[`train.data.${e}`] = f
}

export const train: ScreenDict = { en, fr }
