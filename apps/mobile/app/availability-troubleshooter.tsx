import { ApiError, api } from "@/api";
import { ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface EventTypeLite {
  id: string;
  title: string;
}
interface DayDiagnosis {
  date: string;
  weekday: string;
  scheduleWindows: { start: string; end: string }[];
  dayOff: boolean;
  beyondBookingWindow: boolean;
  totalSlots: number;
  bookableSlots: number;
  blockedByBusy: number;
  blockedByNoticeOrRange: number;
  reasons: string[];
}

/** YYYY-MM-DD from a Date's LOCAL parts (toISOString would shift by the UTC offset). */
function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Availability troubleshooter (#131): explain why a booking type does (or does
 *  not) offer times on a given day. Host-only diagnostic, parity with web. */
export default function TroubleshooterScreen() {
  const { data: eventTypes, loading: loadingTypes } = useAsync<EventTypeLite[]>(async () => {
    const res = await api.get<{ eventTypes: EventTypeLite[] }>("/api/event-types");
    return res.eventTypes ?? [];
  }, []);

  const [eventTypeId, setEventTypeId] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DayDiagnosis | null>(null);

  // Default to the first booking type once loaded.
  useEffect(() => {
    if (!eventTypeId && eventTypes && eventTypes[0]) setEventTypeId(eventTypes[0].id);
  }, [eventTypes, eventTypeId]);

  async function run() {
    if (!eventTypeId) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.get<{ diagnosis: DayDiagnosis }>(
        `/api/availability/troubleshoot?eventTypeId=${eventTypeId}&date=${toISODate(date)}`,
      );
      setResult(res.diagnosis);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't run the check.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Troubleshoot" }} />
      {loadingTypes && !eventTypes ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>
            See exactly why a booking type does (or doesn't) offer times on a given day.
          </Text>

          <Text style={styles.label}>Booking type</Text>
          <View style={styles.pills}>
            {(eventTypes ?? []).map((et) => (
              <Pressable
                key={et.id}
                onPress={() => setEventTypeId(et.id)}
                style={[styles.chip, et.id === eventTypeId && styles.chipOn]}
              >
                <Text style={[styles.chipText, et.id === eventTypeId && styles.chipTextOn]}>
                  {et.title}
                </Text>
              </Pressable>
            ))}
          </View>
          {(eventTypes ?? []).length === 0 ? (
            <Text style={styles.empty}>Create a booking type first.</Text>
          ) : null}

          <Text style={styles.label}>Day</Text>
          <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
            <Text style={styles.inputText}>{fmtDate(date)}</Text>
          </Pressable>
          {showPicker ? (
            <DateTimePicker
              value={date}
              mode="date"
              onChange={(event, picked) => {
                setShowPicker(false);
                if (event.type !== "dismissed" && picked) setDate(picked);
              }}
            />
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.save} onPress={run} disabled={running || !eventTypeId}>
            <Text style={styles.saveText}>{running ? "Checking…" : "Diagnose"}</Text>
          </Pressable>

          {result ? (
            <View style={styles.result}>
              <Text style={styles.resultTitle}>
                {result.weekday}, {result.date} —{" "}
                {result.bookableSlots > 0
                  ? `${result.bookableSlots} bookable`
                  : "no bookable slots"}
              </Text>
              {result.reasons.map((r) => (
                <View key={r} style={styles.reasonRow}>
                  <Ionicons
                    name={result.bookableSlots > 0 ? "checkmark-circle" : "alert-circle"}
                    size={15}
                    color={result.bookableSlots > 0 ? colors.success : colors.amber}
                  />
                  <Text style={styles.reason}>{r}</Text>
                </View>
              ))}
              <View style={styles.stats}>
                <Stat
                  label="Working hours"
                  value={
                    result.scheduleWindows.length
                      ? result.scheduleWindows.map((w) => `${w.start}–${w.end}`).join(", ")
                      : "—"
                  }
                />
                <Stat label="Schedule capacity" value={`${result.totalSlots} slots`} />
                <Stat label="Blocked by busy" value={String(result.blockedByBusy)} />
                <Stat label="Notice / window" value={String(result.blockedByNoticeOrRange)} />
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  hint: { color: colors.muted, fontSize: 13, marginBottom: 16 },
  empty: { color: colors.muted, fontSize: 13, marginBottom: 8 },
  label: { fontWeight: "500", fontSize: 14, marginBottom: 8, marginTop: 8, color: colors.text },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextOn: { color: colors.white, fontWeight: "600" },
  input: {
    height: 46,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  inputText: { fontSize: 15, color: colors.text },
  error: { color: colors.danger, marginTop: 14 },
  save: {
    marginTop: 18,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  result: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    padding: 16,
  },
  resultTitle: { fontWeight: "700", fontSize: 15, color: colors.text, marginBottom: 12 },
  reasonRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 8 },
  reason: { flex: 1, color: colors.muted, fontSize: 13 },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
    marginTop: 6,
  },
  stat: { minWidth: "40%" },
  statLabel: { color: colors.faint, fontSize: 11 },
  statValue: { color: colors.text, fontSize: 13, marginTop: 2 },
});
