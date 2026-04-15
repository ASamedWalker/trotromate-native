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
                Circle()
                    .fill(Color.troskiAmber.opacity(0.22))
                    .frame(width: 130)
                    .blur(radius: 44)
                    .position(x: geo.size.width * 0.3, y: -10)

                Circle()
                    .fill(Color.troskiRed.opacity(0.18))
                    .frame(width: 130)
                    .blur(radius: 44)
                    .position(x: geo.size.width * 0.75, y: geo.size.height + 10)
            }

            // Content
            VStack(alignment: .leading, spacing: 0) {
                Text("TROSKI")
                    .font(.troskiBrand)
                    .tracking(2.5)
                    .foregroundColor(.troskiAmber)
                    .padding(.bottom, 10)

                HStack(spacing: 3) {
                    Text(commute.from)
                        .font(.troskiHeadline)
                    Image(systemName: "arrow.right")
                        .font(.troskiCaption)
                        .foregroundColor(.troskiMuted)
                    Text(commute.to)
                        .font(.troskiHeadline)
                }
                .foregroundColor(.white)
                .padding(.bottom, 4)

                Text("GH₵\(String(format: "%.2f", commute.fare))")
                    .font(.troskiFare)
                    .foregroundColor(.troskiAmber)
                    .padding(.bottom, 6)

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
                        .font(.troskiBody)
                        .foregroundColor(.white)
                    Text("· \(commute.waitTime)")
                        .font(.troskiBody)
                        .foregroundColor(.troskiMuted)
                }
                .padding(.bottom, 6)

                Text("Updated \(commute.relativeTime)")
                    .font(.troskiCaption)
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
