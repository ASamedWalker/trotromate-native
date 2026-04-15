import Foundation
import WatchConnectivity

class WatchConnector: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchConnector()

    @Published var commute: CommuteData?
    @Published var stations: [Station] = []
    @Published var activeAlert: WatchAlert?

    private override init() {
        super.init()
        activateSession()

        #if DEBUG
        // Load mock data for simulator testing
        loadMockData()
        #endif
    }

    #if DEBUG
    private func loadMockData() {
        self.commute = CommuteData(
            from: "Circle",
            to: "Madina",
            fare: 8.50,
            queueStatus: .long,
            waitTime: "25 min"
        )
        self.stations = [
            Station(name: "Circle", queueStatus: .long, waitTime: "25 min", fare: 8.50),
            Station(name: "Kaneshie", queueStatus: .short, waitTime: "5 min", fare: 7.00),
            Station(name: "Lapaz", queueStatus: .moderate, waitTime: "12 min", fare: 6.50),
            Station(name: "Achimota", queueStatus: .veryLong, waitTime: "40 min", fare: 9.00),
            Station(name: "Tema Station", queueStatus: .short, waitTime: "3 min", fare: 12.00, isDistant: true),
        ]
        self.activeAlert = WatchAlert(
            station: "Circle",
            queueStatus: .veryLong,
            alternative: "Kaneshie"
        )
    }
    #endif

    private func activateSession() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    // MARK: - WCSessionDelegate

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if let error {
            print("[WatchConnector] Activation error: \(error.localizedDescription)")
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleIncomingMessage(message)
    }

    func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        handleIncomingMessage(message)
        replyHandler(["status": "received"])
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        handleIncomingMessage(applicationContext)
    }

    // MARK: - Parsing

    private func handleIncomingMessage(_ message: [String: Any]) {
        // Commute data
        if let commuteDict = message["commute"] as? [String: Any],
           let data = CommuteData(from: commuteDict) {
            DispatchQueue.main.async { self.commute = data }
        }

        // Station list
        if let stationDicts = message["stations"] as? [[String: Any]] {
            let parsed = stationDicts.compactMap { Station(from: $0) }
            DispatchQueue.main.async { self.stations = parsed }
        }

        // Alert
        if let alertDict = message["alert"] as? [String: Any],
           let alert = WatchAlert(from: alertDict) {
            DispatchQueue.main.async { self.activeAlert = alert }
        }

        // Clear alert
        if let clearAlert = message["clearAlert"] as? Bool, clearAlert {
            DispatchQueue.main.async { self.activeAlert = nil }
        }
    }
}
