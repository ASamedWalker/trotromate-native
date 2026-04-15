import SwiftUI
import WatchKit

/// Alert screen — fire warning with alternative station suggestion.
/// Kinetic glow: amber blur at top, red blur at bottom (per DESIGN.md).
struct AlertView: View {
    let alert: WatchAlert
    let onNavigate: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        ZStack {
            Color.troskiBackground.ignoresSafeArea()

            // Kinetic glow — amber top, red bottom
            GeometryReader { geo in
                Circle()
                    .fill(Color.troskiAmber.opacity(0.25))
                    .frame(width: 140)
                    .blur(radius: 50)
                    .position(x: geo.size.width * 0.5, y: -10)

                Circle()
                    .fill(Color.troskiRed.opacity(0.25))
                    .frame(width: 140)
                    .blur(radius: 50)
                    .position(x: geo.size.width * 0.5, y: geo.size.height + 10)
            }

            ScrollView(showsIndicators: false) {
                VStack(spacing: 8) {
                    ZStack {
                        Circle()
                            .fill(Color.troskiRed.opacity(0.18))
                            .frame(width: 36, height: 36)
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.troskiRed)
                            .font(.system(size: 17, weight: .bold))
                    }
                    .padding(.top, 6)

                    Text("🔥 \(alert.station): \(alert.queueStatus.label)")
                        .font(.troskiSubheadline)
                        .multilineTextAlignment(.center)
                        .foregroundColor(.white)
                        .lineLimit(2)

                    Text("Consider \(alert.alternative) — shorter queue right now")
                        .font(.troskiDetail)
                        .multilineTextAlignment(.center)
                        .foregroundColor(.troskiMuted)
                        .lineLimit(3)

                    VStack(spacing: 6) {
                        Button(action: {
                            openMapsToStation(alert.alternative)
                            onNavigate()
                        }) {
                            HStack(spacing: 4) {
                                Image(systemName: "location.fill")
                                    .font(.troskiCaption)
                                Text("Navigate")
                            }
                        }
                        .buttonStyle(TroskiGradientButtonStyle())

                        Button("Dismiss", action: onDismiss)
                            .buttonStyle(TroskiOutlineButtonStyle())
                    }
                    .padding(.top, 6)
                }
                .padding(.horizontal, 10)
                .padding(.bottom, 12)
            }
        }
    }

    /// Open Apple Maps with the alternative station as destination.
    private func openMapsToStation(_ station: String) {
        let query = "\(station) Station, Accra, Ghana"
            .addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? station
        if let url = URL(string: "maps://?q=\(query)") {
            WKExtension.shared().openSystemURL(url)
        }
    }
}

#Preview {
    AlertView(
        alert: WatchAlert(
            station: "Circle",
            queueStatus: .veryLong,
            alternative: "Kaneshie"
        ),
        onNavigate: {},
        onDismiss: {}
    )
}
