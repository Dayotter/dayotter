import { api } from "@/api";
import { Badge, Card, EmptyState, ErrorText, Loading } from "@/components/ui";
import { formatDay, formatTime } from "@/format";
import { useAsync } from "@/hooks";
import { type Booking, type RangeBooking, eventColorHex } from "@/models";
import { colors, radius, statusColor } from "@/theme";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const WK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

type CalTab = "agenda" | "month" | "history";
const VIEWS: CalTab[] = ["agenda", "month", "history"];

export default function BookingsScreen() {
  const [view, setView] = useState<CalTab>("agenda");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Text style={styles.header}>Bookings</Text>
      <View style={styles.tabs}>
        {VIEWS.map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            style={[styles.tab, v === view && styles.tabOn]}
          >
            <Text style={[styles.tabText, v === view && styles.tabTextOn]}>{v}</Text>
          </Pressable>
        ))}
      </View>
      {view === "history" ? <History /> : <Calendar view={view} />}
    </SafeAreaView>
  );
}

function Calendar({ view }: { view: "agenda" | "month" }) {
  const router = useRouter();
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [bookings, setBookings] = useState<RangeBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === "month") {
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const gs = addDays(startOfDay(first), -first.getDay());
      return { rangeStart: gs, rangeEnd: addDays(gs, 42) };
    }
    const s = startOfDay(new Date());
    return { rangeStart: s, rangeEnd: addDays(s, 30) };
  }, [view, anchor]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const qs = `start=${rangeStart.toISOString()}&end=${rangeEnd.toISOString()}`;
    api
      .get<{ bookings: RangeBooking[] }>(`/api/bookings/range?${qs}`)
      .then((d) => active && setBookings(d.bookings))
      .catch(() => active && setBookings([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [rangeStart, rangeEnd]);

  const byDay = useMemo(() => {
    const m = new Map<string, RangeBooking[]>();
    for (const b of bookings) {
      const k = dayKey(new Date(b.startsAt));
      (m.get(k) ?? m.set(k, []).get(k)!).push(b);
    }
    return m;
  }, [bookings]);

  if (loading && bookings.length === 0) return <Loading />;

  if (view === "agenda") {
    const days: Date[] = [];
    for (let d = rangeStart; d < rangeEnd; d = addDays(d, 1)) {
      if ((byDay.get(dayKey(d)) ?? []).length > 0) days.push(new Date(d));
    }
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        {days.length === 0 ? (
          <EmptyState title="Nothing coming up" body="Bookings in the next 30 days appear here." />
        ) : (
          days.map((d) => (
            <View key={dayKey(d)} style={styles.agendaDay}>
              <Text style={styles.agendaDate}>
                {WK[d.getDay()]}, {MO[d.getMonth()]} {d.getDate()}
              </Text>
              {(byDay.get(dayKey(d)) ?? []).map((b) => (
                <EventRow key={b.uid} b={b} onPress={() => router.push(`/booking/${b.uid}`)} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    );
  }

  // Month
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = addDays(startOfDay(first), -first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const todayKey = dayKey(new Date());
  const selectedEvents = byDay.get(dayKey(selected)) ?? [];

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.monthNav}>
        <Pressable
          onPress={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
          hitSlop={10}
        >
          <Text style={styles.navArrow}>‹</Text>
        </Pressable>
        <Text style={styles.monthTitle}>
          {MO[anchor.getMonth()]} {anchor.getFullYear()}
        </Text>
        <Pressable
          onPress={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
          hitSlop={10}
        >
          <Text style={styles.navArrow}>›</Text>
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {WK.map((w) => (
          <Text key={w} style={styles.weekLabel}>
            {w[0]}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((d) => {
          const k = dayKey(d);
          const evs = byDay.get(k) ?? [];
          const inMonth = d.getMonth() === anchor.getMonth();
          const isSel = k === dayKey(selected);
          return (
            <Pressable key={k} style={styles.cell} onPress={() => setSelected(startOfDay(d))}>
              <View style={[styles.cellInner, isSel && styles.cellSel]}>
                <Text
                  style={[
                    styles.cellNum,
                    !inMonth && styles.cellNumOut,
                    k === todayKey && styles.cellNumToday,
                  ]}
                >
                  {d.getDate()}
                </Text>
                <View style={styles.dots}>
                  {evs.slice(0, 3).map((b) => (
                    <View
                      key={b.uid}
                      style={[styles.cellDot, { backgroundColor: eventColorHex(b.color) }]}
                    />
                  ))}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.selHeader}>
        {WK[selected.getDay()]}, {MO[selected.getMonth()]} {selected.getDate()}
      </Text>
      {selectedEvents.length === 0 ? (
        <Text style={styles.empty}>Nothing scheduled.</Text>
      ) : (
        selectedEvents.map((b) => (
          <EventRow key={b.uid} b={b} onPress={() => router.push(`/booking/${b.uid}`)} />
        ))
      )}
    </ScrollView>
  );
}

function EventRow({ b, onPress }: { b: RangeBooking; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.eventRow}>
      <View style={[styles.bar, { backgroundColor: eventColorHex(b.color) }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.eventTitle} numberOfLines={1}>
          {b.title}
        </Text>
        {b.attendees.length ? (
          <Text style={styles.eventWho} numberOfLines={1}>
            {b.attendees.join(", ")}
          </Text>
        ) : null}
      </View>
      <Text style={styles.eventTime}>{formatTime(b.startsAt)}</Text>
    </Pressable>
  );
}

function History() {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync<Booking[]>(async () => {
    const res = await api.get<{ bookings: Booking[] }>("/api/bookings");
    return res.bookings;
  });
  useFocusEffect(useCallback(() => reload(), [reload]));

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
    >
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorText message={error} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No bookings yet" body="Bookings people make with you appear here." />
      ) : (
        data.map((b) => {
          const who = b.attendees.map((a) => a.name ?? a.email).join(", ");
          return (
            <Pressable key={b.uid} onPress={() => router.push(`/booking/${b.uid}`)}>
              <Card>
                <View style={styles.row}>
                  <View style={styles.dateBox}>
                    <Text style={styles.date}>{formatDay(b.startsAt)}</Text>
                    <Text style={styles.time}>{formatTime(b.startsAt)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>
                      {b.title}
                    </Text>
                    {who ? (
                      <Text style={styles.who} numberOfLines={1}>
                        {who}
                      </Text>
                    ) : null}
                  </View>
                  <Badge label={b.status} color={statusColor[b.status] ?? colors.muted} />
                </View>
              </Card>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: 3,
  },
  tab: { flex: 1, paddingVertical: 7, alignItems: "center", borderRadius: radius.sm },
  tabOn: { backgroundColor: colors.accent },
  tabText: { color: colors.muted, fontSize: 13, textTransform: "capitalize" },
  tabTextOn: { color: colors.white, fontWeight: "600" },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  row: { flexDirection: "row", alignItems: "center" },
  dateBox: { width: 56 },
  date: { fontWeight: "600", fontSize: 13, color: colors.text },
  time: { color: colors.muted, fontSize: 12 },
  title: { fontWeight: "600", color: colors.text },
  who: { color: colors.muted, fontSize: 12, marginTop: 1 },
  // agenda
  agendaDay: { marginBottom: 18 },
  agendaDate: { fontWeight: "600", color: colors.muted, fontSize: 13, marginBottom: 8 },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
  },
  bar: { width: 4, height: 34, borderRadius: 999 },
  eventTitle: { fontWeight: "600", color: colors.text, fontSize: 14 },
  eventWho: { color: colors.muted, fontSize: 12, marginTop: 1 },
  eventTime: { color: colors.muted, fontSize: 12 },
  // month
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  navArrow: { fontSize: 26, color: colors.muted, paddingHorizontal: 12 },
  monthTitle: { fontWeight: "700", fontSize: 16, color: colors.text },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekLabel: { flex: 1, textAlign: "center", fontSize: 11, color: colors.faint },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  cellInner: { flex: 1, alignItems: "center", paddingTop: 4, borderRadius: radius.sm },
  cellSel: { backgroundColor: colors.accentSoft },
  cellNum: { fontSize: 12, color: colors.muted },
  cellNumOut: { color: colors.faint, opacity: 0.5 },
  cellNumToday: { color: colors.accent, fontWeight: "700" },
  dots: { flexDirection: "row", gap: 2, marginTop: 3 },
  cellDot: { width: 5, height: 5, borderRadius: 999 },
  selHeader: { marginTop: 16, marginBottom: 8, fontWeight: "600", color: colors.text },
  empty: { color: colors.faint, fontSize: 13 },
});
