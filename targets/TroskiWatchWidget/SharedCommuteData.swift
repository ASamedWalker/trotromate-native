import SwiftUI

/// Reads commute data from the shared App Group UserDefaults.
/// Both the Watch app and the widget extension share "group.com.troski.app".
struct SharedCommuteData {
    let from: String
    let to: String
    let fare: Double
    let queueStatus: String
    let waitTime: String
    let lastUpdated: Date

    var route: String { "\(from)→\(to)" }
    var fareFormatted: String { "GH₵\(String(format: "%.2f", fare))" }
    var fareShort: String { "₵\(String(format: "%.2f", fare))" }

    var queueColor: Color {
        switch queueStatus {
        case "short":    return Color(hex: "#22c55e")
        case "moderate": return Color(hex: "#f59e0b")
        case "long":     return Color(hex: "#f97316")
        case "veryLong": return Color(hex: "#ef4444")
        default:         return Color(hex: "#afaaa8")
        }
    }

    static let placeholder = SharedCommuteData(
        from: "Circle",
        to: "Madina",
        fare: 8.50,
        queueStatus: "short",
        waitTime: "5 min",
        lastUpdated: Date()
    )

    /// Load from shared App Group UserDefaults.
    static func load() -> SharedCommuteData? {
        guard let defaults = UserDefaults(suiteName: "group.com.troski.app"),
              let from = defaults.string(forKey: "commute_from"),
              let to = defaults.string(forKey: "commute_to"),
              let queueStatus = defaults.string(forKey: "commute_queueStatus"),
              let waitTime = defaults.string(forKey: "commute_waitTime")
        else { return nil }

        let fare = defaults.double(forKey: "commute_fare")
        let ts = defaults.double(forKey: "commute_lastUpdated")
        let lastUpdated = ts > 0 ? Date(timeIntervalSince1970: ts) : Date()

        return SharedCommuteData(
            from: from,
            to: to,
            fare: fare,
            queueStatus: queueStatus,
            waitTime: waitTime,
            lastUpdated: lastUpdated
        )
    }
}

// MARK: - Hex Color (standalone for widget target)

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8) & 0xFF) / 255
        let b = Double(int & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b)
    }

    static let troskiAmber = Color(hex: "#ffad3a")
    static let troskiMuted = Color(hex: "#afaaa8")
}
