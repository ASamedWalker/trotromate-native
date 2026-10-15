// Copy of trotromate/lib/train-network.ts — keep in sync.
/**
 * Ghana rail network context — how-to-ride guidance and per-line facts for the
 * train surfaces (troski.me/train + per-line pages). INFORMATION ONLY (no booking).
 * Rail news + line status now live in lib/constants/train-news.ts (curated,
 * sourced, our own words). Last verified: 2026-10-14.
 */

// LEGAL NOTE (owner, 2026-10-15): all rail copy here and in train-news.ts is in
// Troski's OWN words — never reproduced article text or headlines — and names or
// links NO media outlet. Only official sources (GRDA, Ghana Railway Company Ltd,
// Ministry of Transport) may be named and linked. Keep this style when refreshing.

/** How to ride — practical, factual guidance riders actually ask for. */
export interface RideTip {
  title: string
  text: string
}

export const HOW_TO_RIDE: RideTip[] = [
  {
    title: "Buy the train card at the station",
    text: "Buy the train card at the station (GRDA lists the card at ₵10 adult, ₵5 child), then pay your fare with it. Troski does not sell train tickets.",
  },
  {
    title: "Change at Afienya",
    text: "The Tema–Mpakadan line runs as two shuttles: Tema Harbour–Afienya and Afienya–Adomi. To go beyond Afienya, change trains there. There is no passenger train to Mpakadan.",
  },
  {
    title: "Arrive early",
    text: "Services are limited and the train doesn't wait. Get to the platform at least 10 minutes before departure.",
  },
  {
    title: "Service days",
    text: "GRDA lists the Tema–Afienya–Adomi and Sekondi–Takoradi trains as daily. Tema–Accra's last published timetable is Monday to Saturday — confirm Sunday service at the station.",
  },
  {
    title: "Where fares come from",
    text: "Tema–Afienya–Adomi and Sekondi–Takoradi fares are from the GRDA website (checked 14 Oct 2026). The Tema–Accra fare is unconfirmed (GRCL's site lists ₵5–₵7). Where no fare is published we say so — confirm at the counter.",
  },
]

/** Per-line status + verified facts, keyed by schedule code (TMA/TMP/STK). */
/** How well-sourced this line's fare is. Only `confirmed` may be presented as
 *  an official fare; `unverified` is our own figure with no public source. */
export type FareConfidence = "confirmed" | "unverified"

export interface LineStatus {
  status: "running" | "resumed" | "new"
  statusNote: string
  facts: string[]
  fareConfidence: FareConfidence
  fareNote?: string
}

export const LINE_STATUS: Record<string, LineStatus> = {
  TMA: {
    fareConfidence: "unverified",
    fareNote: "Fare unconfirmed (GRCL site lists ₵5–₵7) · confirm at station.",
    status: "running",
    statusNote: "Suburban commuter service run by GRCL — last published schedule.",
    facts: [
      "Connects Tema (Community 1) and Accra Central along the coastal corridor.",
      "Two services a day on the last published schedule — 06:00 from Tema, 17:40 return from Accra.",
      "Last published as Monday to Saturday — confirm Sunday service at the station.",
      "Some reports list an Avenor stop between Odaw and Alajo — confirm at the station.",
    ],
  },
  TMP: {
    fareConfidence: "confirmed",
    fareNote: "Afienya–Adomi fares other than Doryumu Junction are not published — confirm at station.",
    status: "running",
    statusNote: "Commercial service since 1 October 2025 — two shuttles that meet at Afienya.",
    facts: [
      "Tema Harbour–Afienya shuttle (stops Tema Industrial Area, Ashaiman) and Afienya–Adomi shuttle (stops Shai Hills, Doryumu Junction, Akuse Halt, Kpong, Senchi Halt).",
      "Change at Afienya — there is no through train.",
      "No passenger trains to Juapong or Mpakadan; Mpakadan is a freight terminal.",
      "Standard-gauge line built towards Mpakadan near Akosombo.",
    ],
  },
  STK: {
    fareConfidence: "confirmed",
    status: "resumed",
    statusNote: "Relaunched 24 April 2026 — two daily shuttles from Kojokrom.",
    facts: [
      "Kojokrom–Sekondi via Gyandu Halt: ₵5 adult, ₵3 child.",
      "Kojokrom–Takoradi via Ketan, Adiembra, Essaman and Butuah: ₵7 adult, ₵4 child.",
      "Shuttle buses run from Takoradi station to the business district.",
    ],
  },
}
