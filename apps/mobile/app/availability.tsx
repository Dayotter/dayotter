import { api } from "@/api";
import { ErrorText, Loading } from "@/components/ui";
import type { Schedule } from "@/models";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

const ORDER = [1, 2, 3, 4, 5, 6, 0];
const LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
type Range = { start: string; end: string };

/** "HH:MM" -> a Date today at that time (for the native time picker). */
function parseHM(hm: string): Date {
  const [h, m] = hm.split(":").map((n) => Number.parseInt(n, 10));
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}
/** Date -> "HH:MM" (24h, the format the schedule API stores). */
function toHM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
/** "HH:MM" -> a friendly localized label for the button (respects the device clock). */
function fmtTime(hm: string): string {
  return parseHM(hm).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

type Editing = { dow: number; idx: number; field: "start" | "end" };

export default function AvailabilityScreen() {
  const router = useRouter();
  const [timezone, setTimezone] = useState("UTC");
  const [days, setDays] = useState<Range[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // A single screen-level time picker (which field it edits), mirroring polls/new.
  const [editing, setEditing] = useState<Editing | null>(null);

  function onPickTime(event: { type: string }, date?: Date) {
    const ed = editing;
    setEditing(null);
    if (event.type === "dismissed" || !date || !ed) return;
    const hm = toHM(date);
    setDays((prev) =>
      prev
        ? prev.map((ranges, i) =>
            i === ed.dow
              ? ranges.map((x, j) => (j === ed.idx ? { ...x, [ed.field]: hm } : x))
              : ranges,
          )
        : prev,
    );
    setSaved(false);
  }

  useEffect(() => {
    api
      .get<Schedule>("/api/schedule")
      .then((s) => {
        setTimezone(s.timezone);
        setDays(s.days);
      })
      .catch(() => setError("Could not load your schedule"));
  }, []);

  function update(dow: number, ranges: Range[]) {
    setDays((prev) => (prev ? prev.map((r, i) => (i === dow ? ranges : r)) : prev));
    setSaved(false);
  }

  /** One-tap presets - mirrors the web editor so nobody sets seven days by hand. */
  function applyPreset(preset: "weekdays" | "everyday" | "clear") {
    const nineToFive: Range[] = [{ start: "09:00", end: "17:00" }];
    setDays((prev) =>
      prev
        ? prev.map((_, dow) => {
            if (preset === "clear") return [];
            if (preset === "everyday") return nineToFive.map((r) => ({ ...r }));
            return dow >= 1 && dow <= 5 ? nineToFive.map((r) => ({ ...r })) : [];
          })
        : prev,
    );
    setSaved(false);
  }

  /** Copy one day's hours onto every day. */
  function copyToAll(dow: number) {
    setDays((prev) => {
      if (!prev) return prev;
      const src = prev[dow] ?? [];
      return prev.map(() => src.map((r) => ({ ...r })));
    });
    setSaved(false);
  }

  async function save() {
    if (!days) return;
    setSaving(true);
    setError(null);
    try {
      await api.put("/api/schedule", {
        timezone,
        days: days.map((ranges, dayOfWeek) => ({ dayOfWeek, ranges })),
      });
      setSaved(true);
    } catch {
      setError("Could not save your availability. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !days) return <ErrorText message={error} />;
  if (!days) return <Loading />;

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Availability" }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.tzLabel}>Timezone</Text>
        <TextInput
          style={styles.tzInput}
          value={timezone}
          onChangeText={(v) => {
            setTimezone(v);
            setSaved(false);
          }}
          autoCapitalize="none"
          placeholder="e.g. America/New_York"
          placeholderTextColor={colors.faint}
        />
        <Pressable
          style={styles.tzDetect}
          onPress={() => {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (tz) {
              setTimezone(tz);
              setSaved(false);
            }
          }}
        >
          <Ionicons name="locate-outline" size={15} color={colors.accent} />
          <Text style={styles.tzDetectText}>Use device timezone</Text>
        </Pressable>

        <View style={styles.presets}>
          {(
            [
              { key: "weekdays", label: "Weekdays 9–5" },
              { key: "everyday", label: "Every day 9–5" },
              { key: "clear", label: "Clear all" },
            ] as const
          ).map((p) => (
            <Pressable key={p.key} style={styles.presetChip} onPress={() => applyPreset(p.key)}>
              <Text style={styles.presetText}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        {ORDER.map((dow) => {
          const ranges = days[dow] ?? [];
          const on = ranges.length > 0;
          return (
            <View key={dow} style={styles.day}>
              <View style={styles.dayHeader}>
                <Switch
                  value={on}
                  onValueChange={(v) => update(dow, v ? [{ start: "09:00", end: "17:00" }] : [])}
                  trackColor={{ true: colors.accent, false: colors.borderStrong }}
                />
                <Text style={[styles.dayName, !on && { color: colors.muted }]}>{LABELS[dow]}</Text>
              </View>
              {on ? (
                <View style={styles.ranges}>
                  {ranges.map((r, i) => (
                    <View key={i} style={styles.rangeRow}>
                      <Pressable
                        style={styles.timeInput}
                        onPress={() => setEditing({ dow, idx: i, field: "start" })}
                      >
                        <Text style={styles.timeText}>{fmtTime(r.start)}</Text>
                      </Pressable>
                      <Text style={styles.dash}>–</Text>
                      <Pressable
                        style={styles.timeInput}
                        onPress={() => setEditing({ dow, idx: i, field: "end" })}
                      >
                        <Text style={styles.timeText}>{fmtTime(r.end)}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          update(
                            dow,
                            ranges.filter((_, j) => j !== i),
                          )
                        }
                        hitSlop={8}
                      >
                        <Ionicons name="close" size={18} color={colors.faint} />
                      </Pressable>
                    </View>
                  ))}
                  <View style={styles.rangeActions}>
                    <Pressable
                      onPress={() => update(dow, [...ranges, { start: "09:00", end: "17:00" }])}
                    >
                      <Text style={styles.add}>+ Add time</Text>
                    </Pressable>
                    <Pressable onPress={() => copyToAll(dow)}>
                      <Text style={styles.copyAll}>Copy to all days</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Text style={styles.unavailable}>Unavailable</Text>
              )}
            </View>
          );
        })}

        {editing ? (
          <DateTimePicker
            value={parseHM(days[editing.dow]?.[editing.idx]?.[editing.field] ?? "09:00")}
            mode="time"
            onChange={onPickTime}
          />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.save} onPress={save} disabled={saving}>
          <Text style={styles.saveText}>{saving ? "Saving…" : "Save availability"}</Text>
        </Pressable>
        {saved ? <Text style={styles.savedText}>✓ Saved</Text> : null}

        <View style={styles.links}>
          <Pressable style={styles.linkRow} onPress={() => router.push("/out-of-office")}>
            <Ionicons name="airplane-outline" size={18} color={colors.accent} />
            <Text style={styles.linkText}>Out of office</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </Pressable>
          <Pressable
            style={styles.linkRow}
            onPress={() => router.push("/availability-troubleshooter")}
          >
            <Ionicons name="help-buoy-outline" size={18} color={colors.accent} />
            <Text style={styles.linkText}>Troubleshoot availability</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  tzLabel: { fontWeight: "500", fontSize: 14, marginBottom: 6, color: colors.text },
  tzInput: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  tzDetect: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
  tzDetectText: { color: colors.accent, fontSize: 13, fontWeight: "500" },
  day: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 14 },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  dayName: { fontWeight: "500", color: colors.text },
  ranges: { marginTop: 10, marginLeft: 4, gap: 8 },
  rangeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeInput: {
    width: 92,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
  },
  timeText: { fontSize: 14, color: colors.text },
  dash: { color: colors.muted },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  presetChip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  presetText: { color: colors.text, fontSize: 13, fontWeight: "500" },
  rangeActions: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 2 },
  add: { color: colors.accent },
  copyAll: { color: colors.muted },
  unavailable: { color: colors.faint, marginTop: 8, marginLeft: 4 },
  error: { color: colors.danger, marginTop: 12 },
  save: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  savedText: { color: colors.success, textAlign: "center", marginTop: 10 },
  links: { marginTop: 28, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  linkText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "500" },
});
