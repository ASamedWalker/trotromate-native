export interface RailNewsItem { date: string; title: string; body: string; source: string; url: string }

export const RAIL_NEWS: RailNewsItem[] = [
  { date: "2026-04-24", title: "Kojokrom–Sekondi–Takoradi passenger service resumes", body: "The 15 km Kojokrom–Sekondi–Takoradi commuter line reopened on 24 April 2026 after a two-year suspension and rehabilitation, part of the government's railway 'Reset Agenda'.", source: "Citi Newsroom", url: "https://www.citinewsroom.com/2026/04/transport-minister-relaunches-kojokrom-takoradi-railway-passenger-services/" },
  { date: "2025-10-01", title: "Tema–Mpakadan line begins commercial passenger service", body: "The new 96.7 km standard-gauge Tema–Mpakadan line began commercial passenger service on 1 October 2025, running two Polish-built Pesa diesel multiple units between Tema Port and Akosombo (Mpakadan).", source: "Graphic Online", url: "https://www.graphic.com.gh/news/general-news/grda-activates-tema-mpakadan-rail-services.html" },
  { date: "2025-09-01", title: "Nsawam–Kumasi–Paga standard-gauge line agreed", body: "Ghana signed a US$6.05bn agreement for a new standard-gauge railway from Nsawam (near Accra) through Kumasi to Paga on the Burkina Faso border, with a branch from Tamale to Yendi.", source: "Rail transport in Ghana (Wikipedia)", url: "https://en.wikipedia.org/wiki/Rail_transport_in_Ghana" },
  { date: "2025-09-02", title: "Feasibility study: Accra suburban rail to Kasoa, Winneba & Madina", body: "Government feasibility studies are examining new Accra suburban rail services toward Kasoa, Winneba and Madina, plus extensions northward — early-stage, not yet operational.", source: "Rail transport in Ghana (Wikipedia)", url: "https://en.wikipedia.org/wiki/Rail_transport_in_Ghana" },
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
