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
