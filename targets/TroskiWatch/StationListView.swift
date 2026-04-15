import SwiftUI

/// Scrollable station list — "Nearby Hubs" with colored left-border cards.
struct StationListView: View {
    @ObservedObject private var connector = WatchConnector.shared

    var body: some View {
        NavigationView {
        ZStack {
            Color.troskiBackground.ignoresSafeArea()

            if connector.stations.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "tram.fill")
                        .font(.system(size: 22))
                        .foregroundColor(.troskiAmber.opacity(0.5))
                    Text("No stations")
                        .font(.system(size: 12))
                        .foregroundColor(.troskiMuted)
                }
            } else {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        // Header
                        VStack(spacing: 2) {
                            Text("TROSKI")
                                .font(.troskiBrand)
                                .tracking(2.5)
                                .foregroundColor(.troskiAmber)
                            Text("NEARBY HUBS")
                                .font(.troskiTiny)
                                .tracking(1.5)
                                .foregroundColor(.troskiMuted)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.bottom, 8)

                        // Station cards
                        VStack(spacing: 6) {
                            ForEach(connector.stations) { station in
                                NavigationLink(destination: StationDetailView(station: station)) {
                                    StationCard(station: station)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 4)
                    }
                    .padding(.top, 4)
                    .padding(.bottom, 16)
                }
            }
        }
        } // NavigationView
    }
}

// MARK: - Station Card

struct StationCard: View {
    let station: Station
    @State private var isPressed = false

    var body: some View {
        HStack(spacing: 0) {
            // Colored left border
            RoundedRectangle(cornerRadius: 2)
                .fill(borderColor)
                .frame(width: 4)
                .padding(.vertical, 4)

            HStack(spacing: 6) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(station.name)
                        .font(.troskiHeadline)
                        .foregroundColor(.white)

                    HStack(spacing: 3) {
                        Text(statusEmoji)
                            .font(.troskiTiny)
                        Text(station.queueStatus.label)
                            .font(.troskiDetail)
                            .foregroundColor(station.queueStatus.swiftUIColor)
                    }

                    if station.isDistant {
                        HStack(spacing: 3) {
                            Image(systemName: "timer")
                                .font(.troskiCaption)
                            Text(station.waitTime + " away")
                                .font(.troskiCaption)
                        }
                        .foregroundColor(.troskiMuted.opacity(0.6))
                    } else {
                        Text("GH₵\(String(format: "%.2f", station.fare)) · \(station.waitTime)")
                            .font(.troskiCaption)
                            .foregroundColor(.troskiMuted)
                    }
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.troskiDetail)
                    .foregroundColor(.troskiBorder)
            }
            .padding(.leading, 8)
            .padding(.trailing, 6)
        }
        .padding(.vertical, 7)
        .background(Color.troskiSurfaceHigh)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .opacity(station.isDistant ? 0.6 : 1.0)
        .scaleEffect(isPressed ? 0.95 : 1.0)
        .animation(.easeInOut(duration: 0.1), value: isPressed)
    }

    private var borderColor: Color {
        switch station.queueStatus {
        case .short:    return .troskiMint
        case .moderate: return .troskiAmber
        case .long:     return Color(hex: "#ff7351")
        case .veryLong: return .queueVeryLong
        }
    }

    private var statusEmoji: String {
        switch station.queueStatus {
        case .short:    return "🟢"
        case .moderate: return "🟡"
        case .long:     return "🔴"
        case .veryLong: return "🔴"
        }
    }
}

#Preview {
    StationListView()
}
