import { ApiError, api } from "@/api";
import { ProLock, useFeature } from "@/components/pro-lock";
import { EmptyState, ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import type { Workflow } from "@/models";
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

const OFFSETS: { value: number; label: string }[] = [
  { value: 15, label: "15 min" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 1440, label: "1 day" },
  { value: 2880, label: "2 days" },
];

function humanOffset(mins: number): string {
  if (mins % 1440 === 0) return `${mins / 1440} day${mins / 1440 > 1 ? "s" : ""}`;
  if (mins % 60 === 0) return `${mins / 60} hour${mins / 60 > 1 ? "s" : ""}`;
  return `${mins} min`;
}

function describe(w: Workflow): string {
  const when = w.trigger === "after_event" ? "after the meeting" : "before the meeting";
  const scope =
    w.eventTypeIds.length === 0 ? "all events" : `${w.eventTypeIds.length} event type(s)`;
  return `Email ${humanOffset(w.offsetMinutes)} ${when} · ${scope}`;
}

export default function WorkflowsScreen() {
  const feat = useFeature("workflows");
  const { data, loading, error, reload } = useAsync<Workflow[]>(async () => {
    const res = await api.get<{ workflows: Workflow[] }>("/api/workflows");
    return res.workflows;
  });

  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<"before_event" | "after_event">("before_event");
  const [offset, setOffset] = useState(60);
  const [subject, setSubject] = useState("Reminder: {{event_title}}");
  const [body, setBody] = useState(
    "Hi {{attendee_name}},\n\nThis is a reminder about {{event_title}} on {{event_date}}.\n\nSee you then!",
  );
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!name.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await api.post("/api/workflows", {
        name,
        trigger,
        offsetMinutes: offset,
        subjectTemplate: subject,
        bodyTemplate: body,
        isActive: true,
        eventTypeIds: [],
      });
      setName("");
      reload();
    } catch (e) {
      Alert.alert("Couldn't create", e instanceof ApiError ? e.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // The workflows API replaces the whole record on update, so send every field.
  async function toggle(w: Workflow) {
    try {
      await api.put(`/api/workflows/${w.id}`, { ...w, isActive: !w.isActive });
      reload();
    } catch {
      Alert.alert("Couldn't update", "Please try again.");
    }
  }

  function confirmDelete(w: Workflow) {
    Alert.alert("Delete workflow?", w.name, [
      { text: "Keep", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.del(`/api/workflows/${w.id}`).catch(() => {});
          reload();
        },
      },
    ]);
  }

  if (!feat.loading && !feat.allowed) {
    return (
      <View style={styles.safe}>
        <Stack.Screen options={{ headerShown: true, title: "Workflows" }} />
        <ProLock feature="workflows" />
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Workflows" }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorText message={error} />
        ) : (
          <>
            {data && data.length > 0 ? (
              data.map((w) => (
                <View key={w.id} style={styles.rule}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ruleName}>{w.name}</Text>
                    <Text style={styles.ruleDesc}>{describe(w)}</Text>
                  </View>
                  <Switch value={w.isActive} onValueChange={() => toggle(w)} />
                  <Pressable onPress={() => confirmDelete(w)} hitSlop={8} style={{ marginLeft: 8 }}>
                    <Ionicons name="trash-outline" size={18} color={colors.faint} />
                  </Pressable>
                </View>
              ))
            ) : (
              <EmptyState
                title="No workflows yet"
                body="Automate a reminder before, or a follow-up after, every booking."
              />
            )}

            <Text style={styles.section}>New workflow</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Pre-meeting reminder"
              placeholderTextColor={colors.faint}
            />

            <View style={styles.pills}>
              {(["before_event", "after_event"] as const).map((tr) => (
                <Pressable
                  key={tr}
                  onPress={() => setTrigger(tr)}
                  style={[styles.pill, tr === trigger && styles.pillOn]}
                >
                  <Text style={[styles.pillText, tr === trigger && styles.pillTextOn]}>
                    {tr === "after_event" ? "After meeting" : "Before meeting"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.pills}>
              {OFFSETS.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => setOffset(o.value)}
                  style={[styles.pill, o.value === offset && styles.pillOn]}
                >
                  <Text style={[styles.pillText, o.value === offset && styles.pillTextOn]}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="Subject"
              placeholderTextColor={colors.faint}
            />
            <TextInput
              style={[styles.input, styles.multiline]}
              value={body}
              onChangeText={setBody}
              placeholder="Message"
              placeholderTextColor={colors.faint}
              multiline
            />
            <Text style={styles.hint}>
              Variables: {"{{attendee_name}}"} {"{{event_title}}"} {"{{event_date}}"}{" "}
              {"{{meeting_url}}"}
            </Text>

            <Pressable
              style={styles.save}
              onPress={add}
              disabled={saving || !name.trim() || !body.trim()}
            >
              <Text style={styles.saveText}>{saving ? "Adding…" : "Add workflow"}</Text>
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
  multiline: { minHeight: 110, textAlignVertical: "top" },
  hint: { color: colors.faint, fontSize: 12, marginTop: -4, marginBottom: 14 },
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
  save: {
    marginTop: 6,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveText: { color: colors.white, fontWeight: "600", fontSize: 15 },
});
