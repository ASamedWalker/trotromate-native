import SwiftUI

/// Compact commute row — used for complications and future list views.
struct CommuteRow: View {
    let commute: CommuteData

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 4) {
                Text(commute.from)
                    .font(.troskiHeadline)
                Image(systemName: "arrow.right")
                    .font(.troskiDetail)
                    .foregroundColor(.troskiMuted)
                Text(commute.to)
                    .font(.troskiHeadline)
            }
            .foregroundColor(.white)

            Text("GH₵\(String(format: "%.2f", commute.fare))")
                .font(.system(size: 18, weight: .black))
                .foregroundColor(.troskiAmber)

            HStack(spacing: 5) {
                Circle()
                    .fill(commute.queueStatus.swiftUIColor)
                    .frame(width: 7, height: 7)
                Text("\(commute.queueStatus.label) · \(commute.waitTime)")
                    .font(.troskiBody)
                    .foregroundColor(.white.opacity(0.85))
            }

            Text("Updated \(commute.relativeTime)")
                .font(.troskiCaption)
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
