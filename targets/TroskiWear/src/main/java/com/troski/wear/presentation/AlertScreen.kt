package com.troski.wear.presentation

import android.content.Intent
import android.net.Uri
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.troski.wear.data.WatchAlert
import com.troski.wear.theme.*

/**
 * Screen 4: Alert — fire warning with alternative station suggestion.
 * Kinetic glow: amber blur at top, red blur at bottom (per DESIGN.md).
 * Matches Apple Watch AlertView.
 */
@Composable
fun AlertScreen(
    alert: WatchAlert,
    onNavigate: () -> Unit,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(TroskiBackground)
    ) {
        // ─── Kinetic Glow ───────────────────────────────────────────────────
        Box(
            modifier = Modifier
                .size(140.dp)
                .align(Alignment.TopCenter)
                .offset(y = (-20).dp)
                .blur(50.dp)
                .background(TroskiAmber.copy(alpha = 0.25f), CircleShape)
        )
        Box(
            modifier = Modifier
                .size(140.dp)
                .align(Alignment.BottomCenter)
                .offset(y = 20.dp)
                .blur(50.dp)
                .background(TroskiRed.copy(alpha = 0.25f), CircleShape)
        )

        // ─── Content ────────────────────────────────────────────────────────
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            // Warning icon in red circle
            Box(contentAlignment = Alignment.Center) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .background(TroskiRed.copy(alpha = 0.18f), CircleShape)
                )
                Text(
                    text = "⚠️",
                    style = MaterialTheme.typography.title1,
                )
            }
            Spacer(modifier = Modifier.height(8.dp))

            // Headline
            Text(
                text = "🔥 ${alert.station}: ${alert.queueStatus.label}",
                style = MaterialTheme.typography.title2,
                color = Color.White,
                textAlign = TextAlign.Center,
                maxLines = 2,
            )
            Spacer(modifier = Modifier.height(4.dp))

            // Suggestion
            Text(
                text = "Consider ${alert.alternative} — shorter queue right now",
                style = MaterialTheme.typography.body2,
                color = TroskiMuted,
                textAlign = TextAlign.Center,
                maxLines = 3,
            )
            Spacer(modifier = Modifier.height(8.dp))

            // Navigate button — gradient
            Button(
                onClick = {
                    // Open Google Maps with alternative station
                    val query = Uri.encode("${alert.alternative} Station, Accra, Ghana")
                    val geoUri = Uri.parse("geo:0,0?q=$query")
                    val intent = Intent(Intent.ACTION_VIEW, geoUri).apply {
                        setPackage("com.google.android.apps.maps")
                    }
                    try {
                        context.startActivity(intent)
                    } catch (_: Exception) {
                        // Fallback: open without specifying Maps package
                        context.startActivity(Intent(Intent.ACTION_VIEW, geoUri))
                    }
                    onNavigate()
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(36.dp),
                colors = ButtonDefaults.buttonColors(backgroundColor = Color.Transparent),
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
                        Text(text = "📍", style = MaterialTheme.typography.caption1)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Navigate",
                            style = MaterialTheme.typography.body1,
                            color = Color.White,
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(6.dp))

            // Dismiss button — outline
            Button(
                onClick = onDismiss,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(36.dp),
                colors = ButtonDefaults.outlinedButtonColors(),
            ) {
                Text(
                    text = "Dismiss",
                    style = MaterialTheme.typography.body2,
                    color = TroskiMuted,
                )
            }
        }
    }
}
