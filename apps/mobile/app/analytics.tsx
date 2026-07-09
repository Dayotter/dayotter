import { api } from "@/api";
import { EmptyState, ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import type { Analytics } from "@/models";
import { colors, radius } from "@/theme";
import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const RANGES = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

function money(cents: number, currency: string | null): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency ?? "usd").toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function pct(n: number): string {
  return `${(n * 100).toFixed(n >= 0.1 ? 0 : 1)}%`;
}

export default function AnalyticsScreen() {
  const [days, setDays] = useState(30);
  const { data, loading, error } = useAsync<Analytics>(async () => {
    const res = await api.get<{ analytics: Analytics }>(`/api/analytics?days=${days}`);
    return res.analytics;
  }, [days]);

  const t = data?.totals;
  const hasData = !!t && (t.views > 0 || t.bookings > 0);
  const funnelMax = t ? Math.max(1, t.uniqueVisitors) : 1;

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Analytics" }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.range}>
          {RANGES.map((r) => (
            <Pressable
              key={r.days}
              onPress={() => setDays(r.days)}
              style={[styles.rangeBtn, r.days === days && styles.rangeBtnOn]}
            >
              <Text style={[styles.rangeText, r.days === days && styles.rangeTextOn]}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorText message={error} />
        ) : !hasData ? (
          <EmptyState
            title="No booking activity yet"
            body="Once people view and book your event pages, conversion shows up here."
          />
        ) : (
          <>
            <View style={styles.stats}>
              <Stat label="Views" value={String(t.views)} />
              <Stat label="Visitors" value={String(t.uniqueVisitors)} />
              <Stat label="Bookings" value={String(t.confirmed)} />
              <Stat label="Conversion" value={pct(t.conversionRate)} />
            </View>

            {t.revenueCents > 0 ? (
              <View style={styles.revenue}>
                <Text style={styles.revenueLabel}>Revenue collected</Text>
                <Text style={styles.revenueValue}>{money(t.revenueCents, data.currency)}</Text>
              </View>
            ) : null}

            <Text style={styles.section}>Funnel</Text>
            <View style={styles.card}>
              <Bar label="Visitors" value={t.uniqueVisitors} max={funnelMax} />
              <Bar label="Bookings made" value={t.bookings} max={funnelMax} />
              <Bar label="Confirmed" value={t.confirmed} max={funnelMax} />
              <Bar label="Completed" value={t.completed} max={funnelMax} muted />
              <Text style={styles.subtle}>
                Cancelled: {t.cancelled}   No-shows: {t.noShow}
              </Text>
            </View>

            <Text style={styles.section}>By event type</Text>
            {data.byEventType.map((r) => (
              <View key={r.eventTypeId} style={styles.typeRow}>
                <View style={styles.typeHead}>
                  {r.color ? <View style={[styles.dot, { backgroundColor: r.color }]} /> : null}
                  <Text style={styles.typeTitle}>{r.title}</Text>
                  <Text style={styles.typeConv}>{pct(r.conversionRate)}</Text>
                </View>
                <Text style={styles.typeMeta}>
                  {r.views} views · {r.uniqueVisitors} visitors · {r.confirmed} booked
                  {r.revenueCents > 0 ? ` · ${money(r.revenueCents, r.currency)}` : ""}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function Bar({
  label,
  value,
  max,
  muted,
}: { label: string; value: number; max: number; muted?: boolean }) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={styles.barTop}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{value}</Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${width}%`, backgroundColor: muted ? colors.borderStrong : colors.accent },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20 },
  range: { flexDirection: "row", gap: 8, marginBottom: 16 },
  rangeBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  rangeBtnOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  rangeText: { color: colors.muted, fontWeight: "500" },
  rangeTextOn: { color: colors.text, fontWeight: "600" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
  },
  statLabel: { color: colors.muted, fontSize: 12 },
  statValue: { color: colors.text, fontSize: 24, fontWeight: "700", marginTop: 2 },
  revenue: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 16,
  },
  revenueLabel: { color: colors.muted },
  revenueValue: { color: colors.text, fontSize: 18, fontWeight: "700" },
  section: { marginTop: 22, marginBottom: 10, fontWeight: "600", color: colors.muted },
  card: { backgroundColor: colors.surface2, borderRadius: radius.lg, padding: 16 },
  barTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  barLabel: { color: colors.muted, fontSize: 12 },
  barValue: { color: colors.text, fontSize: 12, fontWeight: "600" },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: colors.bg, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 999 },
  subtle: { color: colors.faint, fontSize: 12, marginTop: 6 },
  typeRow: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  typeHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 999 },
  typeTitle: { flex: 1, color: colors.text, fontWeight: "600" },
  typeConv: { color: colors.text, fontWeight: "700" },
  typeMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
});
