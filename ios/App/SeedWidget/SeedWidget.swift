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
}

struct SeedWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> SeedWidgetEntry {
        SeedWidgetEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (SeedWidgetEntry) -> Void) {
        completion(SeedWidgetEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SeedWidgetEntry>) -> Void) {
        let entry = SeedWidgetEntry(date: Date())
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}

struct SeedWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SeedWidgetEntry

    private let seedURL = URL(string: "seed://new-seed")!

    var body: some View {
        Link(destination: seedURL) {
            switch family {
            case .systemSmall:
                smallWidget
            default:
                mediumWidget
            }
        }
        .widgetURL(seedURL)
    }

    private var smallWidget: some View {
        ZStack {
            background
            VStack(alignment: .leading, spacing: 10) {
                seedMark
                Spacer(minLength: 0)
                Text("Planta una semilla")
                    .font(.system(size: 18, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color(red: 0.14, green: 0.18, blue: 0.14))
                    .lineLimit(2)
                Text("Captura ahora. Decide despues.")
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
                    Text("Seed Hoy")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundStyle(Color(red: 0.29, green: 0.45, blue: 0.33))
                    Text("Una idea puede empezar con una frase.")
                        .font(.system(size: 18, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color(red: 0.14, green: 0.18, blue: 0.14))
                        .lineLimit(2)
                    Text("Toca para plantar una nueva semilla.")
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundStyle(Color(red: 0.34, green: 0.39, blue: 0.34))
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
        .configurationDisplayName("Seed Hoy")
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
                            Text("Seed Focus")
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
