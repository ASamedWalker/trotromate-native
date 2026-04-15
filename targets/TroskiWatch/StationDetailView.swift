import SwiftUI
import WatchConnectivity

/// Station detail — large queue status, wait time, fare, Report Queue button.
struct StationDetailView: View {
    let station: Station

    var body: some View {
        ZStack {
            Color.troskiBackground.ignoresSafeArea()

            // Subtle glow matching queue color
            GeometryReader { geo in
                Circle()
                    .fill(station.queueStatus.swiftUIColor.opacity(0.2))
                    .frame(width: 140)
                    .blur(radius: 50)
                    .position(x: geo.size.width * 0.5, y: 20)
            }

            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    // Station name
                    Text(station.name)
                        .font(.troskiFare)
                        .foregroundColor(.white)
                        .padding(.top, 4)
                        .padding(.bottom, 8)

                    // Large queue status badge
                    VStack(spacing: 6) {
                        ZStack {
                            Circle()
                                .fill(station.queueStatus.swiftUIColor.opacity(0.15))
                                .frame(width: 44, height: 44)
                            Circle()
                                .fill(station.queueStatus.swiftUIColor)
                                .frame(width: 16, height: 16)
                        }

                        Text(station.queueStatus.label)
                            .font(.troskiSubheadline)
                            .foregroundColor(station.queueStatus.swiftUIColor)
                    }
                    .padding(.bottom, 10)

                    // Info rows
                    VStack(spacing: 8) {
                        infoRow(icon: "clock.fill", label: "Wait Time", value: station.waitTime)
                        infoRow(icon: "cedisign.circle.fill", label: "Fare", value: "GH₵\(String(format: "%.2f", station.fare))")
                    }
                    .padding(.horizontal, 8)
                    .padding(.bottom, 12)

                    // Report Queue button — deep links to phone app
                    Button(action: reportQueue) {
                        HStack(spacing: 5) {
                            Image(systemName: "megaphone.fill")
                                .font(.troskiCaption)
                            Text("Report Queue")
                                .font(.troskiBody)
                        }
                    }
                    .buttonStyle(TroskiGradientButtonStyle())
                    .padding(.horizontal, 12)
                }
                .padding(.bottom, 16)
            }
        }
    }

    private func infoRow(icon: String, label: String, value: String) -> some View {
        HStack {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.troskiCaption)
                    .foregroundColor(.troskiAmber)
                Text(label)
                    .font(.troskiDetail)
                    .foregroundColor(.troskiMuted)
            }
            Spacer()
            Text(value)
                .font(.troskiBody)
                .foregroundColor(.white)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color.troskiSurfaceHigh)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func reportQueue() {
        // Send message to iPhone app to open Report Queue screen
        if WCSession.isSupported() {
            let session = WCSession.default
            if session.isReachable {
                session.sendMessage(
                    ["action": "reportQueue", "station": station.name],
                    replyHandler: nil
                )
            }
        }
    }
}

#Preview {
    StationDetailView(station: Station(
        name: "Circle",
        queueStatus: .long,
        waitTime: "25 min",
        fare: 8.50
    ))
}
