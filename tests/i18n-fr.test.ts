// Run: npm run test:i18n
import { test } from "node:test"
import assert from "node:assert/strict"
import { STRINGS, LANGUAGES } from "../lib/i18n/strings"
import { SCREENS } from "../lib/i18n/screens"

const { en, fr } = STRINGS
// Words spelled the same in French (or names): allowed to match English
const SAME_OK = new Set(["Train", "Pulse", "Bus", "Services", "Troski", "OK", "Incident", "Okada", "Trotro", "Menu", "Total", "Note", "Destination", "Stations", "Message", "Notifications", "Photo", "Transport", "Mode GO", "Code", "Points", "Bonus",
  "Accident", "Trains", "Okada, ", "Terminus", "Minutes", "Photos", "auto", "Police", "Date", "Messages", "Station", "Volume", "Vibration", "Contact", "Support", "Version"])

test("French is offered in the language picker", () => {
  assert.ok(LANGUAGES.some((l) => l.code === "fr" && l.native === "Français"))
})

test("every English key has a French translation (no silent English fallback)", () => {
  assert.deepEqual(Object.keys(en).filter((k) => !(k in fr)), [])
})

test("each screen module: same keys in en and fr, no key defined by two modules", () => {
  const seen = new Map<string, number>()
  SCREENS.forEach((m, i) => {
    assert.deepEqual(Object.keys(m.fr).sort(), Object.keys(m.en).sort(), `module ${i}`)
    for (const k of Object.keys(m.en)) {
      assert.ok(!seen.has(k), `${k} in modules ${seen.get(k)} and ${i}`)
      seen.set(k, i)
    }
  })
})

test("French differs from English unless the word is the same in both languages", () => {
  const same = Object.keys(en).filter((k) => fr[k] === en[k] && !SAME_OK.has(en[k]) && /[a-z]{3}/i.test(en[k]))
  assert.deepEqual(same, [])
})

test("French typography: no-break space before : ; ? ! (never a plain space), no stray English placeholders", () => {
  for (const [k, v] of Object.entries(fr)) {
    assert.ok(!/ [:;?!]/.test(v), `${k}: plain space before punctuation in "${v}"`)
    assert.ok(!/[^\s\u00a0\u202f(«'"{/\d][;?!]/.test(v.replace(/https?:\S+/g, "")), `${k}: missing no-break space in "${v}"`)
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join()
    assert.equal(vars(v), vars(en[k] ?? ""), `${k}: {placeholders} must match English`)
  }
})

test("no live / real-time claims in English or French", () => {
  for (const d of [en, fr]) for (const [k, v] of Object.entries(d)) {
    assert.ok(!/\blive\b|real[- ]?time|en direct|temps r[ée]el/i.test(v), `${k}: "${v}"`)
  }
})
