import SwiftUI

/// Root view — swipeable pages: Commute Summary → Station List.
/// Alert sheet floats on top when an active alert arrives.
struct ContentView: View {
    @ObservedObject private var connector = WatchConnector.shared
    @State private var showAlert = false

    var body: some View {
        Group {
            if let commute = connector.commute {
                TabView {
                    CommuteSummaryView(commute: commute)
                    StationListView()
                }
                .tabViewStyle(.page)
                .background(Color.troskiBackground)
            } else {
                emptyState
            }
        }
        .fullScreenCover(isPresented: $showAlert) {
            if let alert = connector.activeAlert {
                AlertView(
                    alert: alert,
                    onNavigate: {
                        showAlert = false
                        connector.activeAlert = nil
                    },
                    onDismiss: {
                        showAlert = false
                        connector.activeAlert = nil
                    }
                )
            }
        }
        .onAppear {
            if connector.activeAlert != nil {
                showAlert = true
            }
        }
        .onChange(of: connector.activeAlert != nil) { hasAlert in
            showAlert = hasAlert
        }
    }

    private var emptyState: some View {
        ZStack {
            Color.troskiBackground.ignoresSafeArea()
            VStack(spacing: 8) {
                Image(systemName: "tram.fill")
                    .font(.system(size: 26))
                    .foregroundColor(.troskiAmber.opacity(0.5))
                Text("Waiting for\ncommute data")
                    .font(.system(size: 12))
                    .multilineTextAlignment(.center)
                    .foregroundColor(.troskiMuted)
            }
        }
    }
}

#Preview {
    ContentView()
}
