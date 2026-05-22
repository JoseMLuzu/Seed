import SwiftUI
import WidgetKit

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

@main
struct SeedWidgetBundle: WidgetBundle {
    var body: some Widget {
        SeedTodayWidget()
    }
}
