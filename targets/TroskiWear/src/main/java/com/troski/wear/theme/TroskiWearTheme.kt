package com.troski.wear.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Colors
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Typography

// ─── Brand Palette ──────────────────────────────────────────────────────────
val TroskiBackground  = Color(0xFF100E0D)
val TroskiAmber       = Color(0xFFFFAD3A)
val TroskiRed         = Color(0xFFFF716A)
val TroskiMint        = Color(0xFF9BFFCE)
val TroskiMuted       = Color(0xFFAFAAA8)
val TroskiBorder      = Color(0xFF4B4746)
val TroskiSurfaceHigh = Color(0xB31C1918) // 70% opacity

// ─── Queue Status Colors ────────────────────────────────────────────────────
val QueueShort    = Color(0xFF22C55E)
val QueueModerate = Color(0xFFF59E0B)
val QueueLong     = Color(0xFFF97316)
val QueueVeryLong = Color(0xFFEF4444)

// ─── Wear Material Colors ───────────────────────────────────────────────────
private val TroskiColors = Colors(
    primary = TroskiAmber,
    primaryVariant = Color(0xFFE09A2F),
    secondary = TroskiMint,
    secondaryVariant = Color(0xFF7ADBB0),
    error = TroskiRed,
    onPrimary = Color.Black,
    onSecondary = Color.Black,
    onError = Color.White,
    background = TroskiBackground,
    onBackground = Color.White,
    surface = TroskiSurfaceHigh,
    onSurface = Color.White,
    onSurfaceVariant = TroskiMuted,
)

// ─── Typography ─────────────────────────────────────────────────────────────
// Matches Apple Watch sizes from Typography.swift
private val TroskiTypography = Typography(
    // Brand header — "TROSKI" (10sp, black weight)
    display1 = TextStyle(
        fontWeight = FontWeight.Black,
        fontSize = 10.sp,
        letterSpacing = 2.5.sp,
    ),
    // Fare display (22sp, black)
    display2 = TextStyle(
        fontWeight = FontWeight.Black,
        fontSize = 22.sp,
    ),
    // Route names, station names (14sp, bold)
    title1 = TextStyle(
        fontWeight = FontWeight.Bold,
        fontSize = 14.sp,
    ),
    // Alert/card headline (13sp, bold)
    title2 = TextStyle(
        fontWeight = FontWeight.Bold,
        fontSize = 13.sp,
    ),
    // Body — status text (11sp, semibold)
    body1 = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize = 11.sp,
    ),
    // Detail — wait time, secondary info (10sp, medium)
    body2 = TextStyle(
        fontWeight = FontWeight.Medium,
        fontSize = 10.sp,
    ),
    // Caption — timestamps (9sp, normal)
    caption1 = TextStyle(
        fontWeight = FontWeight.Normal,
        fontSize = 9.sp,
    ),
    // Tiny — pill labels (8sp, medium)
    caption2 = TextStyle(
        fontWeight = FontWeight.Medium,
        fontSize = 8.sp,
    ),
)

@Composable
fun TroskiWearTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colors = TroskiColors,
        typography = TroskiTypography,
        content = content,
    )
}
