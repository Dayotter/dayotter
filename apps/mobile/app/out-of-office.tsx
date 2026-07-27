import { ApiError, api } from "@/api";
import { ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

interface Teammate {
  id: string;
  name: string | null;
  handle: string | null;
}
interface Period {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  delegate: Teammate | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function delegateName(t: Teammate) {
  return t.name ?? (t.handle ? `@${t.handle}` : "Teammate");
}

/** First-class out-of-office (#102): block a date range and optionally redirect
 *  new bookings to a teammate while away. Mirrors the web Availability panel. */
export default function OutOfOfficeScreen() {
  const { data, loading, error, reload } = useAsync<{
    periods: Period[];
    teammates: Teammate[];
  }>(async () => {
    return api.get<{ periods: Period[]; teammates: Teammate[] }>("/api/out-of-office");
  }, []);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [delegateId, setDelegateId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function add() {
    setFormError(null);
    if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate) || endDate < startDate) {
      setFormError("Enter From and To as YYYY-MM-DD, with To on or after From.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/out-of-office", {
        startDate,
        endDate,
        reason: reason.trim() || undefined,
        delegateUserId: delegateId || null,
      });
      setStartDate("");
      setEndDate("");
      setReason("");
      setDelegateId("");
      reload();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Couldn't save that period.");
    } finally {
      setSaving(false);
    }
  }

  function remove(id: string) {
    Alert.alert("Remove period?", "This unblocks those dates.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api.del(`/api/out-of-office/${id}`);
            reload();
          } catch {
            Alert.alert("Couldn't remove", "Please try again.");
          }
        },
      },
    ]);
  }

  const teammates = data?.teammates ?? [];

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Out of office" }} />
      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <ErrorText message={error} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>
            Mark yourself away for a date range - bookers can't schedule then. Optionally send them
            to a teammate.
          </Text>

          {data && data.periods.length > 0 ? (
            data.periods.map((p) => (
              <View key={p.id} style={styles.row}>
                <Ionicons name="airplane-outline" size={18} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {p.startDate}
                    {p.endDate !== p.startDate ? ` – ${p.endDate}` : ""}
                  </Text>
                  {p.reason || p.delegate ? (
                    <Text style={styles.rowSub}>
                      {p.reason ?? ""}
                      {p.reason && p.delegate ? " · " : ""}
                      {p.delegate ? `→ ${delegateName(p.delegate)}` : ""}
                    </Text>
                  ) : null}
                </View>
                <Pressable onPress={() => remove(p.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.faint} />
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>You're not marked away for any dates.</Text>
          )}

          <Text style={styles.section}>Add a period</Text>
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>From</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="2026-08-01"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                maxLength={10}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>To</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="2026-08-05"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                maxLength={10}
              />
            </View>
          </View>
          <Text style={styles.label}>Reason (optional)</Text>
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder="Annual leave"
            placeholderTextColor={colors.faint}
            maxLength={200}
          />
          {teammates.length > 0 ? (
            <>
              <Text style={styles.label}>Redirect bookings to (optional)</Text>
              <View style={styles.pills}>
                <Pressable
                  onPress={() => setDelegateId("")}
                  style={[styles.chip, delegateId === "" && styles.chipOn]}
                >
                  <Text style={[styles.chipText, delegateId === "" && styles.chipTextOn]}>
                    No redirect
                  </Text>
                </Pressable>
                {teammates.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => setDelegateId(t.id)}
                    style={[styles.chip, delegateId === t.id && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, delegateId === t.id && styles.chipTextOn]}>
                      {delegateName(t)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.hint}>Join a team to redirect bookings while you're away.</Text>
          )}
          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          <Pressable style={styles.save} onPress={add} disabled={saving}>
            <Text style={styles.saveText}>{saving ? "Saving…" : "Add period"}</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  hint: { color: colors.muted, fontSize: 13, marginBottom: 16 },
  empty: { color: colors.muted, fontSize: 14, marginVertical: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 10,
  },
  rowTitle: { color: colors.text, fontWeight: "600", fontSize: 14 },
  rowSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  section: { fontWeight: "700", fontSize: 16, color: colors.text, marginTop: 20, marginBottom: 12 },
  dateRow: { flexDirection: "row", gap: 12 },
  label: { fontWeight: "500", fontSize: 14, marginBottom: 6, marginTop: 12, color: colors.text },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
  error: { color: colors.danger, marginTop: 14 },
  save: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveText: { color: colors.white, fontWeight: "600", fontSize: 15 },
});
