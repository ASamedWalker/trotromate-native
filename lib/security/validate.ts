/**
 * Input validation and sanitization for TrotroMate Native
 * All user input must pass through these checks before hitting Supabase
 */

// ── Device ID ──────────────────────────────────────────────────────

const DEVICE_ID_REGEX = /^[0-9a-f]{32}$/

export function isValidDeviceId(id: string | null | undefined): id is string {
  return typeof id === 'string' && DEVICE_ID_REGEX.test(id)
}

// ── Text Sanitization ──────────────────────────────────────────────

/** Strip script tags, event handlers, javascript: URIs */
export function sanitizeText(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<\/?(?:script|iframe|object|embed|form|input|button)\b[^>]*>/gi, '')
    .trim()
}

/** Sanitize and enforce max length */
export function sanitizeString(input: string, maxLength: number): string {
  return sanitizeText(input).slice(0, maxLength)
}

// ── Location Validation ────────────────────────────────────────────

const MAX_LOCATION_LENGTH = 200

export function validateLocation(location: string): string | null {
  const cleaned = sanitizeString(location.trim(), MAX_LOCATION_LENGTH)
  if (cleaned.length === 0) return null
  return cleaned
}

// ── Ghana Location Validation ─────────────────────────────────────

/** Common non-Ghana location names that indicate junk/test data */
const BLOCKED_LOCATION_PATTERNS = [
  /\b(america|usa|united states|china|india|uk|england|france|germany|japan|korea|nigeria|south africa|kenya|brazil|canada|australia|europe|asia|africa)\b/i,
  /\b(new york|london|paris|beijing|tokyo|lagos|nairobi|dubai|moscow|berlin|sydney)\b/i,
  /\b(test|testing|asdf|qwerty|xxx|abc|123|hello|foo|bar)\b/i,
]

/**
 * Validates that a location name looks like a real Ghana location.
 * Returns null if the location is obviously fake/non-Ghana.
 */
export function validateGhanaLocation(location: string): string | null {
  const cleaned = validateLocation(location)
  if (!cleaned) return null

  // Must be at least 2 characters (no single-letter locations)
  if (cleaned.length < 2) return null

  // Check against blocked patterns
  for (const pattern of BLOCKED_LOCATION_PATTERNS) {
    if (pattern.test(cleaned)) return null
  }

  return cleaned
}

// ── Fare Validation ────────────────────────────────────────────────

const MIN_FARE = 0.01
const MAX_FARE = 200 // No trotro/okada fare in Ghana exceeds GH₵ 200

export function validateFare(fare: unknown): number | null {
  const num = typeof fare === 'number' ? fare : parseFloat(String(fare))
  if (isNaN(num) || num < MIN_FARE || num > MAX_FARE) return null
  return Math.round(num * 100) / 100 // 2 decimal places
}

// ── Integer Range Validation ───────────────────────────────────────

export function validateIntRange(
  value: unknown,
  min: number,
  max: number
): number | null {
  const num = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (isNaN(num) || num < min || num > max) return null
  return Math.floor(num)
}

// ── Enum Validation ────────────────────────────────────────────────

export function validateEnum<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | null {
  if (typeof value !== 'string') return null
  return allowed.includes(value as T) ? (value as T) : null
}

// ── Phone Validation (Ghana) ───────────────────────────────────────

const GHANA_PHONE_REGEX = /^(?:\+233|233|0)\d{9}$/

export function isValidGhanaPhone(phone: string): boolean {
  return GHANA_PHONE_REGEX.test(phone.replace(/[\s-]/g, ''))
}

// ── Display Name Validation ────────────────────────────────────────

const MAX_DISPLAY_NAME = 100

export function validateDisplayName(name: string | null | undefined): string | null {
  if (!name) return null
  const cleaned = sanitizeString(name.trim(), MAX_DISPLAY_NAME)
  if (cleaned.length === 0) return null
  return cleaned
}

// ── Comment / Caption Validation ───────────────────────────────────

const MAX_COMMENT_LENGTH = 500
const MAX_CAPTION_LENGTH = 500

export function validateComment(content: string): string | null {
  const cleaned = sanitizeString(content.trim(), MAX_COMMENT_LENGTH)
  if (cleaned.length === 0) return null
  return cleaned
}

export function validateCaption(caption: string): string | null {
  const cleaned = sanitizeString(caption.trim(), MAX_CAPTION_LENGTH)
  if (cleaned.length === 0) return null
  return cleaned
}

// ── Notes Validation ───────────────────────────────────────────────

const MAX_NOTES_LENGTH = 500

export function validateNotes(notes: string | undefined): string | null {
  if (!notes) return null
  return sanitizeString(notes.trim(), MAX_NOTES_LENGTH) || null
}

// ── Vehicle Number Validation ──────────────────────────────────────

const MAX_VEHICLE_NUMBER = 20

export function validateVehicleNumber(num: string | undefined): string | null {
  if (!num) return null
  const cleaned = sanitizeString(num.trim(), MAX_VEHICLE_NUMBER)
  if (cleaned.length === 0) return null
  return cleaned
}

// ── Known Enums ────────────────────────────────────────────────────

export const QUEUE_STATUSES = ['empty', 'short', 'moderate', 'long', 'very_long'] as const
export type QueueStatus = (typeof QUEUE_STATUSES)[number]

export const INCIDENT_TYPES = [
  'traffic', 'accident', 'police_checkpoint', 'road_closure',
  'flooding', 'demonstration', 'breakdown', 'other',
] as const
export type IncidentType = (typeof INCIDENT_TYPES)[number]

export const TRANSPORT_TYPES = ['trotro', 'okada'] as const
export type TransportTypeEnum = (typeof TRANSPORT_TYPES)[number]

export const SAFETY_RATINGS = ['positive', 'negative'] as const
export type SafetyRating = (typeof SAFETY_RATINGS)[number]

export const TRIP_STATUSES = ['active', 'arrived', 'cancelled'] as const
export type TripStatus = (typeof TRIP_STATUSES)[number]

export const DRIVER_ROLES = ['driver', 'mate'] as const
export type DriverRole = (typeof DRIVER_ROLES)[number]

export const TRAIN_REPORT_TYPES = ['schedule', 'crowd', 'delay'] as const
export type TrainReportType = (typeof TRAIN_REPORT_TYPES)[number]

export const TRAIN_DIRECTIONS = ['inbound', 'outbound'] as const
export type TrainDirection = (typeof TRAIN_DIRECTIONS)[number]

export const CROWD_LEVELS = ['empty', 'few_seats', 'standing', 'packed'] as const
export type CrowdLevel = (typeof CROWD_LEVELS)[number]

export const TALE_POST_TYPES = ['tale', 'queue_update', 'fare_receipt', 'station_photo'] as const
export type TalePostType = (typeof TALE_POST_TYPES)[number]

export const SAFETY_CATEGORIES = [
  'driving', 'vehicle_condition', 'overcrowding', 'route_safety', 'general',
] as const
export type SafetyCategory = (typeof SAFETY_CATEGORIES)[number]
