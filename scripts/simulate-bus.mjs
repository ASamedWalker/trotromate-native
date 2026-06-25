// Dev simulator — broadcasts a MOVING bus position on the real driver channel
// (gps:van:{vanId}, event 'location'), exactly like the Troski Pro driver app.
// Ephemeral Realtime broadcast only — NO database writes. For verifying the
// passenger live-tracking experience without a physical bus on shift.
//
//   node scripts/simulate-bus.mjs            # default: Circle → Taifa
//
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import WebSocket from 'ws'
globalThis.WebSocket = globalThis.WebSocket || WebSocket // Node < 21 has no global WS

const env = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
const get = (k) => (env.match(new RegExp(`${k}=(.*)`)) || [])[1]?.trim().replace(/^["']|["']$/g, '')
const supabase = createClient(get('EXPO_PUBLIC_SUPABASE_URL'), get('EXPO_PUBLIC_SUPABASE_ANON_KEY'))

const VAN_ID = 'SIM-VAN-01'
const PLATE = 'GT-1199-25'
const ROUTE_LABEL = 'Circle → Taifa'
// Path: Circle → Achimota → Dome → Taifa (lng, lat)
const PATH = [
  [-0.2133, 5.5696], [-0.2230, 5.6150], [-0.2280, 5.6520], [-0.2330, 5.6800],
]

// Linear interpolate the path into ~40 steps for smooth movement.
const steps = []
for (let i = 0; i < PATH.length - 1; i++) {
  const [aLng, aLat] = PATH[i], [bLng, bLat] = PATH[i + 1]
  for (let t = 0; t < 14; t++) {
    const f = t / 14
    steps.push([aLng + (bLng - aLng) * f, aLat + (bLat - aLat) * f])
  }
}

const channel = supabase.channel(`gps:van:${VAN_ID}`)
let i = 0

channel.subscribe((status) => {
  if (status !== 'SUBSCRIBED') return
  console.log(`▶ broadcasting ${PLATE} on gps:van:${VAN_ID} (${steps.length} steps, every 3s)`)
  const send = () => {
    const [lng, lat] = steps[i % steps.length]
    const next = steps[(i + 1) % steps.length]
    const heading = (Math.atan2(next[0] - lng, next[1] - lat) * 180) / Math.PI
    channel.send({
      type: 'broadcast', event: 'location',
      payload: {
        van_id: VAN_ID, shift_id: 'SIM-SHIFT', lat, lng,
        heading, speed: 6.5, accuracy: 8, timestamp: Date.now(),
        plate_number: PLATE, route_label: ROUTE_LABEL,
      },
    })
    process.stdout.write(`\r  step ${i + 1}/${steps.length}  ${lat.toFixed(4)},${lng.toFixed(4)}   `)
    i++
  }
  send()
  setInterval(send, 3000)
})
