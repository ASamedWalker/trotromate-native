import SwiftUI

extension Color {
    // MARK: - Brand palette
    static let troskiBackground = Color(hex: "#100e0d")
    static let troskiAmber      = Color(hex: "#ffad3a")
    static let troskiRed        = Color(hex: "#ff716a")
    static let troskiMint       = Color(hex: "#9bffce")
    static let troskiMuted      = Color(hex: "#afaaa8")
    static let troskiBorder     = Color(hex: "#4b4746")

    // MARK: - Queue status
    static let queueShort     = Color(hex: "#22c55e")
    static let queueModerate  = Color(hex: "#f59e0b")
    static let queueLong      = Color(hex: "#f97316")
    static let queueVeryLong  = Color(hex: "#ef4444")

    // MARK: - Hex initializer
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:  (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:  (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:  (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default: (a, r, g, b) = (255, 255, 255, 255)
        }
        self.init(.sRGB,
                  red: Double(r) / 255,
                  green: Double(g) / 255,
                  blue: Double(b) / 255,
                  opacity: Double(a) / 255)
    }
}

// MARK: - QueueStatus color helper
extension QueueStatus {
    var swiftUIColor: Color {
        switch self {
        case .short:    return .queueShort
        case .moderate: return .queueModerate
        case .long:     return .queueLong
        case .veryLong: return .queueVeryLong
        }
    }
}
