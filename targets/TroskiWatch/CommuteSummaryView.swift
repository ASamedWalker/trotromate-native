import SwiftUI

/// Commute summary glance card — "Your morning commute" with smart leave-by suggestion.
struct CommuteSummaryView: View {
    let commute: CommuteData

    var body: some View {
        ZStack {
            Color.troskiBackground.ignoresSafeArea()

            // Kinetic glow
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

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    // Brand
                    Text("TROSKI")
                        .font(.troskiBrand)
                        .tracking(2.5)
                        .foregroundColor(.troskiAmber)
                        .padding(.bottom, 6)

                    // Greeting
                    Text(greetingLabel)
                        .font(.troskiDetail)
                        .foregroundColor(.troskiMuted)
                        .padding(.bottom, 2)

                    // Route
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
                    .padding(.bottom, 6)

                    // Fare
                    Text("GH₵\(String(format: "%.2f", commute.fare))")
                        .font(.troskiFare)
                        .foregroundColor(.troskiAmber)
                        .padding(.bottom, 8)

                    // Smart leave-by suggestion
                    HStack(spacing: 6) {
                        Image(systemName: "clock.badge.checkmark.fill")
                            .font(.system(size: 14))
                            .foregroundColor(.troskiMint)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Leave by \(suggestedLeaveTime)")
                                .font(.troskiBody)
                                .foregroundColor(.white)
                            Text(leaveReason)
                                .font(.troskiCaption)
                                .foregroundColor(.troskiMuted)
                        }
                    }
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.troskiMint.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .padding(.bottom, 8)

                    // Queue status
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
                    .padding(.bottom, 4)

                    Text("Updated \(commute.relativeTime)")
                        .font(.troskiCaption)
                        .foregroundColor(.troskiMuted)
                }
                .padding(12)
            }
        }
    }

    // MARK: - Smart suggestions

    private var greetingLabel: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 { return "Your morning commute" }
        if hour < 17 { return "Your afternoon commute" }
        return "Your evening commute"
    }

    /// Suggests a leave time based on current queue status and wait time.
    private var suggestedLeaveTime: String {
        let now = Date()
        let calendar = Calendar.current

        // Parse wait minutes from waitTime string (e.g. "25 min")
        let waitMinutes = parseMinutes(from: commute.waitTime)

        // Add buffer based on queue status
        let buffer: Int
        switch commute.queueStatus {
        case .short:    buffer = 5
        case .moderate: buffer = 10
        case .long:     buffer = 15
        case .veryLong: buffer = 25
        }

        // Suggest leaving waitMinutes + buffer from now, rounded to nearest 5
        let totalMinutes = waitMinutes + buffer
        guard let leaveDate = calendar.date(byAdding: .minute, value: -totalMinutes, to: suggestedArrival(from: now)) else {
            return "6:45 AM"
        }

        let rounded = roundToNearestFive(leaveDate)
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: rounded)
    }

    private var leaveReason: String {
        switch commute.queueStatus {
        case .short:    return "Queue is short — smooth ride"
        case .moderate: return "Moderate queue — leave a bit early"
        case .long:     return "Long queue — allow extra time"
        case .veryLong: return "Very long queue — leave ASAP"
        }
    }

    private func suggestedArrival(from now: Date) -> Date {
        let calendar = Calendar.current
        let hour = calendar.component(.hour, from: now)

        // Target arrival: 8 AM for morning, 6 PM for evening
        if hour < 12 {
            return calendar.date(bySettingHour: 8, minute: 0, second: 0, of: now) ?? now
        } else {
            return calendar.date(bySettingHour: 18, minute: 0, second: 0, of: now) ?? now
        }
    }

    private func parseMinutes(from text: String) -> Int {
        let digits = text.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
        return Int(digits) ?? 15
    }

    private func roundToNearestFive(_ date: Date) -> Date {
        let calendar = Calendar.current
        let minute = calendar.component(.minute, from: date)
        let rounded = (minute / 5) * 5
        return calendar.date(bySetting: .minute, value: rounded, of: date) ?? date
    }
}

#Preview {
    CommuteSummaryView(commute: CommuteData(
        from: "Circle",
        to: "Madina",
        fare: 8.50,
        queueStatus: .long,
        waitTime: "25 min"
    ))
}
