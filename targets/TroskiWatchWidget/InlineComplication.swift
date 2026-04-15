import SwiftUI
import WidgetKit

/// Variant 4: Inline — single line of text on the watch face.
/// Shows route + fare in a compact text format.
struct InlineComplicationView: View {
    let entry: TroskiEntry

    var body: some View {
        Text("\(entry.data.route) · \(entry.data.fareShort)")
    }
}

struct TroskiInlineWidget: Widget {
    let kind = "TroskiInline"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TroskiTimelineProvider()) { entry in
            InlineComplicationView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Route & Fare")
        .description("Route and fare in a single line")
        .supportedFamilies([.accessoryInline])
    }
}
