package com.troski.wear.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.troski.wear.data.QueueStatus
import com.troski.wear.data.Station
import com.troski.wear.theme.*

/**
 * Screen 2: Station List — "Nearby Hubs" with colored left-border cards.
 * Matches Apple Watch StationListView exactly.
 */
@Composable
fun StationListScreen(
    stations: List<Station>,
    onStationClick: (Station) -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(TroskiBackground)
    ) {
        if (stations.isEmpty()) {
            // Empty state
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(text = "🚐", style = MaterialTheme.typography.display2)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "No stations",
                    style = MaterialTheme.typography.body2,
                    color = TroskiMuted,
                )
            }
        } else {
            val listState = rememberScalingLazyListState()

            ScalingLazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                contentPadding = PaddingValues(
                    start = 8.dp,
                    end = 8.dp,
                    top = 24.dp,
                    bottom = 16.dp,
                ),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                // Header
                item {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "TROSKI",
                            style = MaterialTheme.typography.display1,
                            color = TroskiAmber,
                        )
                        Text(
                            text = "NEARBY HUBS",
                            style = MaterialTheme.typography.caption2,
                            color = TroskiMuted,
                        )
                    }
                }

                // Station cards
                items(stations, key = { it.name }) { station ->
                    StationCard(
                        station = station,
                        onClick = { onStationClick(station) },
                    )
                }
            }
        }
    }
}

// ─── Station Card ───────────────────────────────────────────────────────────

@Composable
private fun StationCard(
    station: Station,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(if (station.isDistant) 0.6f else 1f)
            .clip(RoundedCornerShape(12.dp))
            .background(TroskiSurfaceHigh)
            .clickable(onClick = onClick)
            .padding(vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Colored left border
        Box(
            modifier = Modifier
                .width(4.dp)
                .height(40.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(station.borderColor())
        )

        Spacer(modifier = Modifier.width(8.dp))

        // Station info
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = station.name,
                style = MaterialTheme.typography.title1,
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(modifier = Modifier.height(3.dp))

            // Status emoji + label
            Row {
                Text(
                    text = station.queueStatus.emoji,
                    style = MaterialTheme.typography.caption2,
                )
                Spacer(modifier = Modifier.width(3.dp))
                Text(
                    text = station.queueStatus.label,
                    style = MaterialTheme.typography.body2,
                    color = station.queueStatus.color(),
                )
            }

            // Fare + wait time (or "X min away" for distant)
            if (station.isDistant) {
                Row {
                    Text(text = "⏱", style = MaterialTheme.typography.caption1)
                    Spacer(modifier = Modifier.width(3.dp))
                    Text(
                        text = "${station.waitTime} away",
                        style = MaterialTheme.typography.caption1,
                        color = TroskiMuted.copy(alpha = 0.6f),
                    )
                }
            } else {
                Text(
                    text = "GH₵${"%.2f".format(station.fare)} · ${station.waitTime}",
                    style = MaterialTheme.typography.caption1,
                    color = TroskiMuted,
                )
            }
        }

        // Chevron
        Text(
            text = "›",
            style = MaterialTheme.typography.title1,
            color = TroskiBorder,
            modifier = Modifier.padding(end = 6.dp),
        )
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

private fun Station.borderColor(): Color = when (queueStatus) {
    QueueStatus.SHORT -> TroskiMint
    QueueStatus.MODERATE -> TroskiAmber
    QueueStatus.LONG -> Color(0xFFFF7351)
    QueueStatus.VERY_LONG -> QueueVeryLong
}
