import SwiftUI

/// Compact commute row — used for complications and future list views.
struct CommuteRow: View {
    let commute: CommuteData

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            // Route
            HStack(spacing: 4) {
                Text(commute.from)
                    .font(.system(size: 14, weight: .semibold))
                Image(systemName: "arrow.right")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.troskiMuted)
                Text(commute.to)
                    .font(.system(size: 14, weight: .semibold))
            }
            .foregroundColor(.white)

            // Fare
            Text("GH₵\(String(format: "%.2f", commute.fare))")
                .font(.system(size: 18, weight: .black))
                .foregroundColor(.troskiAmber)

            // Queue + wait
            HStack(spacing: 5) {
                Circle()
                    .fill(commute.queueStatus.swiftUIColor)
                    .frame(width: 7, height: 7)
                Text("\(commute.queueStatus.label) · \(commute.waitTime)")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.white.opacity(0.85))
            }

            // Freshness
            Text("Updated \(commute.relativeTime)")
                .font(.system(size: 9))
                .foregroundColor(.troskiMuted)
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    CommuteRow(commute: CommuteData(
        from: "Circle",
        to: "Madina",
        fare: 8.50,
        queueStatus: .long,
        waitTime: "25 min"
    ))
    .background(Color.troskiBackground)
}
