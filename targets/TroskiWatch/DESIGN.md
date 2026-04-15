# Troski Watch — Design Reference

## Stitch Design (Apr 14, 2026)

### Alert Screen
- Round watch face (184x184px, 44mm)
- Dark background (#100e0d) with subtle map texture overlay (20% opacity, grayscale)
- Kinetic glow: amber blur at top, red blur at bottom
- Warning icon in red circle at top
- "🔥 Circle: Very Long Queue" — bold headline
- "Consider Kaneshie — shorter queue right now" — body text
- "Navigate" button — amber-to-red gradient, rounded full
- "Dismiss" button — outline, subtle

### Color Palette
- Background: #100e0d (surface)
- Primary: #ffad3a (amber)
- Error/Danger: #ff716a (coral red)
- Tertiary/Safe: #9bffce (mint green)
- Text: #ffffff (on-surface)
- Muted text: #afaaa8 (on-surface-variant)
- Border: #4b4746 (outline-variant)

### Queue Status Colors (match phone app)
- Short/Empty: #22c55e (green)
- Moderate: #f59e0b (amber)
- Long: #f97316 (orange)
- Very Long: #ef4444 (red)

### Typography
- Headlines: Space Grotesk Bold (maps to SF Pro Bold on watchOS)
- Body: Inter Regular (maps to SF Pro Regular on watchOS)
- Sizes: 13px headline, 10px body, 9px labels

### Key Design Elements
1. Gradient button: linear-gradient(135deg, #ff716a, #ffad3a)
2. Glass panels: backdrop-blur(20px), rgba(28,25,24,0.7)
3. Map texture background behind content (very subtle)
4. Round status icons with tinted backgrounds
5. Crown/bezel detail on right side

### Screens to Build
1. **Main Commute** — route, fare, queue status, freshness
2. **Station List** — scrollable, colored dots, wait times
3. **Alert Notification** — fire warning, alternative suggestion, Navigate/Dismiss
4. **Complication** — circular dot, modular text, corner fare

## Station List Screen (Stitch Design #2)

### Layout
- Round watch face (320x320px container)
- "TROSKI" header in amber, centered, Space Grotesk Black, tracking widest
- "Nearby Hubs" subtitle in stone-400, 10px, uppercase tracking

### Station Rows
- Each row: rounded-xl card, dark bg (`surface-container-high`)
- **Colored left border (4px)** by queue status:
  - Red (`#ff7351`) = Long queue
  - Green/Mint (`#9bffce`) = Clear
  - Amber (`#ffad3a`) = Moderate
  - Stone (`#4b4746`) = No data / distant
- Station name: Space Grotesk Bold, 14px, white
- Status: 10px, colored emoji dot + text ("🔴 Long Queue", "🟢 Clear", "🟡 Moderate")
- Chevron right arrow on each row
- Distant stations: 60% opacity, stone color, "12 min away" with timer icon
- Tap animation: scale-95 on press

### Bottom Nav (3 icons)
- Dashboard / Bus (active, amber with amber/10 bg) / Notifications
- Fixed at bottom, stone-950/90 bg with blur
- Active tab: amber icon with amber tinted bg circle, scale-110

### Visual Effects
- Curved edge safe area mask: `radial-gradient(circle, black 65%, transparent 100%)`
- Inset amber glow shadow on the watch container
- Scrollable content with hidden scrollbar

## Watch Face Complications (Stitch Design #3)

Three complication variants for the watch face — user sees Troski data without opening the app.

### Variant 1: Circular — "Micro Transit Hub"
- Position: bottom of watch face
- Shape: small rounded pill
- Content: green/amber/red dot + "GH₵8.50" fare
- Style: `surface-container-highest` bg, `outline-variant/30` border
- Font: Space Grotesk Bold, 14px, primary color for fare
- Dot: 8px, tertiary (green) / primary (amber) / error (red)
- Minimal footprint — status + fare in one glance

### Variant 2: Modular Compact — "Technical Readout" (RECOMMENDED)
- Position: center of watch face, below time
- Shape: glass panel rectangle (176x64px), rounded-lg
- Content:
  - Top row: "CURRENT ROUTE" label (9px, stone) + green dot
  - Bottom row: "Circle→Madina" (12px bold white) + "GH₵8.50" (12px black primary, right-aligned)
- Style: glass-panel (`backdrop-blur(20px)`, `rgba(28,25,24,0.4)`), `outline-variant/30` border
- This is the **hero complication** — highest data density, most useful
- Scaled 110%, ring-2 ring-primary/20 highlight in the showcase

### Variant 3: Corner — "Peripheral Insight"
- Position: top-right corner of watch face
- Shape: curved text along a circular arc
- Content: "₵8.50" curved along the bezel edge
- Style: primary color text, slight rotation (-12deg)
- SVG path text: `<textPath>` along a curved arc
- Subtle — stays out of the way until you glance at it

### Implementation Notes (Phase 2)
- Requires `CLKComplicationDataSource` protocol in SwiftUI
- Complication families to support:
  - `.circularSmall` → Variant 1
  - `.modularSmall` / `.modularLarge` → Variant 2
  - `.graphicCorner` → Variant 3
- Data source updates via `CLKComplicationServer.sharedInstance().reloadComplication()`
- Push-based updates for urgent queue spikes via APNs complication push type
- Update budget: ~2 updates per hour (watchOS limit)
- Fallback: show last known data if no recent sync
