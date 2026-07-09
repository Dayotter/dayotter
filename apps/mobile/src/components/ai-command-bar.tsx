import { ApiError, api } from "@/api";
import { formatDateTime } from "@/format";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type Intent = "create" | "reschedule" | "cancel" | "none";
interface Draft {
  understood: boolean;
  intent: Intent;
  kind: "meeting" | "focus" | "reminder";
  title: string;
  startISO: string;
  durationMinutes: number;
  attendees: { name: string; email: string }[];
  notes: string;
  newStartISO: string;
  message: string;
}
interface Target {
  uid: string;
  title: string;
  startISO: string;
}

/**
 * "Ask calSync" — natural-language command bar (create / reschedule / cancel),
 * confirm-first. Renders nothing unless the server has AI enabled. The AI only
 * proposes; the user confirms before anything happens.
 */
export function AiCommandBar({ onDone }: { onDone?: () => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [target, setTarget] = useState<Target | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<{ aiEnabled: boolean }>("/api/me")
      .then((d) => active && setEnabled(Boolean(d.aiEnabled)))
      .catch(() => active && setEnabled(false));
    return () => {
      active = false;
    };
  }, []);

  function reset() {
    setDraft(null);
    setTarget(null);
  }

  async function submit() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setDone(null);
    reset();
    try {
      const data = await api.post<{ draft: Draft; target: Target | null }>("/api/ai/command", {
        text,
      });
      const d = data.draft;
      if (!d.understood || d.intent === "none") {
        setError(d.message || "I can only help with scheduling.");
      } else {
        setDraft(d);
        setTarget(data.target);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function finish(msg: string) {
    reset();
    setText("");
    setDone(msg);
    onDone?.();
  }

  async function confirm() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      if (draft.intent === "create") {
        await api.post("/api/ai/schedule/create", {
          title: draft.title,
          startISO: draft.startISO,
          durationMinutes: draft.durationMinutes,
          notes: draft.notes || undefined,
          attendees: draft.attendees,
        });
        finish("Added to your calendar.");
      } else if (draft.intent === "reschedule" && target) {
        await api.post(`/api/bookings/${target.uid}/reschedule`, { start: draft.newStartISO });
        finish("Rescheduled — attendees notified.");
      } else if (draft.intent === "cancel" && target) {
        await api.post(`/api/bookings/${target.uid}/cancel`, {});
        finish("Cancelled — attendees notified.");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't complete that.");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return null;

  const cancelStyle = draft?.intent === "cancel";

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Ionicons name="sparkles" size={15} color={colors.accent} />
        <Text style={styles.title}>Ask calSync</Text>
        <Text style={styles.hint}>you confirm first</Text>
      </View>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Move my 3pm to tomorrow…"
          placeholderTextColor={colors.faint}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Pressable style={styles.go} onPress={submit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.goText}>Go</Text>
          )}
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {done ? <Text style={styles.done}>{done}</Text> : null}

      {draft ? (
        <View style={styles.card}>
          {draft.intent === "create" ? (
            <>
              <Text style={styles.cardKind}>{draft.kind}</Text>
              <Text style={styles.cardTitle}>{draft.title}</Text>
              <Text style={styles.cardWhen}>
                {formatDateTime(draft.startISO)} · {draft.durationMinutes} min
              </Text>
              {draft.attendees.length ? (
                <Text style={styles.cardWho}>
                  With {draft.attendees.map((a) => a.name || a.email).join(", ")}
                </Text>
              ) : null}
            </>
          ) : draft.intent === "reschedule" && target ? (
            <>
              <Text style={styles.cardKind}>Reschedule</Text>
              <Text style={styles.cardTitle}>{target.title}</Text>
              <Text style={styles.cardWhen}>
                {formatDateTime(target.startISO)} → {formatDateTime(draft.newStartISO)}
              </Text>
            </>
          ) : draft.intent === "cancel" && target ? (
            <>
              <Text style={[styles.cardKind, { color: colors.danger }]}>Cancel</Text>
              <Text style={styles.cardTitle}>{target.title}</Text>
              <Text style={styles.cardWhen}>{formatDateTime(target.startISO)}</Text>
            </>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={[styles.confirm, cancelStyle && { backgroundColor: colors.danger }]}
              onPress={confirm}
              disabled={busy}
            >
              <Text style={styles.confirmText}>
                {busy
                  ? "Working…"
                  : draft.intent === "create"
                    ? "Add to calendar"
                    : draft.intent === "reschedule"
                      ? "Reschedule"
                      : "Cancel meeting"}
              </Text>
            </Pressable>
            <Pressable style={styles.discard} onPress={reset} disabled={busy}>
              <Text style={styles.discardText}>{cancelStyle ? "Keep it" : "Discard"}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    backgroundColor: colors.surface,
    marginBottom: 6,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  title: { fontWeight: "600", color: colors.text, fontSize: 14 },
  hint: { color: colors.faint, fontSize: 11, marginLeft: "auto" },
  inputRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  go: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 56,
  },
  goText: { color: colors.white, fontWeight: "600" },
  error: { color: colors.danger, marginTop: 10, fontSize: 13 },
  done: { color: colors.success, marginTop: 10, fontSize: 13 },
  card: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    padding: 14,
  },
  cardKind: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardTitle: { color: colors.text, fontWeight: "600", fontSize: 16, marginTop: 4 },
  cardWhen: { color: colors.muted, fontSize: 13, marginTop: 3 },
  cardWho: { color: colors.muted, fontSize: 12, marginTop: 3 },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  confirm: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: "center",
  },
  confirmText: { color: colors.white, fontWeight: "600" },
  discard: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  discardText: { color: colors.muted, fontWeight: "500" },
});
