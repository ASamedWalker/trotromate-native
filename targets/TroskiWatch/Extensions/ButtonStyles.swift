import SwiftUI

/// Amber → red gradient fill button (primary action)
struct TroskiGradientButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .bold))
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 9)
            .background(
                LinearGradient(
                    colors: [Color.troskiRed, Color.troskiAmber],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .clipShape(Capsule())
            )
            .opacity(configuration.isPressed ? 0.75 : 1.0)
    }
}

/// Outline button (secondary/dismiss action)
struct TroskiOutlineButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 12, weight: .medium))
            .foregroundColor(.troskiMuted)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 9)
            .background(
                Capsule()
                    .stroke(Color.troskiBorder, lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.6 : 1.0)
    }
}
