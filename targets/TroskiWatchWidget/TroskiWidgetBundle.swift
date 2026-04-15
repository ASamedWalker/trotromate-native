import SwiftUI
import WidgetKit

@main
struct TroskiWidgetBundle: WidgetBundle {
    var body: some Widget {
        TroskiCircularWidget()
        TroskiModularWidget()
        TroskiCornerWidget()
    }
}
