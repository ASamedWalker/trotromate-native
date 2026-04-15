import Foundation

// MARK: - Commute

struct CommuteData: Identifiable, Codable {
    let id: UUID
    var from: String
    var to: String
    var fare: Double
    var queueStatus: QueueStatus
    var waitTime: String
    var lastUpdated: Date

    init(
        id: UUID = UUID(),
        from: String,
        to: String,
        fare: Double,
        queueStatus: QueueStatus,
        waitTime: String,
        lastUpdated: Date = Date()
    ) {
        self.id = id
        self.from = from
        self.to = to
        self.fare = fare
        self.queueStatus = queueStatus
        self.waitTime = waitTime
        self.lastUpdated = lastUpdated
    }

    var relativeTime: String {
        let diff = Int(Date().timeIntervalSince(lastUpdated) / 60)
        if diff < 1 { return "just now" }
        if diff == 1 { return "1 min ago" }
        return "\(diff) min ago"
    }
}

// MARK: - Queue Status

enum QueueStatus: String, Codable, Equatable {
    case short
    case moderate
    case long
    case veryLong = "veryLong"

    var label: String {
        switch self {
        case .short:    return "Short Queue"
        case .moderate: return "Moderate"
        case .long:     return "Long Queue"
        case .veryLong: return "Very Long Queue"
        }
    }
}

// MARK: - Station

struct Station: Identifiable, Codable {
    let id: UUID
    var name: String
    var queueStatus: QueueStatus
    var waitTime: String
    var fare: Double

    init(
        id: UUID = UUID(),
        name: String,
        queueStatus: QueueStatus,
        waitTime: String,
        fare: Double
    ) {
        self.id = id
        self.name = name
        self.queueStatus = queueStatus
        self.waitTime = waitTime
        self.fare = fare
    }
}

// MARK: - Alert

struct WatchAlert: Equatable {
    var station: String
    var queueStatus: QueueStatus
    var alternative: String
}

// MARK: - WatchConnectivity dict init

extension CommuteData {
    init?(from dict: [String: Any]) {
        guard
            let from = dict["from"] as? String,
            let to = dict["to"] as? String,
            let fare = dict["fare"] as? Double,
            let queueStatusRaw = dict["queueStatus"] as? String,
            let queueStatus = QueueStatus(rawValue: queueStatusRaw),
            let waitTime = dict["waitTime"] as? String
        else { return nil }

        self.id = UUID()
        self.from = from
        self.to = to
        self.fare = fare
        self.queueStatus = queueStatus
        self.waitTime = waitTime

        if let iso = dict["lastUpdated"] as? String,
           let date = ISO8601DateFormatter().date(from: iso) {
            self.lastUpdated = date
        } else {
            self.lastUpdated = Date()
        }
    }
}

extension Station {
    init?(from dict: [String: Any]) {
        guard
            let name = dict["name"] as? String,
            let queueStatusRaw = dict["queueStatus"] as? String,
            let queueStatus = QueueStatus(rawValue: queueStatusRaw),
            let waitTime = dict["waitTime"] as? String,
            let fare = dict["fare"] as? Double
        else { return nil }

        self.id = UUID()
        self.name = name
        self.queueStatus = queueStatus
        self.waitTime = waitTime
        self.fare = fare
    }
}

extension WatchAlert {
    init?(from dict: [String: Any]) {
        guard
            let station = dict["station"] as? String,
            let queueStatusRaw = dict["queueStatus"] as? String,
            let queueStatus = QueueStatus(rawValue: queueStatusRaw),
            let alternative = dict["alternative"] as? String
        else { return nil }

        self.station = station
        self.queueStatus = queueStatus
        self.alternative = alternative
    }
}
