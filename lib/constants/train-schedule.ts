// Official Tema–Accra Commuter Train Schedule
// Source: grcl.gov.gh / grda.gov.gh
// Service: DMU Railcar, 360 seats, Mon–Sat
// Fare: GH₵15.00 (source: TapnGo Ghana, 2024)

export interface ScheduleStop {
  station: string
  arrive: string | null
  depart: string | null
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

// Morning trip: Community 1 → Accra Central (S112)
// Evening trip: Accra Central → Community 1 (S117)

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
        { station: 'Community 1', arrive: null, depart: '06:00' },
        { station: 'Tema Station', arrive: '06:10', depart: '06:12' },
        { station: 'Asoprochona', arrive: '06:20', depart: '06:22' },
        { station: 'Batchona', arrive: '06:46', depart: '06:48' },
        { station: 'Alajo', arrive: '06:54', depart: '06:56' },
        { station: 'Achimota', arrive: '07:04', depart: '07:06' },
        { station: 'Odaw (Circle)', arrive: '07:16', depart: '07:18' },
        { station: 'Accra Central', arrive: '07:24', depart: null },
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
        { station: 'Accra Central', arrive: null, depart: '17:40' },
        { station: 'Odaw (Circle)', arrive: '17:50', depart: '17:52' },
        { station: 'Achimota', arrive: '18:02', depart: '18:06' },
        { station: 'Alajo', arrive: '18:12', depart: '18:14' },
        { station: 'Batchona', arrive: '18:22', depart: '18:24' },
        { station: 'Asoprochona', arrive: '18:42', depart: '18:54' },
        { station: 'Tema Station', arrive: '19:02', depart: '19:04' },
        { station: 'Community 1', arrive: '19:14', depart: null },
      ],
    },
  ],
}
