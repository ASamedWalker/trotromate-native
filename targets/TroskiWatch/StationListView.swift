import SwiftUI

/// Scrollable list of nearby stations with colored status dots and wait times.
struct StationListView: View {
    @ObservedObject private var connector = WatchConnector.shared

    var body: some View {
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
                ScrollView {
                    VStack(spacing: 0) {
                        ForEach(connector.stations) { station in
                            StationRow(station: station)
                            Rectangle()
                                .fill(Color.troskiBorder.opacity(0.4))
                                .frame(height: 1)
                                .padding(.leading, 36)
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Station Row

struct StationRow: View {
    let station: Station

    var body: some View {
        HStack(spacing: 8) {
            // Tinted dot icon
            ZStack {
                Circle()
                    .fill(station.queueStatus.swiftUIColor.opacity(0.18))
                    .frame(width: 22, height: 22)
                Circle()
                    .fill(station.queueStatus.swiftUIColor)
                    .frame(width: 8, height: 8)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(station.name)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.white)
                HStack(spacing: 4) {
                    Text(station.waitTime)
                        .font(.system(size: 10))
                        .foregroundColor(.troskiMuted)
                    Text("·")
                        .foregroundColor(.troskiBorder)
                        .font(.system(size: 10))
                    Text("GH₵\(String(format: "%.2f", station.fare))")
                        .font(.system(size: 10))
                        .foregroundColor(.troskiMuted)
                }
            }

            Spacer()

            // Queue label pill
            Text(station.queueStatus.label)
                .font(.system(size: 8, weight: .medium))
                .foregroundColor(station.queueStatus.swiftUIColor)
                .padding(.horizontal, 5)
                .padding(.vertical, 2)
                .background(
                    Capsule()
                        .fill(station.queueStatus.swiftUIColor.opacity(0.12))
                )
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 7)
    }
}

#Preview {
    StationListView()
}
