import { ApiError, api } from "@/api";
import { BrandMark } from "@/components/brand-mark";
import { formatDateTime } from "@/format";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Speech from "expo-speech";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const EXAMPLES = [
  "Hold two hours for deep work tomorrow",
  "Book a 30-min call with Sam Thursday 2pm",
  "Move my 3pm to tomorrow",
  "Am I free Friday afternoon?",
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
type Phase = "idle" | "listening" | "thinking" | "draft" | "done";

/**
 * Ask DayOtter, everywhere. A floating orb that's one tap from any screen; it
 * opens a voice-first sheet - tap the big orb and talk, watch the words appear,
 * and Otter proposes a change and speaks it back. Confirm-first: nothing happens
 * until you approve. Renders nothing unless the server has AI enabled.
 */
export function OtterLauncher() {
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

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

  if (!enabled) return null;

  return (
    <>
      {/* Sits above the tab bar on tab screens; clears the bottom inset elsewhere. */}
      <Pressable
        style={[styles.fab, { bottom: (insets.bottom || 12) + 74 }]}
        onPress={() => setOpen(true)}
        accessibilityLabel="Ask DayOtter"
      >
        <BrandMark size={26} />
        <Text style={styles.fabText}>Ask</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <OtterSheet onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function OtterSheet({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [pickedStart, setPickedStart] = useState<Date | null>(null);
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);

  const listening = phase === "listening";
  const submitRef = useRef<(t?: string) => void>(() => {});
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // Pulsing rings around the orb while listening.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!listening) return;
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(0);
    };
  }, [listening, pulse]);

  // Stop any speech/recognition when the sheet unmounts.
  useEffect(
    () => () => {
      Speech.stop();
      ExpoSpeechRecognitionModule.stop();
    },
    [],
  );

  function say(message: string) {
    if (mutedRef.current) return;
    Speech.stop();
    Speech.speak(message, { rate: 1.0, pitch: 1.05 });
  }

  useSpeechRecognitionEvent("start", () => setPhase("listening"));
  useSpeechRecognitionEvent("end", () => setPhase((p) => (p === "listening" ? "idle" : p)));
  useSpeechRecognitionEvent("error", () => setPhase("idle"));
  useSpeechRecognitionEvent("result", (e) => {
    const transcript = e.results?.[0]?.transcript?.trim();
    if (!transcript) return;
    setText(transcript);
    if (e.isFinal) submitRef.current(transcript);
  });

  async function toggleVoice() {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    Speech.stop();
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setError("Microphone access is needed for voice.");
        return;
      }
      setError(null);
      setDone(null);
      resetDraft();
      ExpoSpeechRecognitionModule.start({ lang: "en-US", interimResults: true, continuous: false });
    } catch {
      setError("Couldn't start voice input.");
    }
  }

  function resetDraft() {
    setDraft(null);
    setTarget(null);
    setPickedStart(null);
    setPicker(null);
  }

  function onPick(event: { type: string }, date?: Date) {
    if (event.type === "dismissed" || !date) {
      setPicker(null);
      return;
    }
    if (picker === "date") {
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
    setPhase("thinking");
    setError(null);
    setDone(null);
    resetDraft();
    try {
      const data = await api.post<{ draft: Draft; target: Target | null }>("/api/ai/command", {
        text: input,
      });
      const d = data.draft;
      if (!d.understood || d.intent === "none") {
        setError(d.message || "I can only help with scheduling.");
        setPhase("idle");
        say(d.message || "I can only help with scheduling.");
      } else {
        setDraft(d);
        setTarget(data.target);
        const iso = d.intent === "reschedule" ? d.newStartISO : d.startISO;
        const seed = iso ? new Date(iso) : null;
        setPickedStart(seed && !Number.isNaN(seed.getTime()) ? seed : null);
        setPhase("draft");
        say(spokenSummary(d, data.target));
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong";
      setError(msg);
      setPhase("idle");
    }
  }
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

  function finish(msg: string) {
    resetDraft();
    setText("");
    setDone(msg);
    setPhase("done");
    say(msg);
  }

  const orbHint =
    phase === "listening"
      ? "Listening…"
      : phase === "thinking"
        ? "Thinking…"
        : phase === "draft"
          ? "Review below, then confirm."
          : phase === "done"
            ? "Done. Tap to ask again."
            : "Tap the orb and talk.";

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  const cancelStyle = draft?.intent === "cancel";

  return (
    <View style={styles.backdrop}>
      <Pressable style={styles.backdropTap} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 12 }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <BrandMark size={20} />
          <Text style={styles.headerTitle}>Ask DayOtter</Text>
          <Pressable onPress={() => setMuted((m) => !m)} hitSlop={10} style={styles.headerBtn}>
            <Ionicons
              name={muted ? "volume-mute-outline" : "volume-high-outline"}
              size={18}
              color={colors.muted}
            />
          </Pressable>
          <Pressable onPress={onClose} hitSlop={10} style={styles.headerBtn}>
            <Ionicons name="close" size={20} color={colors.muted} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* The orb */}
          <View style={styles.orbWrap}>
            {listening ? (
              <Animated.View
                style={[styles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
              />
            ) : null}
            <Pressable
              style={[styles.orb, listening && styles.orbActive]}
              onPress={toggleVoice}
              accessibilityLabel={listening ? "Stop listening" : "Talk to Otter"}
            >
              {phase === "thinking" ? (
                <ActivityIndicator color={colors.white} size="large" />
              ) : (
                <Ionicons name={listening ? "stop" : "mic"} size={34} color={colors.white} />
              )}
            </Pressable>
          </View>
          <Text style={styles.hint}>{orbHint}</Text>

          {/* Live transcript */}
          {text.length > 0 && phase !== "done" ? (
            <Text style={styles.transcript}>“{text}”</Text>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {done ? (
            <View style={styles.doneRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.done}>{done}</Text>
            </View>
          ) : null}

          {/* Confirm-first draft */}
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
                <Pressable style={styles.discard} onPress={resetDraft} disabled={busy}>
                  <Text style={styles.discardText}>{cancelStyle ? "Keep it" : "Discard"}</Text>
                </Pressable>
              </View>
              {picker ? (
                <DateTimePicker value={pickedStart ?? new Date()} mode={picker} onChange={onPick} />
              ) : null}
            </View>
          ) : null}

          {/* Idle examples */}
          {!draft && phase !== "thinking" && !done ? (
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
        </ScrollView>

        {/* Text fallback */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="…or type a request"
            placeholderTextColor={colors.faint}
            returnKeyType="go"
            onSubmitEditing={() => submit()}
          />
          <Pressable style={styles.go} onPress={() => submit()}>
            <Ionicons name="arrow-up" size={20} color={colors.white} />
          </Pressable>
        </View>
        <Text style={styles.foot}>
          Otter proposes · you confirm first · nothing sends on its own
        </Text>
      </View>
    </View>
  );
}

function spokenSummary(d: Draft, target: Target | null): string {
  if (d.intent === "create") return `${d.title}. Confirm to add it?`;
  if (d.intent === "reschedule" && target) return `Move ${target.title}. Confirm?`;
  if (d.intent === "cancel" && target) return `Cancel ${target.title}?`;
  return d.message || "";
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 7,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    zIndex: 50,
  },
  fabText: { color: colors.text, fontWeight: "700", fontSize: 14 },

  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  backdropTap: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "88%",
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.borderStrong,
    marginBottom: 12,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.text },
  headerBtn: { padding: 4 },
  body: { alignItems: "center", paddingVertical: 18 },

  orbWrap: { width: 128, height: 128, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  orb: {
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  orbActive: { backgroundColor: colors.danger, shadowColor: colors.danger },
  hint: { color: colors.muted, fontSize: 14, marginTop: 14, textAlign: "center" },
  transcript: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 24,
  },
  error: { color: colors.danger, marginTop: 14, fontSize: 14, textAlign: "center" },
  doneRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  done: { color: colors.success, fontSize: 14, fontWeight: "500" },

  card: {
    alignSelf: "stretch",
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 16,
  },
  cardKind: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardTitle: { color: colors.text, fontWeight: "600", fontSize: 17, marginTop: 4 },
  cardWhen: { color: colors.muted, fontSize: 14 },
  timeEdit: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  cardWho: { color: colors.muted, fontSize: 13, marginTop: 4 },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  confirm: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
  },
  confirmText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  discard: {
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  discardText: { color: colors.muted, fontWeight: "500" },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 22,
    justifyContent: "center",
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  chipText: { color: colors.muted, fontSize: 12 },

  inputRow: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 6 },
  input: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  go: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  foot: { color: colors.faint, fontSize: 11, textAlign: "center", marginTop: 10 },
});
