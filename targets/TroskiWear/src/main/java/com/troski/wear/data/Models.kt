package com.troski.wear.data

import java.time.Instant
import java.time.Duration

// ─── Queue Status ───────────────────────────────────────────────────────────

enum class QueueStatus(val label: String, val emoji: String) {
    SHORT("Short Queue", "🟢"),
    MODERATE("Moderate", "🟡"),
    LONG("Long Queue", "🔴"),
    VERY_LONG("Very Long Queue", "🔴");

    companion object {
        fun fromString(value: String): QueueStatus = when (value) {
            "short" -> SHORT
            "moderate" -> MODERATE
            "long" -> LONG
            "veryLong" -> VERY_LONG
            else -> SHORT
        }
    }

    fun toWireValue(): String = when (this) {
        SHORT -> "short"
        MODERATE -> "moderate"
        LONG -> "long"
        VERY_LONG -> "veryLong"
    }
}

// ─── Commute Data ───────────────────────────────────────────────────────────

data class CommuteData(
    val from: String,
    val to: String,
    val fare: Double,
    val queueStatus: QueueStatus,
    val waitTime: String,
    val lastUpdated: Instant = Instant.now(),
) {
    val relativeTime: String
        get() {
            val diff = Duration.between(lastUpdated, Instant.now()).toMinutes()
            return when {
                diff < 1L -> "just now"
                diff == 1L -> "1 min ago"
                else -> "$diff min ago"
            }
        }

    companion object {
        fun fromMap(map: Map<String, Any?>): CommuteData? {
            val from = map["from"] as? String ?: return null
            val to = map["to"] as? String ?: return null
            val fare = (map["fare"] as? Number)?.toDouble() ?: return null
            val queueStatusRaw = map["queueStatus"] as? String ?: return null
            val waitTime = map["waitTime"] as? String ?: return null
            val lastUpdatedStr = map["lastUpdated"] as? String

            val lastUpdated = try {
                if (lastUpdatedStr != null) Instant.parse(lastUpdatedStr) else Instant.now()
            } catch (_: Exception) {
                Instant.now()
            }

            return CommuteData(
                from = from,
                to = to,
                fare = fare,
                queueStatus = QueueStatus.fromString(queueStatusRaw),
                waitTime = waitTime,
                lastUpdated = lastUpdated,
            )
        }
    }
}

// ─── Station ────────────────────────────────────────────────────────────────

data class Station(
    val name: String,
    val queueStatus: QueueStatus,
    val waitTime: String,
    val fare: Double,
    val isDistant: Boolean = false,
) {
    companion object {
        fun fromMap(map: Map<String, Any?>): Station? {
            val name = map["name"] as? String ?: return null
            val queueStatusRaw = map["queueStatus"] as? String ?: return null
            val waitTime = map["waitTime"] as? String ?: return null
            val fare = (map["fare"] as? Number)?.toDouble() ?: return null
            val isDistant = map["isDistant"] as? Boolean ?: false

            return Station(
                name = name,
                queueStatus = QueueStatus.fromString(queueStatusRaw),
                waitTime = waitTime,
                fare = fare,
                isDistant = isDistant,
            )
        }
    }
}

// ─── Alert ──────────────────────────────────────────────────────────────────

data class WatchAlert(
    val station: String,
    val queueStatus: QueueStatus,
    val alternative: String,
) {
    companion object {
        fun fromMap(map: Map<String, Any?>): WatchAlert? {
            val station = map["station"] as? String ?: return null
            val queueStatusRaw = map["queueStatus"] as? String ?: return null
            val alternative = map["alternative"] as? String ?: return null

            return WatchAlert(
                station = station,
                queueStatus = QueueStatus.fromString(queueStatusRaw),
                alternative = alternative,
            )
        }
    }
}
