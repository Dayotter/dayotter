import { api } from "@/api";
import { ErrorText, Loading } from "@/components/ui";
import type { Schedule } from "@/models";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

const ORDER = [1, 2, 3, 4, 5, 6, 0];
const LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
type Range = { start: string; end: string };

export default function AvailabilityScreen() {
  const [timezone, setTimezone] = useState("UTC");
  const [days, setDays] = useState<Range[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  /** One-tap presets — mirrors the web editor so nobody sets seven days by hand. */
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
      setError("Could not save. Check your times (HH:MM).");
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
                      <TimeInput
                        value={r.start}
                        onChange={(v) =>
                          update(
                            dow,
                            ranges.map((x, j) => (j === i ? { ...x, start: v } : x)),
                          )
                        }
                      />
                      <Text style={styles.dash}>–</Text>
                      <TimeInput
                        value={r.end}
                        onChange={(v) =>
                          update(
                            dow,
                            ranges.map((x, j) => (j === i ? { ...x, end: v } : x)),
                          )
                        }
                      />
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

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.save} onPress={save} disabled={saving}>
          <Text style={styles.saveText}>{saving ? "Saving…" : "Save availability"}</Text>
        </Pressable>
        {saved ? <Text style={styles.savedText}>✓ Saved</Text> : null}
      </ScrollView>
    </View>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      style={styles.timeInput}
      value={value}
      onChangeText={onChange}
      placeholder="09:00"
      placeholderTextColor={colors.faint}
      maxLength={5}
      autoCapitalize="none"
    />
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
    marginBottom: 20,
  },
  day: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 14 },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  dayName: { fontWeight: "500", color: colors.text },
  ranges: { marginTop: 10, marginLeft: 4, gap: 8 },
  rangeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeInput: {
    width: 74,
    height: 40,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlign: "center",
  },
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
});
