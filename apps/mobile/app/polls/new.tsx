import { ApiError, api } from "@/api";
import { formatDateTime } from "@/format";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const DURATIONS = [15, 30, 45, 60, 90];
// Values mirror the web poll create form; the server uses `location` to decide
// whether to auto-create a conference link on finalize.
const LOCATIONS: { value: string; label: string }[] = [
  { value: "google_meet", label: "Google Meet" },
  { value: "zoom", label: "Zoom" },
  { value: "phone", label: "Phone" },
  { value: "custom", label: "Other / in person" },
];

const MAX_TIMES = 20;

export default function NewPollScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState("google_meet");
  const [times, setTimes] = useState<Date[]>([]);
  const [saving, setSaving] = useState(false);

  // Two-step native picker (date → time) so it behaves the same on iOS + Android.
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  const [draft, setDraft] = useState<Date | null>(null);

  function startAddTime() {
    if (times.length >= MAX_TIMES) return;
    // Default to the next hour, on the hour.
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    setDraft(d);
    setPicker("date");
  }

  function onPick(event: { type: string }, date?: Date) {
    if (event.type === "dismissed" || !date) {
      setPicker(null);
      return;
    }
    if (picker === "date") {
      const base = draft ?? new Date();
      const merged = new Date(date);
      merged.setHours(base.getHours(), base.getMinutes(), 0, 0);
      setDraft(merged);
      setPicker("time");
    } else {
      const final = new Date(date);
      final.setSeconds(0, 0);
      setTimes((prev) => [...prev, final].sort((a, b) => a.getTime() - b.getTime()));
      setDraft(null);
      setPicker(null);
    }
  }

  function removeTime(idx: number) {
    setTimes((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (!title.trim()) {
      Alert.alert("Add a title", "Give your poll a name so invitees know what it's for.");
      return;
    }
    // Only future times count on the server; guard here too for a clear message.
    const iso = times.filter((d) => d.getTime() > Date.now()).map((d) => d.toISOString());
    if (iso.length < 2) {
      Alert.alert("Add more times", "Propose at least two future time options.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<{ id: string; token: string; url: string }>("/api/polls", {
        title: title.trim(),
        durationMinutes: duration,
        location,
        times: iso,
      });
      // Replace so Back returns to the list, not the empty create form.
      router.replace(`/polls/${res.id}`);
    } catch (e) {
      Alert.alert("Couldn't create poll", e instanceof ApiError ? e.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "New poll" }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>What's the meeting?</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Q3 planning sync"
          placeholderTextColor={colors.faint}
        />

        <Text style={styles.label}>Duration</Text>
        <View style={styles.pills}>
          {DURATIONS.map((m) => (
            <Pressable
              key={m}
              onPress={() => setDuration(m)}
              style={[styles.pill, m === duration && styles.pillOn]}
            >
              <Text style={[styles.pillText, m === duration && styles.pillTextOn]}>{m} min</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Location</Text>
        <View style={styles.pills}>
          {LOCATIONS.map((l) => (
            <Pressable
              key={l.value}
              onPress={() => setLocation(l.value)}
              style={[styles.pill, l.value === location && styles.pillOn]}
            >
              <Text style={[styles.pillText, l.value === location && styles.pillTextOn]}>
                {l.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Propose some times</Text>
        <Text style={styles.hint}>
          Invitees vote on which work. Times use your device's timezone. Add at least two.
        </Text>

        {times.map((d, i) => (
          <View key={d.toISOString()} style={styles.timeRow}>
            <Ionicons name="time-outline" size={16} color={colors.muted} />
            <Text style={styles.timeText}>{formatDateTime(d.toISOString())}</Text>
            <Pressable onPress={() => removeTime(i)} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.faint} />
            </Pressable>
          </View>
        ))}

        <Pressable
          style={styles.addTime}
          onPress={startAddTime}
          disabled={times.length >= MAX_TIMES}
        >
          <Ionicons name="add" size={16} color={colors.accent} />
          <Text style={styles.addTimeText}>
            {times.length >= MAX_TIMES ? "Maximum times added" : "Add a time"}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.save, (saving || !title.trim() || times.length < 2) && styles.saveOff]}
          onPress={submit}
          disabled={saving || !title.trim() || times.length < 2}
        >
          <Text style={styles.saveText}>{saving ? "Creating…" : "Create poll"}</Text>
        </Pressable>
      </ScrollView>

      {picker ? (
        <DateTimePicker value={draft ?? new Date()} mode={picker} onChange={onPick} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  label: { fontWeight: "600", color: colors.text, marginBottom: 8, marginTop: 4 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: 18,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  pill: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  pillOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pillText: { color: colors.muted, fontSize: 13 },
  pillTextOn: { color: colors.text, fontWeight: "600" },
  hint: { color: colors.faint, fontSize: 12, marginBottom: 12, marginTop: -2 },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    backgroundColor: colors.surface,
  },
  timeText: { flex: 1, color: colors.text, fontSize: 14 },
  addTime: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: "dashed",
    borderRadius: radius.md,
    paddingVertical: 12,
    marginTop: 4,
  },
  addTimeText: { color: colors.accent, fontWeight: "600", fontSize: 14 },
  save: {
    marginTop: 24,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveOff: { opacity: 0.5 },
  saveText: { color: colors.white, fontWeight: "600", fontSize: 15 },
});
