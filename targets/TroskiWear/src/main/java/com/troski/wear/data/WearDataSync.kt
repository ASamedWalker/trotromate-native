package com.troski.wear.data

import android.content.Context
import android.util.Log
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject

/**
 * Bidirectional data bridge between the phone (React Native) and Wear OS.
 *
 * - **DataClient**: persistent synced state — commute route, fare, stations.
 *   Equivalent to iOS `updateApplicationContext` (survives app restart).
 * - **MessageClient**: fire-and-forget — queue alerts, immediate pushes.
 *   Equivalent to iOS `sendMessage`.
 *
 * Data paths (DataClient):
 *   /commute  → CommuteData JSON
 *   /stations → Station[] JSON array
 *
 * Message paths (MessageClient):
 *   /alert       → WatchAlert JSON
 *   /clearAlert  → empty (dismiss)
 *   /reportQueue → { station: "Circle" } (Watch → Phone: open report screen)
 */
class WearDataSync private constructor(context: Context) :
    DataClient.OnDataChangedListener,
    MessageClient.OnMessageReceivedListener {

    companion object {
        private const val TAG = "WearDataSync"

        // DataClient paths (persistent)
        private const val PATH_COMMUTE = "/commute"
        private const val PATH_STATIONS = "/stations"

        // MessageClient paths (ephemeral)
        private const val PATH_ALERT = "/alert"
        private const val PATH_CLEAR_ALERT = "/clearAlert"
        const val PATH_REPORT_QUEUE = "/reportQueue"

        @Volatile
        private var instance: WearDataSync? = null

        fun getInstance(context: Context): WearDataSync {
            return instance ?: synchronized(this) {
                instance ?: WearDataSync(context.applicationContext).also { instance = it }
            }
        }
    }

    private val dataClient: DataClient = Wearable.getDataClient(context)
    private val messageClient: MessageClient = Wearable.getMessageClient(context)

    private val _commute = MutableStateFlow<CommuteData?>(null)
    val commute: StateFlow<CommuteData?> = _commute.asStateFlow()

    private val _stations = MutableStateFlow<List<Station>>(emptyList())
    val stations: StateFlow<List<Station>> = _stations.asStateFlow()

    private val _activeAlert = MutableStateFlow<WatchAlert?>(null)
    val activeAlert: StateFlow<WatchAlert?> = _activeAlert.asStateFlow()

    init {
        dataClient.addListener(this)
        messageClient.addListener(this)
        Log.d(TAG, "WearDataSync initialized — listening for phone data")

        // Load any existing DataItems on startup
        loadExistingData()
    }

    private fun loadExistingData() {
        dataClient.dataItems.addOnSuccessListener { items ->
            items.forEach { item ->
                val dataMap = DataMapItem.fromDataItem(item).dataMap
                when (item.uri.path) {
                    PATH_COMMUTE -> {
                        val json = dataMap.getString("json") ?: return@forEach
                        parseCommute(json)?.let { _commute.value = it }
                    }
                    PATH_STATIONS -> {
                        val json = dataMap.getString("json") ?: return@forEach
                        parseStations(json).let { _stations.value = it }
                    }
                }
            }
            items.release()
            Log.d(TAG, "Loaded existing data — commute: ${_commute.value != null}, stations: ${_stations.value.size}")
        }
    }

    // ─── DataClient (persistent sync) ───────────────────────────────────────

    override fun onDataChanged(events: DataEventBuffer) {
        events.forEach { event ->
            if (event.type != DataEvent.TYPE_CHANGED) return@forEach
            val item = event.dataItem
            val dataMap = DataMapItem.fromDataItem(item).dataMap

            when (item.uri.path) {
                PATH_COMMUTE -> {
                    val json = dataMap.getString("json") ?: return@forEach
                    parseCommute(json)?.let {
                        _commute.value = it
                        Log.d(TAG, "Commute updated: ${it.from} → ${it.to}, GH₵${it.fare}")
                    }
                }
                PATH_STATIONS -> {
                    val json = dataMap.getString("json") ?: return@forEach
                    val parsed = parseStations(json)
                    _stations.value = parsed
                    Log.d(TAG, "Stations updated: ${parsed.size} stations")
                }
            }
        }
    }

    // ─── MessageClient (ephemeral alerts) ───────────────────────────────────

    override fun onMessageReceived(event: MessageEvent) {
        val json = String(event.data, Charsets.UTF_8)

        when (event.path) {
            PATH_ALERT -> {
                parseAlert(json)?.let {
                    _activeAlert.value = it
                    Log.d(TAG, "Alert received: ${it.station} — ${it.queueStatus.label}")
                }
            }
            PATH_CLEAR_ALERT -> {
                _activeAlert.value = null
                Log.d(TAG, "Alert cleared")
            }
        }
    }

    // ─── Send message to phone (Watch → Phone) ─────────────────────────────

    fun sendReportQueue(stationName: String) {
        val json = JSONObject().apply {
            put("action", "reportQueue")
            put("station", stationName)
        }.toString()

        Wearable.getNodeClient(dataClient as Context).connectedNodes
            .addOnSuccessListener { nodes ->
                nodes.forEach { node ->
                    messageClient.sendMessage(node.id, PATH_REPORT_QUEUE, json.toByteArray())
                }
            }
    }

    fun dismissAlert() {
        _activeAlert.value = null
    }

    // ─── JSON Parsing ───────────────────────────────────────────────────────

    private fun parseCommute(json: String): CommuteData? {
        return try {
            val obj = JSONObject(json)
            CommuteData.fromMap(obj.toMap())
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse commute: ${e.message}")
            null
        }
    }

    private fun parseStations(json: String): List<Station> {
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).mapNotNull { i ->
                Station.fromMap(arr.getJSONObject(i).toMap())
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse stations: ${e.message}")
            emptyList()
        }
    }

    private fun parseAlert(json: String): WatchAlert? {
        return try {
            val obj = JSONObject(json)
            WatchAlert.fromMap(obj.toMap())
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse alert: ${e.message}")
            null
        }
    }
}

// ─── JSONObject extension ───────────────────────────────────────────────────

private fun JSONObject.toMap(): Map<String, Any?> {
    val map = mutableMapOf<String, Any?>()
    keys().forEach { key ->
        map[key] = when (val value = get(key)) {
            is JSONObject -> value.toMap()
            is JSONArray -> (0 until value.length()).map { value.get(it) }
            JSONObject.NULL -> null
            else -> value
        }
    }
    return map
}
