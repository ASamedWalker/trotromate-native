// Official Train Schedules — Ghana Railway
// Sources: grcl.gov.gh / grda.gov.gh / TapnGo Ghana
// DMU Railcar, 360 seats per unit

export interface ScheduleStop {
  station: string
  arrive: string | null
  depart: string | null
  lat?: number
  lng?: number
}

export interface TrainSchedule {
  id: string
  code: string
  label: string
  direction: 'inbound' | 'outbound'
  days: string
  fare: number
  stops: ScheduleStop[]
}

// ─── Tema–Accra Commuter (TMA) ─────────────────────────
// Fare: GH₵15.00 · Mon–Sat · 8 stations
// Morning: Community 1 → Accra Central (S112)
// Evening: Accra Central → Community 1 (S117)

export const TRAIN_SCHEDULES: Record<string, TrainSchedule[]> = {
  TMA: [
    {
      id: 'S112',
      code: 'S112',
      label: 'Morning — To Accra',
      direction: 'inbound',
      days: 'Mon – Sat',
      fare: 15.0,
      stops: [
        { station: 'Community 1', arrive: null, depart: '06:00', lat: 5.6525, lng: 0.0036 },
        { station: 'Tema Station', arrive: '06:10', depart: '06:12', lat: 5.6311, lng: 0.0018 },
        { station: 'Asoprochona', arrive: '06:20', depart: '06:22', lat: 5.6145, lng: -0.0550 },
        { station: 'Batchona', arrive: '06:46', depart: '06:48', lat: 5.6197, lng: -0.1197 },
        { station: 'Alajo', arrive: '06:54', depart: '06:56', lat: 5.5879, lng: -0.2182 },
        { station: 'Achimota', arrive: '07:04', depart: '07:06', lat: 5.6074, lng: -0.2237 },
        { station: 'Odaw (Circle)', arrive: '07:16', depart: '07:18', lat: 5.5655, lng: -0.2191 },
        { station: 'Accra Central', arrive: '07:24', depart: null, lat: 5.5489, lng: -0.2110 },
      ],
    },
    {
      id: 'S117',
      code: 'S117',
      label: 'Evening — To Tema',
      direction: 'outbound',
      days: 'Mon – Sat',
      fare: 15.0,
      stops: [
        { station: 'Accra Central', arrive: null, depart: '17:40', lat: 5.5489, lng: -0.2110 },
        { station: 'Odaw (Circle)', arrive: '17:50', depart: '17:52', lat: 5.5655, lng: -0.2191 },
        { station: 'Achimota', arrive: '18:02', depart: '18:06', lat: 5.6074, lng: -0.2237 },
        { station: 'Alajo', arrive: '18:12', depart: '18:14', lat: 5.5879, lng: -0.2182 },
        { station: 'Batchona', arrive: '18:22', depart: '18:24', lat: 5.6197, lng: -0.1197 },
        { station: 'Asoprochona', arrive: '18:42', depart: '18:54', lat: 5.6145, lng: -0.0550 },
        { station: 'Tema Station', arrive: '19:02', depart: '19:04', lat: 5.6311, lng: 0.0018 },
        { station: 'Community 1', arrive: '19:14', depart: null, lat: 5.6525, lng: 0.0036 },
      ],
    },
  ],

  // ─── Tema–Mpakadan (TMP) ───────────────────────────────
  // Zone fares: Tema–Afienya ₵15 · Afienya–Adomi ₵25 · Full ₵40
  // Mon–Sat · 9 stations · 97.3 km
  // Times estimated from maiden trip (Tema 09:00 → Afienya 09:39)
  // Official timetable: GRDA Facebook @GhanaRailway
  TMP: [
    {
      id: 'S315',
      code: 'S315',
      label: 'Morning — To Mpakadan',
      direction: 'outbound',
      days: 'Mon – Sat',
      fare: 40.0,
      stops: [
        { station: 'Tema Harbour', arrive: null, depart: '06:00', lat: 5.6311, lng: 0.0018 },
        { station: 'Tema Industrial Area', arrive: '06:08', depart: '06:10', lat: 5.6796, lng: 0.0026 },
        { station: 'Ashaiman', arrive: '06:20', depart: '06:22', lat: 5.6868, lng: -0.0327 },
        { station: 'Afienya', arrive: '06:40', depart: '06:46', lat: 5.7981, lng: 0.0052 },
        { station: 'Shai Hills', arrive: '07:02', depart: '07:04', lat: 5.8840, lng: 0.0386 },
        { station: 'Doryumu', arrive: '07:22', depart: '07:24', lat: 5.9007, lng: 0.0232 },
        { station: 'Kpong', arrive: '07:44', depart: '07:46', lat: 6.1759, lng: 0.0591 },
        { station: 'Juapong', arrive: '08:00', depart: '08:02', lat: 6.2545, lng: 0.1353 },
        { station: 'Mpakadan', arrive: '08:15', depart: null, lat: 6.3322, lng: 0.1090 },
      ],
    },
    {
      id: 'S316',
      code: 'S316',
      label: 'Evening — To Tema',
      direction: 'inbound',
      days: 'Mon – Sat',
      fare: 40.0,
      stops: [
        { station: 'Mpakadan', arrive: null, depart: '16:00', lat: 6.3322, lng: 0.1090 },
        { station: 'Juapong', arrive: '16:13', depart: '16:15', lat: 6.2545, lng: 0.1353 },
        { station: 'Kpong', arrive: '16:29', depart: '16:31', lat: 6.1759, lng: 0.0591 },
        { station: 'Doryumu', arrive: '16:51', depart: '16:53', lat: 5.9007, lng: 0.0232 },
        { station: 'Shai Hills', arrive: '17:11', depart: '17:13', lat: 5.8840, lng: 0.0386 },
        { station: 'Afienya', arrive: '17:29', depart: '17:35', lat: 5.7981, lng: 0.0052 },
        { station: 'Ashaiman', arrive: '17:53', depart: '17:55', lat: 5.6868, lng: -0.0327 },
        { station: 'Tema Industrial Area', arrive: '18:05', depart: '18:07', lat: 5.6796, lng: 0.0026 },
        { station: 'Tema Harbour', arrive: '18:15', depart: null, lat: 5.6311, lng: 0.0018 },
      ],
    },
  ],

  // ─── Sekondi–Takoradi Commuter (STK) ──────────────────────
  // Commuter shuttle via Kojokrom · Mon–Fri
  // Stations: Sekondi → Kojokrom → Ketan → Essaman → Bakado → Butuah → New Takoradi → Takoradi
  // Schedule estimated from GRCL announcements + historical data
  // Note: Service reliability is inconsistent — infrastructure under renovation
  STK: [
    {
      id: 'W101',
      code: 'W101',
      label: 'Morning — To Takoradi',
      direction: 'inbound',
      days: 'Mon – Fri',
      fare: 10.0,
      stops: [
        { station: 'Sekondi', arrive: null, depart: '06:30', lat: 4.9377, lng: -1.7102 },
        { station: 'Kojokrom', arrive: '06:40', depart: '06:42', lat: 4.9636, lng: -1.7245 },
        { station: 'Ketan', arrive: '06:48', depart: '06:49', lat: 4.9511, lng: -1.7289 },
        { station: 'Essaman', arrive: '06:53', depart: '06:54', lat: 4.9237, lng: -1.7369 },
        { station: 'Bakado', arrive: '06:58', depart: '06:59', lat: 4.9379, lng: -1.7295 },
        { station: 'New Takoradi', arrive: '07:05', depart: '07:06', lat: 4.9046, lng: -1.7479 },
        { station: 'Takoradi', arrive: '07:12', depart: null, lat: 4.8824, lng: -1.7496 },
      ],
    },
    {
      id: 'W102',
      code: 'W102',
      label: 'Evening — To Sekondi',
      direction: 'outbound',
      days: 'Mon – Fri',
      fare: 10.0,
      stops: [
        { station: 'Takoradi', arrive: null, depart: '17:15', lat: 4.8824, lng: -1.7496 },
        { station: 'New Takoradi', arrive: '17:21', depart: '17:22', lat: 4.9046, lng: -1.7479 },
        { station: 'Bakado', arrive: '17:28', depart: '17:29', lat: 4.9379, lng: -1.7295 },
        { station: 'Essaman', arrive: '17:33', depart: '17:34', lat: 4.9237, lng: -1.7369 },
        { station: 'Ketan', arrive: '17:38', depart: '17:39', lat: 4.9511, lng: -1.7289 },
        { station: 'Kojokrom', arrive: '17:45', depart: '17:47', lat: 4.9636, lng: -1.7245 },
        { station: 'Sekondi', arrive: '17:57', depart: null, lat: 4.9377, lng: -1.7102 },
      ],
    },
  ],
}
