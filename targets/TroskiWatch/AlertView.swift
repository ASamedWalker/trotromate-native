import SwiftUI

/// Alert screen — fire warning with alternative station suggestion.
/// Shown when a very long queue is detected at the user's route station.
struct AlertView: View {
    let alert: WatchAlert
    let onNavigate: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        ZStack {
            Color.troskiBackground.ignoresSafeArea()

            // Red glow behind warning icon
            Circle()
                .fill(Color.troskiRed.opacity(0.22))
                .frame(width: 160)
                .blur(radius: 48)
                .offset(y: -40)

            ScrollView {
                VStack(spacing: 8) {
                    // Warning icon in red circle
                    ZStack {
                        Circle()
                            .fill(Color.troskiRed.opacity(0.18))
                            .frame(width: 36, height: 36)
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.troskiRed)
                            .font(.system(size: 17, weight: .bold))
                    }
                    .padding(.top, 4)

                    // Headline
                    Text("🔥 \(alert.station): \(alert.queueStatus.label)")
                        .font(.system(size: 13, weight: .bold))
                        .multilineTextAlignment(.center)
                        .foregroundColor(.white)
                        .lineLimit(2)

                    // Alternative suggestion
                    Text("Consider \(alert.alternative) — shorter queue now")
                        .font(.system(size: 10))
                        .multilineTextAlignment(.center)
                        .foregroundColor(.troskiMuted)
                        .lineLimit(3)

                    // Actions
                    VStack(spacing: 6) {
                        Button("Navigate", action: onNavigate)
                            .buttonStyle(TroskiGradientButtonStyle())

                        Button("Dismiss", action: onDismiss)
                            .buttonStyle(TroskiOutlineButtonStyle())
                    }
                    .padding(.top, 4)
                }
                .padding(.horizontal, 10)
                .padding(.bottom, 10)
            }
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
