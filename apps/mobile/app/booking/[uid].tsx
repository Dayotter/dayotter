import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/api";
import { Badge, ErrorText, Loading } from "@/components/ui";
import { formatDateTime } from "@/format";
import { useAsync } from "@/hooks";
import type { BookingDetail } from "@/models";
import { colors, radius, statusColor } from "@/theme";

export default function BookingDetailScreen() {
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const [cancelling, setCancelling] = useState(false);

  const { data, loading, error, reload } = useAsync<BookingDetail>(async () => {
    const res = await api.get<{ booking: BookingDetail }>(`/api/bookings/${uid}`);
    return res.booking;
  }, [uid]);

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
            <Row
              icon="time-outline"
              text={`${formatDateTime(data.startsAt)}  (${data.timezone})`}
            />
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

          {data.status === "confirmed" ? (
            <Pressable style={styles.cancel} onPress={confirmCancel} disabled={cancelling}>
              <Text style={styles.cancelText}>{cancelling ? "Cancelling…" : "Cancel booking"}</Text>
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
  cancel: {
    marginTop: 24,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: { color: colors.white, fontWeight: "600" },
  back: { marginTop: 14, alignItems: "center" },
  backText: { color: colors.muted },
});
