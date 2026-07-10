import { api } from "@/api";
import { EmptyState, ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import { type Insights, eventColorHex } from "@/models";
import { colors, radius } from "@/theme";
import { Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtHours(min: number): string {
  const h = min / 60;
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}

export default function InsightsScreen() {
  const { data, loading, error } = useAsync<Insights>(async () => {
    const res = await api.get<{ insights: Insights }>("/api/insights");
    return res.insights;
  });

  const hasData =
    !!data && (data.upcomingCount > 0 || data.thisWeek > 0 || data.weekday.some((n) => n > 0));

  const maxWeekday = data ? Math.max(1, ...data.weekday) : 1;
  const maxType = data ? Math.max(1, ...data.byType.map((t) => t.minutes)) : 1;
  const ringMax = data ? Math.max(data.avgPerWeek, data.thisWeek, 1) : 1;

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Insights" }} />
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorText message={error} />
      ) : !hasData || !data ? (
        <EmptyState
          title="No meetings yet"
          body="Once people start booking, your time insights show up here."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.intro}>Where your scheduling time goes — the last 30 days.</Text>

          <View style={styles.stats}>
            <Stat value={String(data.upcomingCount)} label="Upcoming" sub="next 30 days" />
            <Stat value={fmtHours(data.bookedMinutes)} label="Booked" sub="last 30 days" />
            <Stat
              value={data.busiestWeekday !== null ? WEEKDAYS[data.busiestWeekday]! : "—"}
              label="Busiest day"
              sub="last 30 days"
            />
            <Stat value={String(data.avgPerWeek)} label="Per week" sub="30-day avg" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>This week</Text>
            <View style={styles.ringRow}>
              <Text style={styles.bigNum}>{data.thisWeek}</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${(data.thisWeek / ringMax) * 100}%`,
                        backgroundColor: colors.accent,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.sub}>
                  {data.avgPerWeek > 0
                    ? `Your weekly average is ${data.avgPerWeek}.`
                    : "Building your weekly average."}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Meetings by weekday</Text>
            <View style={styles.bars}>
              {data.weekday.map((count, i) => (
                <View key={WEEKDAYS[i]} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View
                      style={{
                        width: "100%",
                        height: `${(count / maxWeekday) * 100}%`,
                        minHeight: count ? 4 : 0,
                        backgroundColor: colors.accent,
                        borderTopLeftRadius: 3,
                        borderTopRightRadius: 3,
                      }}
                    />
                  </View>
                  <Text style={styles.barLabel}>{WEEKDAYS[i]}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Time by event type</Text>
            {data.byType.length === 0 ? (
              <Text style={styles.sub}>No completed meetings yet.</Text>
            ) : (
              data.byType.map((t) => (
                <View key={t.title} style={{ marginTop: 12 }}>
                  <View style={styles.typeRow}>
                    <View style={styles.typeLeft}>
                      <View style={[styles.dot, { backgroundColor: eventColorHex(t.color) }]} />
                      <Text style={styles.typeTitle} numberOfLines={1}>
                        {t.title}
                      </Text>
                    </View>
                    <Text style={styles.typeMin}>{fmtHours(t.minutes)}</Text>
                  </View>
                  <View style={styles.track}>
                    <View
                      style={{
                        height: "100%",
                        width: `${(t.minutes / maxType) * 100}%`,
                        backgroundColor: eventColorHex(t.color),
                        borderRadius: 999,
                      }}
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Stat({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  intro: { color: colors.muted, fontSize: 14, marginBottom: 16 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 },
  stat: {
    width: "47%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    backgroundColor: colors.surface,
  },
  statValue: { fontSize: 22, fontWeight: "700", color: colors.text },
  statLabel: { fontSize: 13, color: colors.muted, marginTop: 2 },
  statSub: { fontSize: 11, color: colors.faint, marginTop: 1 },
  card: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    backgroundColor: colors.surface,
  },
  cardTitle: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 12 },
  ringRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  bigNum: { fontSize: 40, fontWeight: "700", color: colors.accent, width: 64, textAlign: "center" },
  track: { height: 8, borderRadius: 999, backgroundColor: colors.surface2, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999 },
  sub: { color: colors.muted, fontSize: 12, marginTop: 8 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 140 },
  barCol: { flex: 1, alignItems: "center", gap: 6, height: "100%" },
  barTrack: { flex: 1, width: "100%", justifyContent: "flex-end" },
  barLabel: { fontSize: 11, color: colors.faint },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  typeLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 999 },
  typeTitle: { fontSize: 14, color: colors.text, flexShrink: 1 },
  typeMin: { fontSize: 13, color: colors.muted },
});
