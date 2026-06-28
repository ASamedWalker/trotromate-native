// EV charging stations for Ghana/Accra via OpenChargeMap — the global open
// registry of EV charge points (https://openchargemap.org). Ghana's EV data is
// nascent and lives almost entirely in OCM, so this is the canonical source.
//
// Needs a FREE OpenChargeMap API key in EXPO_PUBLIC_OCM_KEY
// (register at https://openchargemap.org/site/profile/applications — 2 min).
// Without a key the screen shows an honest onboarding state.

import { supabase } from '@/lib/supabase/client'

const OCM_KEY = process.env.EXPO_PUBLIC_OCM_KEY ?? ''
const OCM_BASE = 'https://api.openchargemap.io/v3/poi/'

export interface EvConnector {
  type: string // e.g. "Type 2 (Socket Only)", "CCS (Type 2)"
  powerKW: number | null
  status: string | null
  quantity: number | null
}

export type EvKind = 'charge' | 'swap'

export interface EvStation {
  id: string
  name: string
  lat: number
  lng: number
  kind: EvKind
  address: string | null
  town: string | null
  operator: string | null
  access: string | null // UsageType (public/private/membership)
  isOperational: boolean | null
  isPayAtLocation: boolean | null
  connectors: EvConnector[]
  maxPowerKW: number | null
  pricing?: string | null
  hasBackup?: boolean | null
  // Community reliability (PlugShare-style)
  worksCount?: number
  downCount?: number
  lastConfirmedAt?: string | null
  source: 'ocm' | 'community'
}

export type EvFetchResult =
  | { ok: true; stations: EvStation[]; sample?: boolean }
  | { ok: false; reason: 'no_key' | 'network' | 'empty' }

// Dev-only SAMPLE spots so the map/markers UX is visible before an OpenChargeMap
// key is wired. Real Accra venues, but clearly flagged sample={true} (the screen
// shows a "Sample data" banner). NEVER returned in production builds.
const SAMPLE_STATIONS: EvStation[] = [
  { id: 'sample-1', name: 'Sample · Accra Mall', lat: 5.6175, lng: -0.1717, kind: 'charge', address: 'Tetteh Quarshie', town: 'Accra', operator: 'GreenDrive (sample)', access: 'Public', isOperational: true, isPayAtLocation: true, connectors: [{ type: 'Type 2 (AC)', powerKW: 22, status: 'Operational', quantity: 2 }], maxPowerKW: 22, source: 'ocm' },
  { id: 'sample-2', name: 'Sample · Marina Mall', lat: 5.6045, lng: -0.1719, kind: 'charge', address: 'Airport City', town: 'Accra', operator: 'GreenDrive (sample)', access: 'Public', isOperational: true, isPayAtLocation: true, connectors: [{ type: 'CCS (DC fast)', powerKW: 60, status: 'Operational', quantity: 1 }], maxPowerKW: 60, source: 'ocm' },
  { id: 'sample-3', name: 'Sample · Achimota Retail Centre', lat: 5.6190, lng: -0.2230, kind: 'charge', address: 'Achimota', town: 'Accra', operator: 'Sample operator', access: 'Public', isOperational: true, isPayAtLocation: true, connectors: [{ type: 'Type 2 (AC)', powerKW: 11, status: 'Operational', quantity: 2 }], maxPowerKW: 11, source: 'ocm' },
  { id: 'sample-4', name: 'Sample · West Hills Mall', lat: 5.5560, lng: -0.3060, kind: 'charge', address: 'Weija', town: 'Accra', operator: 'Sample operator', access: 'Public', isOperational: false, isPayAtLocation: true, connectors: [{ type: 'Type 2 (AC)', powerKW: 22, status: 'Unknown', quantity: 1 }], maxPowerKW: 22, source: 'ocm' },
  { id: 'sample-5', name: 'Sample · Stanbic Heights', lat: 5.6055, lng: -0.1740, kind: 'charge', address: 'Airport City', town: 'Accra', operator: 'Sample operator', access: 'Public', isOperational: true, isPayAtLocation: true, connectors: [{ type: 'CCS (DC fast)', powerKW: 50, status: 'Operational', quantity: 1 }], maxPowerKW: 50, source: 'ocm' },
]

function normalize(poi: any): EvStation | null {
  const ai = poi?.AddressInfo
  if (!ai || ai.Latitude == null || ai.Longitude == null) return null
  const connections: EvConnector[] = (poi.Connections ?? []).map((c: any) => ({
    type: c?.ConnectionType?.Title ?? 'Unknown',
    powerKW: c?.PowerKW ?? null,
    status: c?.StatusType?.Title ?? null,
    quantity: c?.Quantity ?? null,
  }))
  const powers = connections.map((c) => c.powerKW).filter((p): p is number => p != null)
  return {
    id: String(poi.ID ?? `${ai.Latitude},${ai.Longitude}`),
    name: ai.Title ?? 'Charging station',
    lat: ai.Latitude,
    lng: ai.Longitude,
    kind: 'charge' as const,
    address: [ai.AddressLine1, ai.AddressLine2].filter(Boolean).join(', ') || null,
    town: ai.Town ?? null,
    operator: poi.OperatorInfo?.Title ?? null,
    access: poi.UsageType?.Title ?? null,
    isOperational: poi.StatusType?.IsOperational ?? null,
    isPayAtLocation: poi.UsageType?.IsPayAtLocation ?? null,
    connectors: connections,
    maxPowerKW: powers.length ? Math.max(...powers) : null,
    source: 'ocm',
  }
}

/**
 * Fetch EV charging stations. If lat/lng given, fetches nearest within `distanceKm`;
 * otherwise all of Ghana. Returns an honest result (no fabricated data).
 */
export async function fetchEvStations(opts?: {
  lat?: number
  lng?: number
  distanceKm?: number
  max?: number
}): Promise<EvFetchResult> {
  // No key: show labelled sample spots in dev so the UX is testable; stay honest
  // (empty onboarding) in production.
  if (!OCM_KEY) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) return { ok: true, stations: SAMPLE_STATIONS, sample: true }
    return { ok: false, reason: 'no_key' }
  }
  const params = new URLSearchParams({
    output: 'json',
    countrycode: 'GH',
    maxresults: String(opts?.max ?? 500),
    compact: 'true',
    verbose: 'false',
    key: OCM_KEY,
  })
  if (opts?.lat != null && opts?.lng != null) {
    params.set('latitude', String(opts.lat))
    params.set('longitude', String(opts.lng))
    params.set('distance', String(opts.distanceKm ?? 50))
    params.set('distanceunit', 'KM')
  }
  try {
    const res = await fetch(`${OCM_BASE}?${params.toString()}`, {
      headers: { 'User-Agent': 'TroskiApp/1.0' },
    })
    if (!res.ok) return { ok: false, reason: 'network' }
    const json = await res.json()
    const stations = (Array.isArray(json) ? json : []).map(normalize).filter((s): s is EvStation => !!s)
    if (!stations.length) return { ok: false, reason: 'empty' }
    return { ok: true, stations }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

export const hasEvKey = () => !!OCM_KEY

// ─── Community stations (crowdsourced — the moat) ──────────────────────────────

/** Read community-submitted stations (charge + swap), newest first. */
export async function fetchCommunityStations(): Promise<EvStation[]> {
  try {
    const { data } = await supabase
      .from('ev_stations')
      .select('id,name,kind,latitude,longitude,operator,connector,power_kw,access,pricing,has_backup,works_count,down_count,last_confirmed_at,status')
      .neq('status', 'rejected')
      .order('created_at', { ascending: false })
      .limit(500)
    return (data ?? []).map((r: any): EvStation => ({
      id: String(r.id),
      name: r.name ?? (r.kind === 'swap' ? 'Swap station' : 'Charging station'),
      lat: r.latitude,
      lng: r.longitude,
      kind: r.kind === 'swap' ? 'swap' : 'charge',
      address: null,
      town: null,
      operator: r.operator ?? null,
      access: r.access ?? null,
      isOperational: r.down_count > r.works_count ? false : true,
      isPayAtLocation: null,
      connectors: r.connector ? [{ type: r.connector, powerKW: r.power_kw ?? null, status: null, quantity: null }] : [],
      maxPowerKW: r.power_kw ?? null,
      pricing: r.pricing ?? null,
      hasBackup: r.has_backup ?? null,
      worksCount: r.works_count ?? 0,
      downCount: r.down_count ?? 0,
      lastConfirmedAt: r.last_confirmed_at ?? null,
      source: 'community',
    }))
  } catch {
    return []
  }
}

export interface NewEvStation {
  name: string
  kind: EvKind
  lat: number
  lng: number
  operator?: string | null
  connector?: string | null
  powerKW?: number | null
  access?: string | null
  pricing?: string | null
  hasBackup?: boolean | null
  notes?: string | null
  deviceId?: string | null
  authUserId?: string | null
}

/** Submit a community station. Returns the new id, or null on failure. */
export async function submitEvStation(s: NewEvStation): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('submit_ev_station', {
      p_name: s.name,
      p_kind: s.kind,
      p_lat: s.lat,
      p_lng: s.lng,
      p_operator: s.operator ?? null,
      p_connector: s.connector ?? null,
      p_power: s.powerKW ?? null,
      p_access: s.access ?? null,
      p_pricing: s.pricing ?? null,
      p_has_backup: s.hasBackup ?? null,
      p_notes: s.notes ?? null,
      p_device_id: s.deviceId ?? null,
      p_auth_user_id: s.authUserId ?? null,
    })
    if (error) return null
    return data ? String(data) : null
  } catch {
    return null
  }
}

/** PlugShare-style reliability confirm: works / not working. Best-effort. */
export async function confirmEvStation(id: string, working: boolean, deviceId?: string | null): Promise<void> {
  try {
    await supabase.rpc('confirm_ev_station', { p_id: id, p_working: working, p_device_id: deviceId ?? null })
  } catch {
    /* never block the user */
  }
}
