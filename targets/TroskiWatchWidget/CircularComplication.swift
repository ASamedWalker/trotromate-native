import SwiftUI
import WidgetKit

/// Variant 1: Circular — "Micro Transit Hub"
/// Small pill: green/amber/red dot + fare.
struct CircularComplicationView: View {
    let entry: TroskiEntry

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()

            VStack(spacing: 1) {
                Circle()
                    .fill(entry.data.queueColor)
                    .frame(width: 8, height: 8)

                Text(entry.data.fareShort)
                    .font(.system(size: 12, weight: .bold))
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
            }
        }
    }
}

struct TroskiCircularWidget: Widget {
    let kind = "TroskiCircular"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TroskiTimelineProvider()) { entry in
            CircularComplicationView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Queue Status")
        .description("Queue dot + fare at a glance")
        .supportedFamilies([.accessoryCircular])
    }
}
