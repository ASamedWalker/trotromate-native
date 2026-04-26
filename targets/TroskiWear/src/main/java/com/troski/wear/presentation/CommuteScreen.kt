package com.troski.wear.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.troski.wear.data.CommuteData
import com.troski.wear.data.QueueStatus
import com.troski.wear.theme.*
import java.util.Calendar

/**
 * Screen 1: Commute Summary — route, fare, queue status, smart leave-by, freshness.
 * Dark background with kinetic amber/red glow blobs (matching Apple Watch CommuteSummaryView).
 */
@Composable
fun CommuteScreen(commute: CommuteData) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(TroskiBackground)
    ) {
        // ─── Kinetic Glow Blobs ─────────────────────────────────────────────
        Box(
            modifier = Modifier
                .size(130.dp)
                .offset(x = (-20).dp, y = (-30).dp)
                .blur(44.dp)
                .background(TroskiAmber.copy(alpha = 0.22f), CircleShape)
        )
        Box(
            modifier = Modifier
                .size(130.dp)
                .align(Alignment.BottomEnd)
                .offset(x = 20.dp, y = 30.dp)
                .blur(44.dp)
                .background(TroskiRed.copy(alpha = 0.18f), CircleShape)
        )

        // ─── Content ────────────────────────────────────────────────────────
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            verticalArrangement = Arrangement.Top,
        ) {
            // Brand
            Text(
                text = "TROSKI",
                style = MaterialTheme.typography.display1,
                color = TroskiAmber,
            )
            Spacer(modifier = Modifier.height(6.dp))

            // Greeting
            Text(
                text = greetingLabel(),
                style = MaterialTheme.typography.body2,
                color = TroskiMuted,
            )
            Spacer(modifier = Modifier.height(2.dp))

            // Route
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = commute.from,
                    style = MaterialTheme.typography.title1,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                Text(
                    text = " → ",
                    style = MaterialTheme.typography.caption1,
                    color = TroskiMuted,
                )
                Text(
                    text = commute.to,
                    style = MaterialTheme.typography.title1,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
            }
            Spacer(modifier = Modifier.height(6.dp))

            // Fare
            Text(
                text = "GH₵${"%.2f".format(commute.fare)}",
                style = MaterialTheme.typography.display2,
                color = TroskiAmber,
            )
            Spacer(modifier = Modifier.height(6.dp))

            // Queue status dot + label + wait time
            Row(verticalAlignment = Alignment.CenterVertically) {
                // Status dot with halo
                Box(contentAlignment = Alignment.Center) {
                    Box(
                        modifier = Modifier
                            .size(18.dp)
                            .background(
                                commute.queueStatus.color().copy(alpha = 0.2f),
                                CircleShape,
                            )
                    )
                    Box(
                        modifier = Modifier
                            .size(7.dp)
                            .background(commute.queueStatus.color(), CircleShape)
                    )
                }
                Spacer(modifier = Modifier.width(5.dp))
                Text(
                    text = commute.queueStatus.label,
                    style = MaterialTheme.typography.body1,
                    color = Color.White,
                )
                if (commute.waitTime.isNotEmpty()) {
                    Text(
                        text = " · ${commute.waitTime}",
                        style = MaterialTheme.typography.body1,
                        color = TroskiMuted,
                    )
                }
            }
            Spacer(modifier = Modifier.height(6.dp))

            // Smart leave-by suggestion
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(TroskiMint.copy(alpha = 0.08f))
                    .padding(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(text = "🕐", style = MaterialTheme.typography.title1)
                Spacer(modifier = Modifier.width(6.dp))
                Column {
                    Text(
                        text = "Leave by ${suggestedLeaveTime(commute)}",
                        style = MaterialTheme.typography.body1,
                        color = Color.White,
                    )
                    Text(
                        text = leaveReason(commute.queueStatus),
                        style = MaterialTheme.typography.caption1,
                        color = TroskiMuted,
                    )
                }
            }
            Spacer(modifier = Modifier.height(4.dp))

            // Freshness
            Text(
                text = "Updated ${commute.relativeTime}",
                style = MaterialTheme.typography.caption1,
                color = TroskiMuted,
            )
        }
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

private fun greetingLabel(): String {
    val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    return when {
        hour < 12 -> "Your morning commute"
        hour < 17 -> "Your afternoon commute"
        else -> "Your evening commute"
    }
}

private fun suggestedLeaveTime(commute: CommuteData): String {
    val calendar = Calendar.getInstance()
    val hour = calendar.get(Calendar.HOUR_OF_DAY)

    // Parse wait minutes
    val waitMinutes = commute.waitTime.filter { it.isDigit() }.toIntOrNull() ?: 15

    // Buffer based on queue status
    val buffer = when (commute.queueStatus) {
        QueueStatus.SHORT -> 5
        QueueStatus.MODERATE -> 10
        QueueStatus.LONG -> 15
        QueueStatus.VERY_LONG -> 25
    }

    // Target arrival: 8 AM morning, 6 PM evening
    val targetHour = if (hour < 12) 8 else 18
    val targetCal = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, targetHour)
        set(Calendar.MINUTE, 0)
    }

    // Subtract total time from target
    targetCal.add(Calendar.MINUTE, -(waitMinutes + buffer))

    // Round to nearest 5
    val minute = targetCal.get(Calendar.MINUTE)
    targetCal.set(Calendar.MINUTE, (minute / 5) * 5)

    val h = targetCal.get(Calendar.HOUR_OF_DAY)
    val m = targetCal.get(Calendar.MINUTE)
    val ampm = if (h < 12) "AM" else "PM"
    val displayHour = if (h % 12 == 0) 12 else h % 12
    return "%d:%02d %s".format(displayHour, m, ampm)
}

private fun leaveReason(status: QueueStatus): String = when (status) {
    QueueStatus.SHORT -> "Queue is short — smooth ride"
    QueueStatus.MODERATE -> "Moderate queue — leave a bit early"
    QueueStatus.LONG -> "Long queue — allow extra time"
    QueueStatus.VERY_LONG -> "Very long queue — leave ASAP"
}

fun QueueStatus.color(): Color = when (this) {
    QueueStatus.SHORT -> QueueShort
    QueueStatus.MODERATE -> QueueModerate
    QueueStatus.LONG -> QueueLong
    QueueStatus.VERY_LONG -> QueueVeryLong
}
