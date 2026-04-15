import SwiftUI
import WidgetKit

/// Variant 3: Corner — "Peripheral Insight"
/// Fare in the corner with route as the widget label along the bezel.
struct CornerComplicationView: View {
    let entry: TroskiEntry

    var body: some View {
        Text(entry.data.fareShort)
            .font(.system(size: 14, weight: .bold))
            .foregroundColor(.troskiAmber)
            .minimumScaleFactor(0.6)
            .widgetLabel {
                Text(entry.data.route)
            }
    }
}

struct TroskiCornerWidget: Widget {
    let kind = "TroskiCorner"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TroskiTimelineProvider()) { entry in
            CornerComplicationView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Fare")
        .description("Fare on the corner of your watch face")
        .supportedFamilies([.accessoryCorner])
    }
}
