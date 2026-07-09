import { ApiError, api } from "@/api";
import { EmptyState, ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import type { AutomationRule } from "@/models";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState } from "react";
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

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ACTIONS: { value: string; label: string }[] = [
  { value: "prep_block", label: "Prep before" },
  { value: "buffer_after", label: "Buffer after" },
  { value: "followup", label: "Follow-up" },
];

function describe(r: AutomationRule): string {
  if (r.trigger === "weekly") {
    const day = r.dayOfWeek != null ? DAYS[r.dayOfWeek] : "weekly";
    return `Every ${day}, block ${r.windowStart}–${r.windowEnd}`;
  }
  const when = r.matchTitle ? `“${r.matchTitle}” bookings` : "any booking";
  const what =
    r.action === "buffer_after"
      ? `${r.offsetMinutes}-min buffer after`
      : r.action === "followup"
        ? `follow-up ${r.offsetMinutes} min after`
        : `${r.offsetMinutes}-min prep before`;
  return `On ${when}: ${what}`;
}

export default function AutomationsScreen() {
  const { data, loading, error, reload } = useAsync<AutomationRule[]>(async () => {
    const res = await api.get<{ rules: AutomationRule[] }>("/api/automations");
    return res.rules;
  });

  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<"booking_created" | "weekly">("booking_created");
  const [matchTitle, setMatchTitle] = useState("");
  const [action, setAction] = useState("prep_block");
  const [offset, setOffset] = useState("15");
  const [dayOfWeek, setDayOfWeek] = useState(5);
  const [windowStart, setWindowStart] = useState("13:00");
  const [windowEnd, setWindowEnd] = useState("17:00");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const bodyPayload =
        trigger === "weekly"
          ? { name, trigger, dayOfWeek, windowStart, windowEnd, blockTitle: name }
          : {
              name,
              trigger,
              matchTitle: matchTitle.trim() || null,
              action,
              offsetMinutes: Number(offset) || 15,
            };
      await api.post("/api/automations", bodyPayload);
      setName("");
      setMatchTitle("");
      reload();
    } catch (e) {
      Alert.alert("Couldn't create", e instanceof ApiError ? e.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(r: AutomationRule) {
    try {
      await api.patch(`/api/automations/${r.id}`, { enabled: !r.enabled });
      reload();
    } catch {
      Alert.alert("Couldn't update", "Please try again.");
    }
  }

  function confirmDelete(r: AutomationRule) {
    Alert.alert("Delete rule?", r.name, [
      { text: "Keep", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.del(`/api/automations/${r.id}`).catch(() => {});
          reload();
        },
      },
    ]);
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Automations" }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorText message={error} />
        ) : (
          <>
            {data && data.length > 0 ? (
              data.map((r) => (
                <View key={r.id} style={styles.rule}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ruleName}>{r.name}</Text>
                    <Text style={styles.ruleDesc}>{describe(r)}</Text>
                  </View>
                  <Switch value={r.enabled} onValueChange={() => toggle(r)} />
                  <Pressable onPress={() => confirmDelete(r)} hitSlop={8} style={{ marginLeft: 8 }}>
                    <Ionicons name="trash-outline" size={18} color={colors.faint} />
                  </Pressable>
                </View>
              ))
            ) : (
              <EmptyState title="No rules yet" body="Protect prep time or block recurring focus." />
            )}

            <Text style={styles.section}>New rule</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Rule name"
              placeholderTextColor={colors.faint}
            />

            <View style={styles.pills}>
              {(["booking_created", "weekly"] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTrigger(t)}
                  style={[styles.pill, t === trigger && styles.pillOn]}
                >
                  <Text style={[styles.pillText, t === trigger && styles.pillTextOn]}>
                    {t === "weekly" ? "Every week" : "When booked"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {trigger === "booking_created" ? (
              <>
                <TextInput
                  style={styles.input}
                  value={matchTitle}
                  onChangeText={setMatchTitle}
                  placeholder="Title contains (blank = all)"
                  placeholderTextColor={colors.faint}
                />
                <View style={styles.pills}>
                  {ACTIONS.map((a) => (
                    <Pressable
                      key={a.value}
                      onPress={() => setAction(a.value)}
                      style={[styles.pill, a.value === action && styles.pillOn]}
                    >
                      <Text style={[styles.pillText, a.value === action && styles.pillTextOn]}>
                        {a.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.inline}>
                  <Text style={styles.inlineLabel}>Minutes</Text>
                  <TextInput
                    style={styles.numInput}
                    value={offset}
                    onChangeText={(v) => setOffset(v.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.dayRow}>
                  {DAYS.map((d, i) => (
                    <Pressable
                      key={d}
                      onPress={() => setDayOfWeek(i)}
                      style={[styles.dayPill, i === dayOfWeek && styles.pillOn]}
                    >
                      <Text style={[styles.dayText, i === dayOfWeek && styles.pillTextOn]}>{d}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.inline}>
                  <Text style={styles.inlineLabel}>From</Text>
                  <TextInput
                    style={styles.numInput}
                    value={windowStart}
                    onChangeText={setWindowStart}
                    placeholder="13:00"
                    placeholderTextColor={colors.faint}
                  />
                  <Text style={styles.inlineLabel}>To</Text>
                  <TextInput
                    style={styles.numInput}
                    value={windowEnd}
                    onChangeText={setWindowEnd}
                    placeholder="17:00"
                    placeholderTextColor={colors.faint}
                  />
                </View>
              </>
            )}

            <Pressable style={styles.save} onPress={add} disabled={saving || !name.trim()}>
              <Text style={styles.saveText}>{saving ? "Adding…" : "Add rule"}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  rule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  ruleName: { color: colors.text, fontWeight: "600" },
  ruleDesc: { color: colors.muted, fontSize: 12, marginTop: 2 },
  section: { marginTop: 18, marginBottom: 10, fontWeight: "600", color: colors.muted },
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
    marginBottom: 12,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
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
  dayRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
  dayPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 8,
    alignItems: "center",
  },
  dayText: { color: colors.muted, fontSize: 11 },
  inline: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  inlineLabel: { color: colors.text, fontSize: 14 },
  numInput: {
    minWidth: 70,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlign: "center",
  },
  save: {
    marginTop: 6,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveText: { color: colors.white, fontWeight: "600", fontSize: 15 },
});
