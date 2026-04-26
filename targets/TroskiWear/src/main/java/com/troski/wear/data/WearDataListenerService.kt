package com.troski.wear.data

import android.util.Log
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

/**
 * Background listener — receives data even when the Wear app is not in foreground.
 * Forwards to WearDataSync singleton so the UI updates when reopened.
 *
 * This is the equivalent of WCSessionDelegate's background session handler on iOS.
 */
class WearDataListenerService : WearableListenerService() {

    companion object {
        private const val TAG = "WearDataListener"
    }

    override fun onDataChanged(events: DataEventBuffer) {
        Log.d(TAG, "Background data changed: ${events.count} events")
        // Forward to the singleton — it handles parsing and state updates
        val sync = WearDataSync.getInstance(this)
        sync.onDataChanged(events)
    }

    override fun onMessageReceived(event: MessageEvent) {
        Log.d(TAG, "Background message: ${event.path}")
        val sync = WearDataSync.getInstance(this)
        sync.onMessageReceived(event)
    }
}
