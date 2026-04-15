import SwiftUI

/// Main commute screen — route, fare, queue status, freshness.
/// Dark background with kinetic amber/red glow blobs.
struct MainCommuteView: View {
    let commute: CommuteData

    var body: some View {
        ZStack {
            Color.troskiBackground.ignoresSafeArea()

            // Kinetic glow blobs
            GeometryReader { geo in
                // Amber blob — top
                Circle()
                    .fill(Color.troskiAmber.opacity(0.22))
                    .frame(width: 130)
                    .blur(radius: 44)
                    .position(x: geo.size.width * 0.3, y: -10)

                // Red blob — bottom
                Circle()
                    .fill(Color.troskiRed.opacity(0.18))
                    .frame(width: 130)
                    .blur(radius: 44)
                    .position(x: geo.size.width * 0.75, y: geo.size.height + 10)
            }

            // Content
            VStack(alignment: .leading, spacing: 0) {
                // Brand header
                Text("TROSKI")
                    .font(.system(size: 10, weight: .black))
                    .tracking(2.5)
                    .foregroundColor(.troskiAmber)
                    .padding(.bottom, 10)

                // Route
                HStack(spacing: 3) {
                    Text(commute.from)
                        .font(.system(size: 14, weight: .bold))
                    Image(systemName: "arrow.right")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundColor(.troskiMuted)
                    Text(commute.to)
                        .font(.system(size: 14, weight: .bold))
                }
                .foregroundColor(.white)
                .padding(.bottom, 4)

                // Fare
                Text("GH₵\(String(format: "%.2f", commute.fare))")
                    .font(.system(size: 22, weight: .black))
                    .foregroundColor(.troskiAmber)
                    .padding(.bottom, 6)

                // Queue status
                HStack(spacing: 5) {
                    ZStack {
                        Circle()
                            .fill(commute.queueStatus.swiftUIColor.opacity(0.2))
                            .frame(width: 18, height: 18)
                        Circle()
                            .fill(commute.queueStatus.swiftUIColor)
                            .frame(width: 7, height: 7)
                    }
                    Text(commute.queueStatus.label)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.white)
                    Text("· \(commute.waitTime)")
                        .font(.system(size: 11))
                        .foregroundColor(.troskiMuted)
                }
                .padding(.bottom, 6)

                // Freshness
                Text("Updated \(commute.relativeTime)")
                    .font(.system(size: 9))
                    .foregroundColor(.troskiMuted)
            }
            .padding(12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }
}

#Preview {
    MainCommuteView(commute: CommuteData(
        from: "Circle",
        to: "Madina",
        fare: 8.50,
        queueStatus: .veryLong,
        waitTime: "25 min"
    ))
}
