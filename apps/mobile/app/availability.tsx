import { ApiError, api } from "@/api";
import { ErrorText, Loading } from "@/components/ui";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

const ORDER = [1, 2, 3, 4, 5, 6, 0];
const LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
type Range = { start: string; end: string };
/** A date-specific override: null start/end = unavailable that day; else custom hours. */
type Override = { date: string; start: string | null; end: string | null };

interface ScheduleSummary {
  id: string;
  name: string;
  isDefault: boolean;
}
interface ScheduleDetail {
  id: string;
  name: string;
  isDefault: boolean;
  timezone: string;
  days: Range[][];
  overrides: Override[];
}

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
/** "YYYY-MM-DD" -> "Mon, Jan 5" without timezone drift. */
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Editing = { dow: number; idx: number; field: "start" | "end" };

export default function AvailabilityScreen() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [timezone, setTimezone] = useState("UTC");
  const [days, setDays] = useState<Range[][] | null>(null);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [addingDate, setAddingDate] = useState(false);
  const [newScheduleName, setNewScheduleName] = useState("");
  const [showNewSchedule, setShowNewSchedule] = useState(false);

  const loadSchedule = useCallback(async (id: string) => {
    try {
      const s = await api.get<ScheduleDetail>(`/api/schedules/${id}`);
      setSelectedId(s.id);
      setName(s.name);
      setIsDefault(s.isDefault);
      setTimezone(s.timezone);
      setDays(s.days);
      setOverrides(s.overrides ?? []);
      setSaved(false);
    } catch {
      setError("Could not load this schedule");
    }
  }, []);

  // Load the schedule list, then open the default one.
  useEffect(() => {
    let active = true;
    api
      .get<{ schedules: ScheduleSummary[] }>("/api/schedules")
      .then(async (res) => {
        if (!active) return;
        setSchedules(res.schedules);
        const first = res.schedules.find((s) => s.isDefault) ?? res.schedules[0];
        if (first) await loadSchedule(first.id);
      })
      .catch(() => active && setError("Could not load your schedules"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [loadSchedule]);

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

  function onPickOverrideDate(event: { type: string }, date?: Date) {
    setAddingDate(false);
    if (event.type === "dismissed" || !date) return;
    const iso = toISODate(date);
    setOverrides((prev) =>
      prev.some((o) => o.date === iso)
        ? prev
        : [...prev, { date: iso, start: null, end: null }].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
    );
    setSaved(false);
  }

  function update(dow: number, ranges: Range[]) {
    setDays((prev) => (prev ? prev.map((r, i) => (i === dow ? ranges : r)) : prev));
    setSaved(false);
  }

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

  function copyToAll(dow: number) {
    setDays((prev) => {
      if (!prev) return prev;
      const src = prev[dow] ?? [];
      return prev.map(() => src.map((r) => ({ ...r })));
    });
    setSaved(false);
  }

  async function save() {
    if (!days || !selectedId) return;
    setSaving(true);
    setError(null);
    try {
      // Hours + timezone + overrides.
      await api.put(`/api/schedules/${selectedId}`, {
        timezone,
        days: days.map((ranges, dayOfWeek) => ({ dayOfWeek, ranges })),
        overrides,
      });
      // Name / default live on the PATCH route.
      const current = schedules.find((s) => s.id === selectedId);
      if (current && name.trim() && name.trim() !== current.name) {
        await api.patch(`/api/schedules/${selectedId}`, { name: name.trim() });
      }
      if (isDefault && !current?.isDefault) {
        await api.patch(`/api/schedules/${selectedId}`, { isDefault: true });
      }
      // Refresh the summary list so names/default reflect the save.
      const res = await api.get<{ schedules: ScheduleSummary[] }>("/api/schedules");
      setSchedules(res.schedules);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function createSchedule() {
    const n = newScheduleName.trim();
    if (!n) return;
    try {
      const created = await api.post<{ id: string }>("/api/schedules", { name: n });
      setNewScheduleName("");
      setShowNewSchedule(false);
      const res = await api.get<{ schedules: ScheduleSummary[] }>("/api/schedules");
      setSchedules(res.schedules);
      await loadSchedule(created.id);
    } catch (e) {
      Alert.alert("Couldn't create", e instanceof ApiError ? e.message : "Please try again.");
    }
  }

  function confirmDeleteSchedule() {
    if (!selectedId) return;
    if (isDefault) {
      Alert.alert("Can't delete", "Make another schedule the default first.");
      return;
    }
    Alert.alert("Delete schedule", `Delete "${name}"? Event types using it fall back to default.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.del(`/api/schedules/${selectedId}`);
            const res = await api.get<{ schedules: ScheduleSummary[] }>("/api/schedules");
            setSchedules(res.schedules);
            const next = res.schedules.find((s) => s.isDefault) ?? res.schedules[0];
            if (next) await loadSchedule(next.id);
          } catch (e) {
            Alert.alert("Couldn't delete", e instanceof ApiError ? e.message : "Please try again.");
          }
        },
      },
    ]);
  }

  if (error && !days) return <ErrorText message={error} />;
  if (loading || !days) return <Loading />;

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Availability" }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Schedule selector */}
        {schedules.length > 1 || showNewSchedule ? (
          <View style={styles.schedRow}>
            {schedules.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => loadSchedule(s.id)}
                style={[styles.schedChip, s.id === selectedId && styles.schedChipOn]}
              >
                <Text style={[styles.schedChipText, s.id === selectedId && styles.schedChipTextOn]}>
                  {s.name}
                  {s.isDefault ? " ★" : ""}
                </Text>
              </Pressable>
            ))}
            <Pressable style={styles.schedChip} onPress={() => setShowNewSchedule(true)}>
              <Ionicons name="add" size={14} color={colors.accent} />
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.newSchedLink} onPress={() => setShowNewSchedule(true)}>
            <Ionicons name="add" size={15} color={colors.accent} />
            <Text style={styles.tzDetectText}>New schedule</Text>
          </Pressable>
        )}

        {showNewSchedule ? (
          <View style={styles.newSchedBox}>
            <TextInput
              style={styles.tzInput}
              value={newScheduleName}
              onChangeText={setNewScheduleName}
              placeholder="Schedule name (e.g. Consulting hours)"
              placeholderTextColor={colors.faint}
            />
            <View style={styles.newSchedActions}>
              <Pressable onPress={() => setShowNewSchedule(false)}>
                <Text style={styles.copyAll}>Cancel</Text>
              </Pressable>
              <Pressable onPress={createSchedule} disabled={!newScheduleName.trim()}>
                <Text style={styles.add}>Create</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Name + default */}
        <Text style={styles.tzLabel}>Schedule name</Text>
        <TextInput
          style={styles.tzInput}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setSaved(false);
          }}
          placeholder="Working hours"
          placeholderTextColor={colors.faint}
        />
        <View style={styles.defaultRow}>
          <Switch
            value={isDefault}
            onValueChange={(v) => {
              setIsDefault(v);
              setSaved(false);
            }}
            disabled={schedules.find((s) => s.id === selectedId)?.isDefault}
          />
          <Text style={styles.defaultText}>Use as my default schedule</Text>
        </View>

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

        {/* Date-specific overrides (holidays / one-off hours) */}
        <Text style={styles.sectionTitle}>Date overrides</Text>
        <Text style={styles.overrideHint}>Block a holiday or set custom hours for one date.</Text>
        {overrides.map((o) => (
          <View key={o.date} style={styles.overrideRow}>
            <Text style={styles.overrideDate}>{fmtDate(o.date)}</Text>
            {o.start && o.end ? (
              <Text style={styles.overrideHours}>
                {fmtTime(o.start)}–{fmtTime(o.end)}
              </Text>
            ) : (
              <Text style={styles.overrideUnavail}>Unavailable</Text>
            )}
            <Pressable
              onPress={() =>
                setOverrides((prev) =>
                  prev.map((x) =>
                    x.date === o.date
                      ? x.start
                        ? { ...x, start: null, end: null }
                        : { ...x, start: "09:00", end: "17:00" }
                      : x,
                  ),
                )
              }
              hitSlop={6}
            >
              <Text style={styles.add}>{o.start ? "Set unavailable" : "Set hours"}</Text>
            </Pressable>
            <Pressable
              onPress={() => setOverrides((prev) => prev.filter((x) => x.date !== o.date))}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={colors.faint} />
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.addDate} onPress={() => setAddingDate(true)}>
          <Ionicons name="calendar-outline" size={15} color={colors.accent} />
          <Text style={styles.add}>Add a date</Text>
        </Pressable>

        {editing ? (
          <DateTimePicker
            value={parseHM(days[editing.dow]?.[editing.idx]?.[editing.field] ?? "09:00")}
            mode="time"
            onChange={onPickTime}
          />
        ) : null}
        {addingDate ? (
          <DateTimePicker value={new Date()} mode="date" onChange={onPickOverrideDate} />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.save} onPress={save} disabled={saving}>
          <Text style={styles.saveText}>{saving ? "Saving…" : "Save availability"}</Text>
        </Pressable>
        {saved ? <Text style={styles.savedText}>✓ Saved</Text> : null}

        {!isDefault && schedules.length > 1 ? (
          <Pressable style={styles.deleteSched} onPress={confirmDeleteSchedule}>
            <Ionicons name="trash-outline" size={15} color={colors.danger} />
            <Text style={styles.deleteSchedText}>Delete this schedule</Text>
          </Pressable>
        ) : null}

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
  schedRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  schedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  schedChipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  schedChipText: { color: colors.muted, fontSize: 13 },
  schedChipTextOn: { color: colors.text, fontWeight: "600" },
  newSchedLink: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
  newSchedBox: { marginBottom: 16, gap: 8 },
  newSchedActions: { flexDirection: "row", justifyContent: "flex-end", gap: 20 },
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
  defaultRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  defaultText: { color: colors.text, fontSize: 14 },
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
  sectionTitle: {
    marginTop: 24,
    fontWeight: "700",
    color: colors.text,
    fontSize: 16,
  },
  overrideHint: { color: colors.faint, fontSize: 12, marginTop: 4, marginBottom: 10 },
  overrideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  overrideDate: { color: colors.text, fontSize: 14, flex: 1 },
  overrideHours: { color: colors.text, fontSize: 13 },
  overrideUnavail: { color: colors.faint, fontSize: 13 },
  addDate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
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
  deleteSched: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    paddingVertical: 12,
  },
  deleteSchedText: { color: colors.danger, fontWeight: "600", fontSize: 14 },
  links: { marginTop: 28, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  linkText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "500" },
});
