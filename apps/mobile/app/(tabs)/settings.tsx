import { ApiError, api } from "@/api";
import { useAuth } from "@/auth";
import { Loading } from "@/components/ui";
import type { UserPreferences } from "@/models";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TIME_FORMATS: { value: "12h" | "24h"; label: string }[] = [
  { value: "12h", label: "12-hour" },
  { value: "24h", label: "24-hour" },
];
const WEEK_DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 6, label: "Saturday" },
];
const REMINDER_OPTIONS = [
  { value: 10080, label: "1 week" },
  { value: 1440, label: "1 day" },
  { value: 120, label: "2 hours" },
  { value: 60, label: "1 hour" },
  { value: 30, label: "30 min" },
  { value: 10, label: "10 min" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [handle, setHandle] = useState(user?.handle ?? "");
  const [timezone, setTimezone] = useState(user?.timezone ?? "UTC");
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h");
  const [weekStartsOn, setWeekStartsOn] = useState(0);
  const [reminders, setReminders] = useState<number[]>([1440, 60]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<{ preferences: UserPreferences }>("/api/settings/preferences")
      .then(({ preferences: p }) => {
        if (!active) return;
        setTimeFormat(p.timeFormat);
        setWeekStartsOn(p.weekStartsOn);
        setReminders(p.defaultReminderOffsets);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  function toggleReminder(v: number) {
    setSaved(false);
    setReminders((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.patch("/api/settings/profile", { name, timezone, handle });
      await api.patch("/api/settings/preferences", {
        timeFormat,
        weekStartsOn,
        theme: "system",
        defaultReminderOffsets: reminders,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.header}>Settings</Text>

        <Text style={styles.section}>Profile</Text>
        <Field label="Name" value={name} onChange={setName} placeholder="Ada Lovelace" />
        <Field
          label="Booking handle"
          value={handle}
          onChange={(v) => setHandle(v.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          placeholder="ada"
          hint={`Your public page: /${handle || "your-handle"}`}
        />
        <Field label="Timezone" value={timezone} onChange={setTimezone} placeholder="UTC" />

        <Text style={styles.section}>Preferences</Text>
        <Text style={styles.label}>Time format</Text>
        <View style={styles.pills}>
          {TIME_FORMATS.map((t) => (
            <Pressable
              key={t.value}
              onPress={() => {
                setTimeFormat(t.value);
                setSaved(false);
              }}
              style={[styles.pill, t.value === timeFormat && styles.pillOn]}
            >
              <Text style={[styles.pillText, t.value === timeFormat && styles.pillTextOn]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Week starts on</Text>
        <View style={styles.pills}>
          {WEEK_DAYS.map((d) => (
            <Pressable
              key={d.value}
              onPress={() => {
                setWeekStartsOn(d.value);
                setSaved(false);
              }}
              style={[styles.pill, d.value === weekStartsOn && styles.pillOn]}
            >
              <Text style={[styles.pillText, d.value === weekStartsOn && styles.pillTextOn]}>
                {d.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Default reminders</Text>
        <View style={styles.wrapPills}>
          {REMINDER_OPTIONS.map((o) => (
            <Pressable
              key={o.value}
              onPress={() => toggleReminder(o.value)}
              style={[styles.chip, reminders.includes(o.value) && styles.pillOn]}
            >
              <Text style={[styles.pillText, reminders.includes(o.value) && styles.pillTextOn]}>
                {o.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.save} onPress={save} disabled={saving}>
          <Text style={styles.saveText}>{saving ? "Saving…" : "Save changes"}</Text>
        </Pressable>
        {saved ? <Text style={styles.savedText}>Saved ✓</Text> : null}

        <Text style={styles.section}>Reminders</Text>
        <Pressable style={styles.navRow} onPress={() => router.push("/notifications")}>
          <Ionicons name="notifications-outline" size={18} color={colors.muted} />
          <Text style={styles.navText}>Notification channels</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>

        <Pressable style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChange}
        placeholder={props.placeholder}
        placeholderTextColor={colors.faint}
        autoCapitalize="none"
      />
      {props.hint ? <Text style={styles.hint}>{props.hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  header: { fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: 12 },
  section: {
    fontWeight: "600",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.faint,
    marginTop: 8,
    marginBottom: 12,
  },
  label: { fontWeight: "500", fontSize: 14, marginBottom: 6, color: colors.text },
  hint: { color: colors.faint, fontSize: 12, marginTop: 6 },
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
  },
  pills: { flexDirection: "row", gap: 8, marginBottom: 18 },
  wrapPills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  pill: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  pillOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pillText: { color: colors.muted },
  pillTextOn: { color: colors.text, fontWeight: "600" },
  error: { color: colors.danger, marginBottom: 12 },
  save: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  savedText: { color: colors.success, textAlign: "center", marginTop: 10 },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  navText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "500" },
  signOut: { marginTop: 28, alignItems: "center" },
  signOutText: { color: colors.danger, fontWeight: "500" },
});
