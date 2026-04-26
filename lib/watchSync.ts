import { Platform } from 'react-native';

// ─── iOS: WatchConnectivity ───���─────────────────────────────────────────────
let sendMessage: ((msg: Record<string, unknown>) => Promise<void>) | null = null;
let updateApplicationContext: ((ctx: Record<string, unknown>) => Promise<void>) | null = null;

if (Platform.OS === 'ios') {
  const wc = require('react-native-watch-connectivity');
  sendMessage = wc.sendMessage;
  updateApplicationContext = wc.updateApplicationContext;
}

// ─── Android: Wear Connectivity ─────────────────────────────────────────────
let wearSendMessage: ((path: string, data: object) => void) | null = null;
let wearSendData: ((path: string, data: object) => void) | null = null;

if (Platform.OS === 'android') {
  try {
    const wc = require('react-native-wear-connectivity');
    wearSendMessage = (path: string, data: object) => {
      wc.sendMessage(JSON.stringify({ path, ...data }));
    };
    // DataClient for persistent sync (survives app restart)
    if (wc.sendData) {
      wearSendData = (path: string, data: object) => {
        wc.sendData(path, { json: JSON.stringify(data) });
      };
    }
  } catch {
    // react-native-wear-connectivity not installed yet — no-op
  }
}

// ─── Types ────��───────────────────────────────────────────────────────────────

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

// ─── Delivery Helpers ──────────────��─────────────────────────────────────────

/**
 * iOS: send via WatchConnectivity (message → fallback to applicationContext).
 */
async function deliverIOS(message: Record<string, unknown>): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    if (sendMessage) await sendMessage(message);
  } catch {
    // Watch not reachable — queue via application context for next wake
    try {
      if (updateApplicationContext) await updateApplicationContext(message);
    } catch (err) {
      console.warn('[watchSync] iOS: Failed to deliver to Watch:', err);
    }
  }
}

/**
 * Android: send via Wear DataClient (persistent) or MessageClient (ephemeral).
 * - DataClient for commute/station data (persistent, like iOS applicationContext)
 * - MessageClient for alerts (ephemeral, like iOS sendMessage)
 */
function deliverAndroidData(path: string, data: object): void {
  if (Platform.OS !== 'android') return;
  try {
    if (wearSendData) {
      wearSendData(path, data);
    } else if (wearSendMessage) {
      wearSendMessage(path, data);
    }
  } catch (err) {
    console.warn('[watchSync] Android: Failed to deliver data:', err);
  }
}

function deliverAndroidMessage(path: string, data: object): void {
  if (Platform.OS !== 'android') return;
  try {
    if (wearSendMessage) {
      wearSendMessage(path, data);
    }
  } catch (err) {
    console.warn('[watchSync] Android: Failed to deliver message:', err);
  }
}

// ─── Public API ────���─────────────────────────────────────────────────────────

/** Send the user's active commute route to the Watch. */
export async function syncCommuteToWatch(payload: WatchCommutePayload): Promise<void> {
  if (Platform.OS === 'ios') {
    await deliverIOS({ commute: payload });
  } else if (Platform.OS === 'android') {
    deliverAndroidData('/commute', payload);
  }
}

/** Send the nearby station list to the Watch (Station List screen). */
export async function syncStationsToWatch(stations: WatchStation[]): Promise<void> {
  if (Platform.OS === 'ios') {
    await deliverIOS({ stations });
  } else if (Platform.OS === 'android') {
    deliverAndroidData('/stations', { stations });
  }
}

/** Push a very-long-queue alert to the Watch (Alert screen). */
export async function sendAlertToWatch(alert: WatchAlertPayload): Promise<void> {
  if (Platform.OS === 'ios') {
    await deliverIOS({ alert });
  } else if (Platform.OS === 'android') {
    deliverAndroidMessage('/alert', alert);
  }
}

/** Dismiss any active alert on the Watch. */
export async function clearWatchAlert(): Promise<void> {
  if (Platform.OS === 'ios') {
    await deliverIOS({ clearAlert: true });
  } else if (Platform.OS === 'android') {
    deliverAndroidMessage('/clearAlert', {});
  }
}
