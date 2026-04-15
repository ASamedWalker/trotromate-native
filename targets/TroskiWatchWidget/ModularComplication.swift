import SwiftUI
import WidgetKit

/// Variant 2: Modular Compact — "Technical Readout" (RECOMMENDED)
/// Glass panel: "CURRENT ROUTE" label + dot, route + fare.
struct ModularComplicationView: View {
    let entry: TroskiEntry

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()

            VStack(alignment: .leading, spacing: 2) {
                // Top row: label + status dot
                HStack(spacing: 4) {
                    Text("CURRENT ROUTE")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundColor(.secondary)

                    Circle()
                        .fill(entry.data.queueColor)
                        .frame(width: 6, height: 6)
                }

                // Bottom row: route + fare
                HStack {
                    Text(entry.data.route)
                        .font(.system(size: 12, weight: .bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)

                    Spacer()

                    Text(entry.data.fareFormatted)
                        .font(.system(size: 12, weight: .black))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 4)
        }
    }
}

struct TroskiModularWidget: Widget {
    let kind = "TroskiModular"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TroskiTimelineProvider()) { entry in
            ModularComplicationView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Current Route")
        .description("Route, fare, and queue status")
        .supportedFamilies([.accessoryRectangular])
    }
}
