package com.troski.wear.presentation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController
import com.troski.wear.data.Station
import com.troski.wear.data.WearDataSync
import com.troski.wear.theme.TroskiAmber
import com.troski.wear.theme.TroskiBackground
import com.troski.wear.theme.TroskiMuted
import com.troski.wear.theme.TroskiWearTheme

/**
 * Root composable — SwipeDismissable navigation host with page swipe.
 * Mirrors Apple Watch ContentView: TabView(Commute, StationList) + alert overlay.
 *
 * Navigation:
 *   "home"           → Commute Summary (page swipe to station list)
 *   "stations"       → Station List
 *   "station/{name}" → Station Detail
 *   Alert sheet      → floats on top when alert arrives
 */
@Composable
fun TroskiWearApp(dataSync: WearDataSync) {
    val commute by dataSync.commute.collectAsState()
    val stations by dataSync.stations.collectAsState()
    val activeAlert by dataSync.activeAlert.collectAsState()

    var showAlert by remember { mutableStateOf(false) }

    // Show alert when one arrives
    if (activeAlert != null && !showAlert) {
        showAlert = true
    }

    TroskiWearTheme {
        if (showAlert && activeAlert != null) {
            // Alert takes over the entire screen
            AlertScreen(
                alert = activeAlert!!,
                onNavigate = {
                    showAlert = false
                    dataSync.dismissAlert()
                },
                onDismiss = {
                    showAlert = false
                    dataSync.dismissAlert()
                },
            )
        } else if (commute != null) {
            val navController = rememberSwipeDismissableNavController()

            SwipeDismissableNavHost(
                navController = navController,
                startDestination = "home",
            ) {
                composable("home") {
                    CommuteScreen(commute = commute!!)
                }
                composable("stations") {
                    StationListScreen(
                        stations = stations,
                        onStationClick = { station ->
                            navController.navigate("station/${station.name}")
                        },
                    )
                }
                composable("station/{name}") { backStackEntry ->
                    val name = backStackEntry.arguments?.getString("name") ?: ""
                    val station = stations.find { it.name == name }
                        ?: Station(
                            name = name,
                            queueStatus = com.troski.wear.data.QueueStatus.SHORT,
                            waitTime = "",
                            fare = 0.0,
                        )
                    StationDetailScreen(
                        station = station,
                        onReportQueue = { stationName ->
                            dataSync.sendReportQueue(stationName)
                        },
                    )
                }
            }
        } else {
            // Empty state — waiting for phone data
            EmptyState()
        }
    }
}

@Composable
private fun EmptyState() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(TroskiBackground),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text = "🚐", style = MaterialTheme.typography.display2)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Waiting for\ncommute data",
                style = MaterialTheme.typography.body2,
                color = TroskiMuted,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Open Troski on your phone",
                style = MaterialTheme.typography.caption1,
                color = TroskiMuted,
                textAlign = TextAlign.Center,
            )
        }
    }
}
