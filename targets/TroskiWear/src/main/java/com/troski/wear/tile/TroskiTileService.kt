package com.troski.wear.tile

import android.content.Context
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.LayoutElementBuilders.*
import androidx.wear.protolayout.ModifiersBuilders.*
import androidx.wear.protolayout.ResourceBuilders.Resources
import androidx.wear.protolayout.TimelineBuilders.Timeline
import androidx.wear.protolayout.TimelineBuilders.TimelineEntry
import androidx.wear.tiles.RequestBuilders.ResourcesRequest
import androidx.wear.tiles.RequestBuilders.TileRequest
import androidx.wear.tiles.TileBuilders.Tile
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.troski.wear.data.CommuteData
import com.troski.wear.data.QueueStatus
import com.troski.wear.data.WearDataSync

/**
 * Wear OS Tile — glanceable commute data on the watch face.
 *
 * Shows: route → fare + queue status dot.
 * Equivalent to Apple Watch Modular Compact complication.
 *
 * Taps open the Troski Wear app (MainActivity).
 */
class TroskiTileService : TileService() {

    companion object {
        private const val RESOURCES_VERSION = "1"

        // Colors (ARGB ints)
        private const val COLOR_AMBER = 0xFFFFAD3A.toInt()
        private const val COLOR_WHITE = 0xFFFFFFFF.toInt()
        private const val COLOR_MUTED = 0xFFAFAAA8.toInt()
        private const val COLOR_SURFACE = 0xB31C1918.toInt()
        private const val COLOR_QUEUE_SHORT = 0xFF22C55E.toInt()
        private const val COLOR_QUEUE_MODERATE = 0xFFF59E0B.toInt()
        private const val COLOR_QUEUE_LONG = 0xFFF97316.toInt()
        private const val COLOR_QUEUE_VERY_LONG = 0xFFEF4444.toInt()
    }

    override fun onTileRequest(request: TileRequest): ListenableFuture<Tile> {
        val dataSync = WearDataSync.getInstance(this)
        val commute = dataSync.commute.value

        val layout = if (commute != null) {
            commuteLayout(commute)
        } else {
            emptyLayout()
        }

        val tile = Tile.Builder()
            .setResourcesVersion(RESOURCES_VERSION)
            .setFreshnessIntervalMillis(300_000) // Refresh every 5 min
            .setTileTimeline(
                Timeline.Builder()
                    .addTimelineEntry(
                        TimelineEntry.Builder()
                            .setLayout(Layout.Builder().setRoot(layout).build())
                            .build()
                    )
                    .build()
            )
            .build()

        return Futures.immediateFuture(tile)
    }

    override fun onTileResourcesRequest(request: ResourcesRequest): ListenableFuture<Resources> {
        return Futures.immediateFuture(
            Resources.Builder()
                .setVersion(RESOURCES_VERSION)
                .build()
        )
    }

    // ─── Commute Tile Layout ────────────────────────────────────────────────

    private fun commuteLayout(commute: CommuteData): LayoutElement {
        val clickable = Clickable.Builder()
            .setOnClick(
                ActionBuilders.LaunchAction.Builder()
                    .setAndroidActivity(
                        ActionBuilders.AndroidActivity.Builder()
                            .setPackageName(packageName)
                            .setClassName("com.troski.wear.MainActivity")
                            .build()
                    )
                    .build()
            )
            .build()

        return Box.Builder()
            .setWidth(expand())
            .setHeight(expand())
            .setModifiers(
                Modifiers.Builder()
                    .setClickable(clickable)
                    .setBackground(
                        Background.Builder()
                            .setColor(argb(COLOR_SURFACE))
                            .setCorner(Corner.Builder().setRadius(dp(12f)).build())
                            .build()
                    )
                    .setPadding(
                        Padding.Builder()
                            .setAll(dp(8f))
                            .build()
                    )
                    .build()
            )
            .addContent(
                Column.Builder()
                    .setWidth(expand())
                    .addContent(
                        // Top row: "CURRENT ROUTE" + queue dot
                        Row.Builder()
                            .setWidth(expand())
                            .addContent(
                                Text.Builder()
                                    .setText("CURRENT ROUTE")
                                    .setFontStyle(
                                        FontStyle.Builder()
                                            .setSize(dp(9f))
                                            .setColor(argb(COLOR_MUTED))
                                            .build()
                                    )
                                    .build()
                            )
                            .addContent(
                                Spacer.Builder().setWidth(expand()).build()
                            )
                            .addContent(
                                // Queue status dot
                                Box.Builder()
                                    .setWidth(dp(8f))
                                    .setHeight(dp(8f))
                                    .setModifiers(
                                        Modifiers.Builder()
                                            .setBackground(
                                                Background.Builder()
                                                    .setColor(argb(queueColor(commute.queueStatus)))
                                                    .setCorner(Corner.Builder().setRadius(dp(4f)).build())
                                                    .build()
                                            )
                                            .build()
                                    )
                                    .build()
                            )
                            .build()
                    )
                    .addContent(Spacer.Builder().setHeight(dp(4f)).build())
                    .addContent(
                        // Bottom row: route + fare
                        Row.Builder()
                            .setWidth(expand())
                            .addContent(
                                Text.Builder()
                                    .setText("${commute.from}→${commute.to}")
                                    .setFontStyle(
                                        FontStyle.Builder()
                                            .setSize(dp(12f))
                                            .setWeight(FONT_WEIGHT_BOLD)
                                            .setColor(argb(COLOR_WHITE))
                                            .build()
                                    )
                                    .setMaxLines(1)
                                    .build()
                            )
                            .addContent(
                                Spacer.Builder().setWidth(expand()).build()
                            )
                            .addContent(
                                Text.Builder()
                                    .setText("GH₵${"%.2f".format(commute.fare)}")
                                    .setFontStyle(
                                        FontStyle.Builder()
                                            .setSize(dp(12f))
                                            .setWeight(FONT_WEIGHT_BOLD)
                                            .setColor(argb(COLOR_AMBER))
                                            .build()
                                    )
                                    .build()
                            )
                            .build()
                    )
                    .build()
            )
            .build()
    }

    // ─── Empty State ────────────────────────────────────────────────────────

    private fun emptyLayout(): LayoutElement {
        return Box.Builder()
            .setWidth(expand())
            .setHeight(expand())
            .setHorizontalAlignment(HORIZONTAL_ALIGN_CENTER)
            .setVerticalAlignment(VERTICAL_ALIGN_CENTER)
            .addContent(
                Text.Builder()
                    .setText("🚐 Open Troski")
                    .setFontStyle(
                        FontStyle.Builder()
                            .setSize(dp(11f))
                            .setColor(argb(COLOR_MUTED))
                            .build()
                    )
                    .build()
            )
            .build()
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private fun queueColor(status: QueueStatus): Int = when (status) {
        QueueStatus.SHORT -> COLOR_QUEUE_SHORT
        QueueStatus.MODERATE -> COLOR_QUEUE_MODERATE
        QueueStatus.LONG -> COLOR_QUEUE_LONG
        QueueStatus.VERY_LONG -> COLOR_QUEUE_VERY_LONG
    }
}
