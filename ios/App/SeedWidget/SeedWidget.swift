import SwiftUI
import WidgetKit
import ActivityKit

@available(iOS 16.1, *)
struct SeedFocusActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var title: String
        var subtitle: String
        var endDate: Date
        var progress: Double
    }

    var noteId: String
    var title: String
}

struct SeedWidgetEntry: TimelineEntry {
    let date: Date
    let summary: SeedWidgetSummary
}

struct SeedWidgetSummary: Codable {
    var title: String
    var subtitle: String
    var action: String
    var metric: String
    var seeds: Int
    var sprouts: Int
    var harvests: Int
    var watering: Int
    var streak: Int
    var updatedAt: Double

    static let placeholder = SeedWidgetSummary(
        title: "Planta una semilla",
        subtitle: "Una cosa clara para hoy",
        action: "Plantar",
        metric: "0",
        seeds: 0,
        sprouts: 0,
        harvests: 0,
        watering: 0,
        streak: 0,
        updatedAt: Date().timeIntervalSince1970 * 1000
    )
}

struct SeedWidgetProvider: TimelineProvider {
    private let suiteName = "group.seedapp.com.ec"
    private let summaryKey = "seed-widget-summary"

    func placeholder(in context: Context) -> SeedWidgetEntry {
        SeedWidgetEntry(date: Date(), summary: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (SeedWidgetEntry) -> Void) {
        completion(SeedWidgetEntry(date: Date(), summary: readSummary()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SeedWidgetEntry>) -> Void) {
        let entry = SeedWidgetEntry(date: Date(), summary: readSummary())
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }

    private func readSummary() -> SeedWidgetSummary {
        let defaults = UserDefaults(suiteName: suiteName) ?? .standard
        guard
            let json = defaults.string(forKey: summaryKey),
            let data = json.data(using: .utf8),
            let summary = try? JSONDecoder().decode(SeedWidgetSummary.self, from: data)
        else {
            return .placeholder
        }
        return summary
    }
}

struct SeedWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SeedWidgetEntry

    private let seedURL = URL(string: "seed://new-seed")!
    private let todayURL = URL(string: "seed://today")!

    var body: some View {
        Link(destination: family == .systemSmall ? seedURL : todayURL) {
            switch family {
            case .systemSmall:
                smallWidget
            default:
                mediumWidget
            }
        }
        .widgetURL(family == .systemSmall ? seedURL : todayURL)
    }

    private var smallWidget: some View {
        ZStack {
            background
            VStack(alignment: .leading, spacing: 10) {
                seedMark
                Spacer(minLength: 0)
                Text(entry.summary.action)
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundStyle(Color(red: 0.29, green: 0.45, blue: 0.33))
                    .textCase(.uppercase)
                Text(entry.summary.title)
                    .font(.system(size: 18, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color(red: 0.14, green: 0.18, blue: 0.14))
                    .lineLimit(2)
                Text(entry.summary.subtitle)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(Color(red: 0.34, green: 0.39, blue: 0.34))
                    .lineLimit(2)
            }
            .padding(16)
        }
        .containerBackground(for: .widget) {
            Color(red: 0.95, green: 0.96, blue: 0.94)
        }
    }

    private var mediumWidget: some View {
        ZStack {
            background
            HStack(spacing: 16) {
                seedMark
                    .frame(width: 56, height: 56)
                VStack(alignment: .leading, spacing: 6) {
                    Text("Seeds Hoy")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundStyle(Color(red: 0.29, green: 0.45, blue: 0.33))
                    Text(entry.summary.title)
                        .font(.system(size: 18, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color(red: 0.14, green: 0.18, blue: 0.14))
                        .lineLimit(2)
                    Text(entry.summary.subtitle)
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundStyle(Color(red: 0.34, green: 0.39, blue: 0.34))
                        .lineLimit(1)
                    HStack(spacing: 8) {
                        metricPill("\(entry.summary.watering)", "Riego")
                        metricPill("\(entry.summary.sprouts)", "Brotes")
                        metricPill("\(entry.summary.harvests)", "Cosechas")
                    }
                    .padding(.top, 2)
                }
                Spacer(minLength: 0)
            }
            .padding(18)
        }
        .containerBackground(for: .widget) {
            Color(red: 0.95, green: 0.96, blue: 0.94)
        }
    }

    private var seedMark: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white.opacity(0.72))
                .shadow(color: Color.black.opacity(0.08), radius: 12, y: 6)
            Image(systemName: "leaf")
                .font(.system(size: 26, weight: .semibold))
                .foregroundStyle(Color(red: 0.29, green: 0.45, blue: 0.33))
        }
        .frame(width: 52, height: 52)
    }

    private func metricPill(_ value: String, _ label: String) -> some View {
        HStack(spacing: 4) {
            Text(value)
                .font(.system(size: 12, weight: .bold, design: .rounded))
            Text(label)
                .font(.system(size: 9, weight: .bold, design: .rounded))
                .foregroundStyle(Color(red: 0.34, green: 0.39, blue: 0.34))
        }
        .foregroundStyle(Color(red: 0.14, green: 0.18, blue: 0.14))
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(Color.white.opacity(0.58), in: Capsule())
    }

    private var background: some View {
        LinearGradient(
            colors: [
                Color(red: 0.96, green: 0.97, blue: 0.95),
                Color(red: 0.84, green: 0.89, blue: 0.79)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .overlay(alignment: .topTrailing) {
            Circle()
                .fill(Color.white.opacity(0.38))
                .frame(width: 130, height: 130)
                .blur(radius: 18)
                .offset(x: 42, y: -54)
        }
    }
}

struct SeedTodayWidget: Widget {
    let kind = "SeedTodayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SeedWidgetProvider()) { entry in
            SeedWidgetView(entry: entry)
        }
        .configurationDisplayName("Seeds Hoy")
        .description("Captura una idea y vuelve a lo importante.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@available(iOS 16.1, *)
struct SeedFocusLiveActivityWidget: Widget {
    private let islandPrimary = Color.white
    private let islandSecondary = Color.white.opacity(0.72)
    private let islandAccent = Color(red: 0.70, green: 0.91, blue: 0.70)
    private let lockPrimary = Color(red: 0.14, green: 0.18, blue: 0.14)
    private let lockSecondary = Color(red: 0.34, green: 0.39, blue: 0.34)
    private let lockAccent = Color(red: 0.31, green: 0.45, blue: 0.34)

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SeedFocusActivityAttributes.self) { context in
            lockScreenView(context: context)
                .activityBackgroundTint(Color(red: 0.94, green: 0.96, blue: 0.93))
                .activitySystemActionForegroundColor(lockPrimary)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(alignment: .center, spacing: 8) {
                        Image(systemName: "leaf.fill")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(islandAccent)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Seeds Focus")
                                .font(.system(size: 11, weight: .bold, design: .rounded))
                                .foregroundStyle(islandAccent)
                            Text(context.state.title)
                                .font(.system(size: 14, weight: .semibold, design: .rounded))
                                .foregroundStyle(islandPrimary)
                                .lineLimit(1)
                        }
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("Restante")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundStyle(islandSecondary)
                        timerText(endDate: context.state.endDate)
                            .font(.system(size: 15, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(islandPrimary)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.subtitle)
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundStyle(islandSecondary)
                        .lineLimit(1)
                }
            } compactLeading: {
                Image(systemName: "leaf.fill")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(islandAccent)
            } compactTrailing: {
                timerText(endDate: context.state.endDate)
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(islandPrimary)
                    .frame(width: 42)
            } minimal: {
                Image(systemName: "leaf.fill")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(islandAccent)
            }.keylineTint(islandAccent)
        }
    }

    private func lockScreenView(context: ActivityViewContext<SeedFocusActivityAttributes>) -> some View {
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.white.opacity(0.75))
                .frame(width: 46, height: 46)
                .overlay {
                    Image(systemName: "leaf.fill")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(lockAccent)
                }

            VStack(alignment: .leading, spacing: 4) {
                Text(context.state.title)
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                    .foregroundStyle(lockPrimary)
                    .lineLimit(1)
                Text(context.state.subtitle)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundStyle(lockSecondary)
                    .lineLimit(1)
                timerText(endDate: context.state.endDate)
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(lockPrimary)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }

    private func timerText(endDate: Date) -> Text {
        Text(timerInterval: Date.now...endDate, countsDown: true)
    }
}

@main
struct SeedWidgetBundle: WidgetBundle {
    var body: some Widget {
        SeedTodayWidget()
        if #available(iOS 16.1, *) {
            SeedFocusLiveActivityWidget()
        }
    }
}
