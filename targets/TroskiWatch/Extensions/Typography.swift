import SwiftUI

/// Centralized typography matching DESIGN.md specs.
/// watchOS auto-uses SF Compact (tighter letterforms for small screens).
extension Font {
    /// Brand header — "TROSKI" (10px, black weight, wide tracking)
    static let troskiBrand = Font.system(size: 10, weight: .black)

    /// Screen headline — route names, station names (14px, bold)
    static let troskiHeadline = Font.system(size: 14, weight: .bold)

    /// Alert/card headline (13px, bold)
    static let troskiSubheadline = Font.system(size: 13, weight: .bold)

    /// Large number — fare display (22px, black)
    static let troskiFare = Font.system(size: 22, weight: .black)

    /// Body — status text, descriptions (11px, semibold)
    static let troskiBody = Font.system(size: 11, weight: .semibold)

    /// Detail — wait time, secondary info (10px, medium)
    static let troskiDetail = Font.system(size: 10, weight: .medium)

    /// Caption — timestamps, labels (9px, regular)
    static let troskiCaption = Font.system(size: 9)

    /// Tiny — pill labels, subtitles (8px, medium)
    static let troskiTiny = Font.system(size: 8, weight: .medium)
}
