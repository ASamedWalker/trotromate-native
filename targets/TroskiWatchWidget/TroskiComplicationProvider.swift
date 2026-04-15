import WidgetKit
import SwiftUI

// MARK: - Timeline Entry

struct TroskiEntry: TimelineEntry {
    let date: Date
    let data: SharedCommuteData
}

// MARK: - Timeline Provider

struct TroskiTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> TroskiEntry {
        TroskiEntry(date: Date(), data: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (TroskiEntry) -> Void) {
        let data = SharedCommuteData.load() ?? .placeholder
        completion(TroskiEntry(date: Date(), data: data))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TroskiEntry>) -> Void) {
        let data = SharedCommuteData.load() ?? .placeholder
        let entry = TroskiEntry(date: Date(), data: data)
        // Refresh every 30 min (~2 updates/hour, within watchOS budget)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}
