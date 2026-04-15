import { Platform } from 'react-native';

// Only import on iOS — no Android implementation
let sendMessage: ((msg: Record<string, unknown>) => Promise<void>) | null = null;
let updateApplicationContext: ((ctx: Record<string, unknown>) => Promise<void>) | null = null;

if (Platform.OS === 'ios') {
  const wc = require('react-native-watch-connectivity');
  sendMessage = wc.sendMessage;
  updateApplicationContext = wc.updateApplicationContext;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type QueueStatus = 'short' | 'moderate' | 'long' | 'veryLong';

export interface WatchCommutePayload {
  from: string;
  to: string;
  fare: number;
  queueStatus: QueueStatus;
  waitTime: string;
  lastUpdated: string; // ISO 8601
}

export interface WatchStation {
  name: string;
  queueStatus: QueueStatus;
  waitTime: string;
  fare: number;
}

export interface WatchAlertPayload {
  station: string;
  queueStatus: QueueStatus;
  alternative: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function deliver(message: Record<string, unknown>): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    if (sendMessage) await sendMessage(message);
  } catch {
    // Watch not reachable — queue via application context for next wake
    try {
      if (updateApplicationContext) await updateApplicationContext(message);
    } catch (err) {
      console.warn('[watchSync] Failed to deliver to Watch:', err);
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Send the user's active commute route to the Watch. */
export async function syncCommuteToWatch(payload: WatchCommutePayload): Promise<void> {
  await deliver({ commute: payload });
}

/** Send the nearby station list to the Watch (Station List screen). */
export async function syncStationsToWatch(stations: WatchStation[]): Promise<void> {
  await deliver({ stations });
}

/** Push a very-long-queue alert to the Watch (Alert screen). */
export async function sendAlertToWatch(alert: WatchAlertPayload): Promise<void> {
  await deliver({ alert });
}

/** Dismiss any active alert on the Watch. */
export async function clearWatchAlert(): Promise<void> {
  await deliver({ clearAlert: true });
}
