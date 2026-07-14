import { ApiError, api } from "@/api";
import { formatDateTime } from "@/format";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

/** Tappable example prompts - teach the voice/text vocabulary at a glance. */
const EXAMPLES = [
  "Hold two hours for deep work tomorrow",
  "Book a 30-min call with Sam Thursday 2pm",
  "Move my 3pm to tomorrow",
];

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
 * "Ask DayOtter" - natural-language command bar (create / reschedule / cancel),
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
  // User-edited start time (overrides the AI's proposed time before confirming).
  const [pickedStart, setPickedStart] = useState<Date | null>(null);
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  const [listening, setListening] = useState(false);

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

  // Voice input (on-device speech recognition). The result handler runs the same
  // confirm-first command flow as typing; a ref keeps it pointed at the latest
  // submit closure so it never fires with stale state.
  const submitRef = useRef<(override?: string) => void>(() => {});
  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("error", () => setListening(false));
  useSpeechRecognitionEvent("result", (e) => {
    const transcript = e.results?.[0]?.transcript?.trim();
    if (!transcript) return;
    // Show the words as they're spoken (interim), and only run the command once
    // the recognizer marks the result final - so it feels live but fires once.
    setText(transcript);
    if (e.isFinal) submitRef.current(transcript);
  });

  async function toggleVoice() {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setError("Microphone access is needed for voice commands.");
        return;
      }
      setError(null);
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        continuous: false,
      });
    } catch {
      setError("Couldn't start voice input.");
    }
  }

  function reset() {
    setDraft(null);
    setTarget(null);
    setPickedStart(null);
    setPicker(null);
  }

  // Two-step native picker (date → time) so it works the same on iOS + Android.
  function onPick(event: { type: string }, date?: Date) {
    if (event.type === "dismissed" || !date) {
      setPicker(null);
      return;
    }
    if (picker === "date") {
      // Keep the current time-of-day, swap the date, then ask for the time.
      const base = pickedStart ?? new Date();
      const merged = new Date(date);
      merged.setHours(base.getHours(), base.getMinutes(), 0, 0);
      setPickedStart(merged);
      setPicker("time");
    } else {
      setPickedStart(date);
      setPicker(null);
    }
  }

  async function submit(override?: string) {
    const input = (typeof override === "string" ? override : text).trim();
    if (!input) return;
    setLoading(true);
    setError(null);
    setDone(null);
    reset();
    try {
      const data = await api.post<{ draft: Draft; target: Target | null }>("/api/ai/command", {
        text: input,
      });
      const d = data.draft;
      if (!d.understood || d.intent === "none") {
        setError(d.message || "I can only help with scheduling.");
      } else {
        setDraft(d);
        setTarget(data.target);
        // Seed the editable time from the AI's proposal (create/reschedule).
        const iso = d.intent === "reschedule" ? d.newStartISO : d.startISO;
        const seed = iso ? new Date(iso) : null;
        setPickedStart(seed && !Number.isNaN(seed.getTime()) ? seed : null);
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

  // Keep the voice result handler bound to the current-render submit closure.
  submitRef.current = submit;

  async function confirm() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const startISO = pickedStart ? pickedStart.toISOString() : draft.startISO;
      if (draft.intent === "create") {
        await api.post("/api/ai/schedule/create", {
          title: draft.title,
          startISO,
          durationMinutes: draft.durationMinutes,
          notes: draft.notes || undefined,
          attendees: draft.attendees,
        });
        finish("Added to your calendar.");
      } else if (draft.intent === "reschedule" && target) {
        const newStart = pickedStart ? pickedStart.toISOString() : draft.newStartISO;
        await api.post(`/api/bookings/${target.uid}/reschedule`, { start: newStart });
        finish("Rescheduled - attendees notified.");
      } else if (draft.intent === "cancel" && target) {
        await api.post(`/api/bookings/${target.uid}/cancel`, {});
        finish("Cancelled - attendees notified.");
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
        <Text style={styles.title}>Ask DayOtter</Text>
        <Text style={styles.hint}>you confirm first</Text>
      </View>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={listening ? "Listening…" : "Move my 3pm to tomorrow…"}
          placeholderTextColor={colors.faint}
          returnKeyType="go"
          onSubmitEditing={() => submit()}
        />
        <Pressable
          style={[styles.mic, listening && styles.micActive]}
          onPress={toggleVoice}
          accessibilityLabel={listening ? "Stop listening" : "Speak a command"}
        >
          <Ionicons
            name={listening ? "mic" : "mic-outline"}
            size={20}
            color={listening ? colors.danger : colors.muted}
          />
        </Pressable>
        <Pressable style={styles.go} onPress={() => submit()} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.goText}>Go</Text>
          )}
        </Pressable>
      </View>

      {!draft && !loading && text.length === 0 && !done ? (
        <View style={styles.chips}>
          {EXAMPLES.map((ex) => (
            <Pressable
              key={ex}
              style={styles.chip}
              onPress={() => {
                setText(ex);
                submit(ex);
              }}
            >
              <Text style={styles.chipText}>{ex}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {done ? <Text style={styles.done}>{done}</Text> : null}

      {draft ? (
        <View style={styles.card}>
          {draft.intent === "create" ? (
            <>
              <Text style={styles.cardKind}>{draft.kind}</Text>
              <Text style={styles.cardTitle}>{draft.title}</Text>
              <Pressable style={styles.timeEdit} onPress={() => setPicker("date")}>
                <Text style={styles.cardWhen}>
                  {formatDateTime((pickedStart ?? new Date(draft.startISO)).toISOString())} ·{" "}
                  {draft.durationMinutes} min
                </Text>
                <Ionicons name="pencil" size={13} color={colors.accent} />
              </Pressable>
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
              <Pressable style={styles.timeEdit} onPress={() => setPicker("date")}>
                <Text style={styles.cardWhen}>
                  {formatDateTime(target.startISO)} →{" "}
                  {formatDateTime((pickedStart ?? new Date(draft.newStartISO)).toISOString())}
                </Text>
                <Ionicons name="pencil" size={13} color={colors.accent} />
              </Pressable>
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

          {picker ? (
            <DateTimePicker value={pickedStart ?? new Date()} mode={picker} onChange={onPick} />
          ) : null}
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
  mic: {
    width: 44,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  micActive: { borderColor: colors.danger, backgroundColor: `${colors.danger}14` },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: { color: colors.muted, fontSize: 12 },
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
  cardWhen: { color: colors.muted, fontSize: 13 },
  timeEdit: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
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
