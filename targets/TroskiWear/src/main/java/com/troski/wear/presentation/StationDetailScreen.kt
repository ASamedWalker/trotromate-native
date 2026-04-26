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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.troski.wear.data.Station
import com.troski.wear.theme.*

/**
 * Screen 3: Station Detail — large queue status, wait time, fare, Report Queue button.
 * Matches Apple Watch StationDetailView.
 */
@Composable
fun StationDetailScreen(
    station: Station,
    onReportQueue: (stationName: String) -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(TroskiBackground)
    ) {
        // Subtle glow matching queue color
        Box(
            modifier = Modifier
                .size(140.dp)
                .align(Alignment.TopCenter)
                .offset(y = (-20).dp)
                .blur(50.dp)
                .background(station.queueStatus.color().copy(alpha = 0.2f), CircleShape)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(modifier = Modifier.height(4.dp))

            // Station name
            Text(
                text = station.name,
                style = MaterialTheme.typography.display2,
                color = Color.White,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(8.dp))

            // Large queue status badge
            Box(contentAlignment = Alignment.Center) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .background(
                            station.queueStatus.color().copy(alpha = 0.15f),
                            CircleShape,
                        )
                )
                Box(
                    modifier = Modifier
                        .size(16.dp)
                        .background(station.queueStatus.color(), CircleShape)
                )
            }
            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = station.queueStatus.label,
                style = MaterialTheme.typography.title2,
                color = station.queueStatus.color(),
            )
            Spacer(modifier = Modifier.height(10.dp))

            // Info rows
            InfoRow(icon = "🕐", label = "Wait Time", value = station.waitTime)
            Spacer(modifier = Modifier.height(8.dp))
            InfoRow(icon = "₵", label = "Fare", value = "GH₵${"%.2f".format(station.fare)}")
            Spacer(modifier = Modifier.height(12.dp))

            // Report Queue button — gradient
            Button(
                onClick = { onReportQueue(station.name) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(36.dp),
                colors = ButtonDefaults.buttonColors(
                    backgroundColor = Color.Transparent,
                ),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(50))
                        .background(
                            Brush.horizontalGradient(
                                colors = listOf(TroskiRed, TroskiAmber),
                            )
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(text = "📢", style = MaterialTheme.typography.caption1)
                        Spacer(modifier = Modifier.width(5.dp))
                        Text(
                            text = "Report Queue",
                            style = MaterialTheme.typography.body1,
                            color = Color.White,
                        )
                    }
                }
            }
        }
    }
}

// ─── Info Row ───────────────────────────────────────────────────────────────

@Composable
private fun InfoRow(icon: String, label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(TroskiSurfaceHigh)
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = icon, style = MaterialTheme.typography.caption1)
        Spacer(modifier = Modifier.width(5.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.body2,
            color = TroskiMuted,
        )
        Spacer(modifier = Modifier.weight(1f))
        Text(
            text = value,
            style = MaterialTheme.typography.body1,
            color = Color.White,
        )
    }
}
