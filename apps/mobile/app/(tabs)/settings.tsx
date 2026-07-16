import { ApiError, api } from "@/api";
import { useAuth } from "@/auth";
import { Loading } from "@/components/ui";
import type { UserPreferences } from "@/models";
import { serverHost } from "@/server";
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
/** Booking-page accent presets (hex); null = the default theme. */
const BRAND_PRESETS = ["#6743e6", "#0ea5e9", "#10b981", "#f59e0b", "#ef6a52", "#ec4899"];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [handle, setHandle] = useState(user?.handle ?? "");
  const [timezone, setTimezone] = useState(user?.timezone ?? "UTC");
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h");
  const [weekStartsOn, setWeekStartsOn] = useState(0);
  const [reminders, setReminders] = useState<number[]>([1440, 60]);
  const [adaptive, setAdaptive] = useState(false);
  const [maxPerDay, setMaxPerDay] = useState(5);
  const [travelBuffer, setTravelBuffer] = useState(0);
  const [reclaim, setReclaim] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const [scribe, setScribe] = useState(false);
  const [briefing, setBriefing] = useState(false);
  const [briefingHour, setBriefingHour] = useState(8);
  const [lunch, setLunch] = useState(false);
  const [lunchStart, setLunchStart] = useState(720);
  const [lunchEnd, setLunchEnd] = useState(780);
  const [bookingAssistant, setBookingAssistant] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [brandColor, setBrandColor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<{ preferences: UserPreferences }>("/api/settings/preferences"),
      api
        .get<{ branding: { brandColor: string | null; welcomeMessage: string | null } }>("/api/me")
        .catch(() => null),
    ])
      .then(([{ preferences: p }, me]) => {
        if (!active) return;
        setTimeFormat(p.timeFormat);
        setWeekStartsOn(p.weekStartsOn);
        setReminders(p.defaultReminderOffsets);
        setAdaptive(p.adaptiveAvailability ?? false);
        setMaxPerDay(p.maxMeetingsPerDay ?? 5);
        setTravelBuffer(p.travelBufferMinutes ?? 0);
        setReclaim(p.reclaimCancelledTime ?? false);
        setOverflow(p.overflowNotifyEnabled ?? false);
        setScribe(p.scribeEnabled ?? false);
        setBriefing(p.briefingEnabled ?? false);
        setBriefingHour(p.briefingHour ?? 8);
        setLunch(p.lunchEnabled ?? false);
        setLunchStart(p.lunchStartMinute ?? 720);
        setLunchEnd(p.lunchEndMinute ?? 780);
        setBookingAssistant(p.bookingPageAssistant ?? true);
        setWelcomeMessage(me?.branding?.welcomeMessage ?? "");
        setBrandColor(me?.branding?.brandColor ?? null);
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
      await api.patch("/api/settings/profile", {
        name,
        timezone,
        handle,
        brandColor,
        welcomeMessage: welcomeMessage.trim() || null,
      });
      // Partial update - we intentionally omit `theme` (no dark mode on mobile
      // yet) so a web-set theme is preserved by the server's merge.
      await api.patch("/api/settings/preferences", {
        timeFormat,
        weekStartsOn,
        defaultReminderOffsets: reminders,
        adaptiveAvailability: adaptive,
        maxMeetingsPerDay: maxPerDay,
        travelBufferMinutes: travelBuffer,
        reclaimCancelledTime: reclaim,
        overflowNotifyEnabled: overflow,
        scribeEnabled: scribe,
        briefingEnabled: briefing,
        briefingHour,
        lunchEnabled: lunch,
        lunchStartMinute: lunchStart,
        lunchEndMinute: lunchEnd,
        bookingPageAssistant: bookingAssistant,
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

        <Text style={styles.section}>Booking page</Text>
        <Field
          label="Welcome message"
          value={welcomeMessage}
          onChange={(v) => {
            setWelcomeMessage(v);
            setSaved(false);
          }}
          placeholder="A short intro shown on your booking page"
        />
        <Text style={styles.label}>Accent colour</Text>
        <View style={styles.pills}>
          <Pressable
            onPress={() => {
              setBrandColor(null);
              setSaved(false);
            }}
            style={[styles.pill, brandColor === null && styles.pillOn]}
          >
            <Text style={[styles.pillText, brandColor === null && styles.pillTextOn]}>Default</Text>
          </Pressable>
          {BRAND_PRESETS.map((c) => (
            <Pressable
              key={c}
              onPress={() => {
                setBrandColor(c);
                setSaved(false);
              }}
              style={[
                styles.swatch,
                { backgroundColor: c },
                brandColor?.toLowerCase() === c && styles.swatchOn,
              ]}
            />
          ))}
        </View>

        <ToggleRow
          label="AI “find me a time” helper"
          hint="Show the Otter assistant on your public booking page so visitors can describe when they're free."
          value={bookingAssistant}
          onChange={(v) => {
            setBookingAssistant(v);
            setSaved(false);
          }}
        />

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

        <Text style={styles.section}>Scheduling</Text>
        <Pressable
          style={styles.toggleRow}
          onPress={() => {
            setAdaptive((v) => !v);
            setSaved(false);
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Adaptive availability</Text>
            <Text style={styles.hint}>
              On heavy days, stop offering slots once you hit your meeting cap.
            </Text>
          </View>
          <View style={[styles.switch, adaptive && styles.switchOn]}>
            <View style={[styles.knob, adaptive && styles.knobOn]} />
          </View>
        </Pressable>
        {adaptive ? (
          <View style={styles.inlineField}>
            <Text style={styles.label}>Max meetings/day</Text>
            <TextInput
              style={styles.numInput}
              value={String(maxPerDay)}
              onChangeText={(v) => {
                setMaxPerDay(Math.max(1, Math.min(20, Number(v.replace(/[^0-9]/g, "")) || 1)));
                setSaved(false);
              }}
              keyboardType="number-pad"
            />
          </View>
        ) : null}

        <View style={styles.inlineField}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Travel time (in-person)</Text>
            <Text style={styles.hint}>Minutes reserved each way. 0 = off.</Text>
          </View>
          <TextInput
            style={styles.numInput}
            value={String(travelBuffer)}
            onChangeText={(v) => {
              setTravelBuffer(Math.max(0, Math.min(240, Number(v.replace(/[^0-9]/g, "")) || 0)));
              setSaved(false);
            }}
            keyboardType="number-pad"
          />
        </View>

        <ToggleRow
          label="Reclaim cancelled time"
          hint="When a future meeting is cancelled, hold the freed time as focus instead of re-opening it."
          value={reclaim}
          onChange={(v) => {
            setReclaim(v);
            setSaved(false);
          }}
        />
        <ToggleRow
          label="Running-late alerts"
          hint="Auto-notify your next meeting when one runs over."
          value={overflow}
          onChange={(v) => {
            setOverflow(v);
            setSaved(false);
          }}
        />
        <ToggleRow
          label="Post-meeting recap"
          hint="Get a recap + next-step nudge just after each meeting ends."
          value={scribe}
          onChange={(v) => {
            setScribe(v);
            setSaved(false);
          }}
        />
        <ToggleRow
          label="Daily morning briefing"
          hint="A “here's your day” summary each morning."
          value={briefing}
          onChange={(v) => {
            setBriefing(v);
            setSaved(false);
          }}
        />
        {briefing ? (
          <View style={styles.inlineField}>
            <Text style={styles.label}>Briefing hour (0–23)</Text>
            <TextInput
              style={styles.numInput}
              value={String(briefingHour)}
              onChangeText={(v) => {
                setBriefingHour(Math.max(0, Math.min(23, Number(v.replace(/[^0-9]/g, "")) || 0)));
                setSaved(false);
              }}
              keyboardType="number-pad"
            />
          </View>
        ) : null}
        <ToggleRow
          label="Lunch break"
          hint="Block a daily lunch window so it's never bookable."
          value={lunch}
          onChange={(v) => {
            setLunch(v);
            setSaved(false);
          }}
        />
        {lunch ? (
          <View style={styles.inlineField}>
            <Text style={styles.label}>Lunch (start–end hour)</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={styles.numInput}
                value={String(Math.floor(lunchStart / 60))}
                onChangeText={(v) => {
                  setLunchStart(
                    Math.max(0, Math.min(23, Number(v.replace(/[^0-9]/g, "")) || 0)) * 60,
                  );
                  setSaved(false);
                }}
                keyboardType="number-pad"
              />
              <TextInput
                style={styles.numInput}
                value={String(Math.floor(lunchEnd / 60))}
                onChangeText={(v) => {
                  setLunchEnd(
                    Math.max(1, Math.min(24, Number(v.replace(/[^0-9]/g, "")) || 1)) * 60,
                  );
                  setSaved(false);
                }}
                keyboardType="number-pad"
              />
            </View>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.save} onPress={save} disabled={saving}>
          <Text style={styles.saveText}>{saving ? "Saving…" : "Save changes"}</Text>
        </Pressable>
        {saved ? <Text style={styles.savedText}>Saved ✓</Text> : null}

        <Text style={styles.section}>Workspace</Text>
        <Pressable style={styles.navRow} onPress={() => router.push("/teams")}>
          <Ionicons name="people-outline" size={18} color={colors.muted} />
          <Text style={styles.navText}>Teams</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>

        <Text style={styles.section}>Calendars</Text>
        <Pressable style={styles.navRow} onPress={() => router.push("/calendars")}>
          <Ionicons name="calendar-outline" size={18} color={colors.muted} />
          <Text style={styles.navText}>Connected calendars</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>

        <Text style={styles.section}>Reminders</Text>
        <Pressable style={styles.navRow} onPress={() => router.push("/notifications")}>
          <Ionicons name="notifications-outline" size={18} color={colors.muted} />
          <Text style={styles.navText}>Notification channels</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>

        <Text style={styles.section}>Advanced</Text>
        <Pressable style={styles.navRow} onPress={() => router.push("/automations")}>
          <Ionicons name="flash-outline" size={18} color={colors.muted} />
          <Text style={styles.navText}>Automations</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>
        <Pressable
          style={[styles.navRow, { marginTop: 10 }]}
          onPress={() => router.push("/workflows")}
        >
          <Ionicons name="mail-outline" size={18} color={colors.muted} />
          <Text style={styles.navText}>Workflows</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>
        <Pressable
          style={[styles.navRow, { marginTop: 10 }]}
          onPress={() => router.push("/developer")}
        >
          <Ionicons name="code-slash-outline" size={18} color={colors.muted} />
          <Text style={styles.navText}>Developer &amp; API keys</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>

        <Text style={styles.section}>Connection</Text>
        <Pressable style={styles.navRow} onPress={() => router.push("/server")}>
          <Ionicons name="server-outline" size={18} color={colors.muted} />
          <Text style={styles.navText}>Server</Text>
          <Text style={styles.navValue} numberOfLines={1}>
            {serverHost()}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>

        <Pressable style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleRow(props: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => props.onChange(!props.value)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{props.label}</Text>
        {props.hint ? <Text style={styles.hint}>{props.hint}</Text> : null}
      </View>
      <View style={[styles.switch, props.value && styles.switchOn]}>
        <View style={[styles.knob, props.value && styles.knobOn]} />
      </View>
    </Pressable>
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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  switch: {
    width: 46,
    height: 28,
    borderRadius: 999,
    backgroundColor: colors.borderStrong,
    padding: 3,
    justifyContent: "center",
  },
  switchOn: { backgroundColor: colors.accent },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.white,
  },
  knobOn: { alignSelf: "flex-end" },
  inlineField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  numInput: {
    minWidth: 64,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlign: "center",
  },
  pillOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pillText: { color: colors.muted },
  swatch: { width: 36, height: 36, borderRadius: 999 },
  swatchOn: { borderWidth: 3, borderColor: colors.text },
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
  navValue: { color: colors.faint, fontSize: 13, maxWidth: 150, marginRight: 6 },
  signOut: { marginTop: 28, alignItems: "center" },
  signOutText: { color: colors.danger, fontWeight: "500" },
});
