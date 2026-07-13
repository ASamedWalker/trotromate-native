// LEGAL NOTE: neutral factual bulletins in Troski's OWN words — public facts,
// NOT reproductions of any media outlet's article, and NO links to media orgs.
// Facts aren't copyrightable; naming/quoting/linking a publication is the risk,
// so we don't. Keep this style when refreshing.
export interface NetworkBulletin { tag: "SERVICE UPDATE" | "NETWORK UPDATE" | "NOTICE"; date: string; text: string }

export const NETWORK_BULLETINS: NetworkBulletin[] = [
  { tag: "SERVICE UPDATE", date: "2026-04-24", text: "Passenger service on the 15 km Kojokrom–Sekondi–Takoradi commuter line resumed in April 2026 after rehabilitation." },
  { tag: "SERVICE UPDATE", date: "2025-10-01", text: "The new 96.7 km standard-gauge Tema–Mpakadan line began commercial passenger service in October 2025, running between Tema Port and Mpakadan, near Akosombo." },
  { tag: "NETWORK UPDATE", date: "2025-09-01", text: "A new standard-gauge railway from Nsawam through Kumasi to Paga has been announced as part of Ghana's national rail expansion." },
  { tag: "NETWORK UPDATE", date: "2025-09-02", text: "Feasibility studies are underway for new Accra suburban rail toward Kasoa, Winneba and Madina — early-stage, not yet operational." },
  { tag: "NOTICE", date: "2026-07-12", text: "Schedules and fares shown are indicative and compiled from public announcements — always confirm current times and prices at the station." },
]

export interface RideTip { title: string; text: string }
export const HOW_TO_RIDE: RideTip[] = [
  { title: "Pay with Tap n' Go", text: "Ghana's rail uses the contactless Tap n' Go card — the same card as road transport. Tap on the validator at the station; the system charges the correct fare. Buy or top up a card at the station." },
  { title: "No cash on board", text: "Fares aren't collected on the train. Sort your Tap n' Go card at the station counter before you board." },
  { title: "Arrive early", text: "Services are limited (often two a day) and depart on time — the train doesn't wait. Get to the platform at least 10 minutes before departure." },
  { title: "No Sunday service", text: "Commuter lines run Monday–Saturday (the Kojokrom–Sekondi–Takoradi shuttle runs Monday–Friday). There is no Sunday service on any line." },
  { title: "Fares are official", text: "Prices shown are GRDA's official station fares — no middlemen, no markups. Confirm the current fare at the counter." },
]

export interface LineStatus { status: "running" | "resumed" | "new"; statusNote: string; facts: string[] }
export const LINE_STATUS: Record<string, LineStatus> = {
  TMA: { status: "running", statusNote: "Suburban commuter service, Monday–Saturday.", facts: ["Connects Tema and Accra Central along the coastal corridor.", "Two services a day — 06:00 from Tema, 17:40 return from Accra.", "Flat GH₵15 fare, paid via Tap n' Go."] },
  TMP: { status: "running", statusNote: "Commercial service since 1 October 2025.", facts: ["96.7 km standard-gauge line, Tema Port to Mpakadan (Akosombo).", "Operated with two Polish-built Pesa diesel multiple units.", "Crosses a 300-metre rail bridge over the Volta River near Senchi.", "Zone fares: Tema–Afienya GH₵15, Afienya–Adome GH₵25, full trip GH₵40.", "US$440m project funded by the Export–Import Bank of India."] },
  STK: { status: "resumed", statusNote: "Reopened 24 April 2026 after a two-year suspension.", facts: ["15 km commuter shuttle, Kojokrom–Sekondi–Takoradi (Western Region).", "Rehabilitated and relaunched under the railway 'Reset Agenda'.", "Runs Monday–Friday; reliability can vary as works continue."] },
}
