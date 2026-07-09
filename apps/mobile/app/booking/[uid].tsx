import { ApiError, api } from "@/api";
import { Badge, ErrorText, Loading } from "@/components/ui";
import { formatDateTime } from "@/format";
import { useAsync } from "@/hooks";
import type { BookingDetail } from "@/models";
import { colors, radius, statusColor } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface Slot {
  start: string;
  end: string;
}

export default function BookingDetailScreen() {
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const [cancelling, setCancelling] = useState(false);
  const [notifying, setNotifying] = useState<"late" | "next" | null>(null);
  const [markingNoShow, setMarkingNoShow] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const { data, loading, error, reload } = useAsync<BookingDetail>(async () => {
    const res = await api.get<{ booking: BookingDetail }>(`/api/bookings/${uid}`);
    return res.booking;
  }, [uid]);

  const isPast = data ? new Date(data.endsAt).getTime() < Date.now() : false;

  function confirmCancel() {
    Alert.alert("Cancel booking?", "This notifies everyone and frees the time.", [
      { text: "Keep it", style: "cancel" },
      { text: "Cancel booking", style: "destructive", onPress: doCancel },
    ]);
  }

  async function doCancel() {
    setCancelling(true);
    try {
      await api.post(`/api/bookings/${uid}/cancel`, {});
      reload();
    } catch {
      Alert.alert("Could not cancel", "Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  async function runningLate() {
    setNotifying("late");
    try {
      await api.post(`/api/bookings/${uid}/running-late`, {});
      Alert.alert("Attendees notified", "We let this meeting's attendees know you're running late.");
    } catch {
      Alert.alert("Couldn't notify", "Please try again.");
    } finally {
      setNotifying(null);
    }
  }

  async function notifyNext() {
    setNotifying("next");
    try {
      await api.post(`/api/bookings/${uid}/notify-next`, {});
      Alert.alert("Next meeting notified", "We let your back-to-back meeting know you may be late.");
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 409
          ? "You have no back-to-back meeting to notify."
          : "Please try again.";
      Alert.alert("Couldn't notify", msg);
    } finally {
      setNotifying(null);
    }
  }

  async function toggleNoShow() {
    if (!data) return;
    const next = data.status !== "no_show";
    setMarkingNoShow(true);
    try {
      await api.post(`/api/bookings/${uid}/no-show`, { noShow: next });
      reload();
    } catch {
      Alert.alert("Couldn't update", "Please try again.");
    } finally {
      setMarkingNoShow(false);
    }
  }

  async function openReschedule() {
    if (!data) return;
    setRescheduling(true);
    if (slots) return;
    setSlotsLoading(true);
    try {
      const from = new Date().toISOString();
      const to = new Date(Date.now() + 14 * 86_400_000).toISOString();
      const res = await api.get<{ slots: Slot[] }>(
        `/api/availability/${data.eventTypeId}?from=${from}&to=${to}`,
      );
      setSlots(res.slots.slice(0, 40));
    } catch {
      Alert.alert("Couldn't load times", "Please try again.");
      setRescheduling(false);
    } finally {
      setSlotsLoading(false);
    }
  }

  function confirmReschedule(slot: Slot) {
    Alert.alert("Move to this time?", formatDateTime(slot.start), [
      { text: "Back", style: "cancel" },
      {
        text: "Reschedule",
        onPress: async () => {
          try {
            await api.post(`/api/bookings/${uid}/reschedule`, { start: slot.start });
            setRescheduling(false);
            setSlots(null);
            reload();
          } catch (e) {
            const msg =
              e instanceof ApiError && e.status === 409
                ? "That time was just taken. Pick another."
                : "Please try again.";
            Alert.alert("Couldn't reschedule", msg);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Booking" }} />
      {loading && !data ? (
        <Loading />
      ) : error || !data ? (
        <ErrorText message={error ?? "Not found"} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.top}>
            <Badge label={data.status} color={statusColor[data.status] ?? colors.muted} />
          </View>
          <Text style={styles.title}>{data.title}</Text>
          {data.hostName ? <Text style={styles.host}>with {data.hostName}</Text> : null}

          <View style={styles.card}>
            <Row icon="time-outline" text={`${formatDateTime(data.startsAt)}  (${data.timezone})`} />
            {data.attendees.length > 0 ? (
              <Row
                icon="people-outline"
                text={data.attendees.map((a) => a.name ?? a.email).join(", ")}
              />
            ) : null}
            {data.meetingUrl ? (
              <Pressable onPress={() => data.meetingUrl && Linking.openURL(data.meetingUrl)}>
                <Row icon="videocam-outline" text="Join the call" accent />
              </Pressable>
            ) : null}
          </View>

          {/* Upcoming confirmed meeting: running-late, reschedule, cancel. */}
          {data.status === "confirmed" && !isPast ? (
            <>
              <View style={styles.actions}>
                <Pressable style={styles.action} onPress={runningLate} disabled={notifying !== null}>
                  <Ionicons name="time-outline" size={16} color={colors.text} />
                  <Text style={styles.actionText}>
                    {notifying === "late" ? "Notifying…" : "I'm running late"}
                  </Text>
                </Pressable>
                <Pressable style={styles.action} onPress={notifyNext} disabled={notifying !== null}>
                  <Ionicons name="arrow-forward-outline" size={16} color={colors.text} />
                  <Text style={styles.actionText}>
                    {notifying === "next" ? "Notifying…" : "Tell my next meeting"}
                  </Text>
                </Pressable>
              </View>

              {rescheduling ? (
                <View style={styles.slotBox}>
                  <Text style={styles.slotHeader}>Pick a new time</Text>
                  {slotsLoading ? (
                    <Text style={styles.slotEmpty}>Loading…</Text>
                  ) : slots && slots.length > 0 ? (
                    slots.map((s) => (
                      <Pressable
                        key={s.start}
                        style={styles.slotRow}
                        onPress={() => confirmReschedule(s)}
                      >
                        <Text style={styles.slotText}>{formatDateTime(s.start)}</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.faint} />
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.slotEmpty}>No open times in the next two weeks.</Text>
                  )}
                  <Pressable onPress={() => setRescheduling(false)} style={styles.slotCancel}>
                    <Text style={styles.backText}>Close</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.reschedule} onPress={openReschedule}>
                  <Ionicons name="calendar-outline" size={16} color={colors.text} />
                  <Text style={styles.actionText}>Reschedule</Text>
                </Pressable>
              )}

              <Pressable style={styles.cancel} onPress={confirmCancel} disabled={cancelling}>
                <Text style={styles.cancelText}>{cancelling ? "Cancelling…" : "Cancel booking"}</Text>
              </Pressable>
            </>
          ) : null}

          {/* Past meeting: no-show toggle. */}
          {isPast && (data.status === "confirmed" || data.status === "no_show") ? (
            <Pressable style={styles.reschedule} onPress={toggleNoShow} disabled={markingNoShow}>
              <Ionicons
                name={data.status === "no_show" ? "arrow-undo-outline" : "person-remove-outline"}
                size={16}
                color={colors.text}
              />
              <Text style={styles.actionText}>
                {markingNoShow
                  ? "Saving…"
                  : data.status === "no_show"
                    ? "Undo no-show"
                    : "Mark as no-show"}
              </Text>
            </Pressable>
          ) : null}

          <Pressable style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backText}>Back to bookings</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function Row({
  icon,
  text,
  accent,
}: { icon: keyof typeof Ionicons.glyphMap; text: string; accent?: boolean }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={17} color={accent ? colors.accent : colors.muted} />
      <Text style={[styles.rowText, accent && { color: colors.accent }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20 },
  top: { flexDirection: "row", marginBottom: 12 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  host: { color: colors.muted, marginTop: 4 },
  card: {
    marginTop: 20,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowText: { color: colors.text, fontSize: 14, flexShrink: 1 },
  actions: { flexDirection: "row", gap: 10, marginTop: 24 },
  action: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  actionText: { color: colors.text, fontWeight: "500", fontSize: 13 },
  reschedule: {
    marginTop: 12,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  slotBox: {
    marginTop: 14,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
  },
  slotHeader: { fontWeight: "600", color: colors.text, marginBottom: 8 },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 12,
  },
  slotText: { color: colors.text, fontSize: 14 },
  slotEmpty: { color: colors.muted, paddingVertical: 8 },
  slotCancel: { alignItems: "center", marginTop: 10 },
  cancel: {
    marginTop: 14,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: { color: colors.white, fontWeight: "600" },
  back: { marginTop: 14, alignItems: "center" },
  backText: { color: colors.muted },
});
