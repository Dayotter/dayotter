import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/api";
import { Badge, Card, EmptyState, ErrorText, Loading } from "@/components/ui";
import { formatDay, formatTime } from "@/format";
import { useAsync } from "@/hooks";
import type { Booking } from "@/models";
import { colors, statusColor } from "@/theme";

export default function BookingsScreen() {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync<Booking[]>(async () => {
    const res = await api.get<{ bookings: Booking[] }>("/api/bookings");
    return res.bookings;
  });
  useFocusEffect(useCallback(() => reload(), [reload]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Text style={styles.header}>Bookings</Text>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
      >
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorText message={error} />
        ) : !data || data.length === 0 ? (
          <EmptyState title="No bookings yet" body="Bookings people make with you appear here." />
        ) : (
          data.map((b) => {
            const who = b.attendees.map((a) => a.name ?? a.email).join(", ");
            return (
              <Pressable key={b.uid} onPress={() => router.push(`/booking/${b.uid}`)}>
                <Card>
                  <View style={styles.row}>
                    <View style={styles.dateBox}>
                      <Text style={styles.date}>{formatDay(b.startsAt)}</Text>
                      <Text style={styles.time}>{formatTime(b.startsAt)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title} numberOfLines={1}>
                        {b.title}
                      </Text>
                      {who ? (
                        <Text style={styles.who} numberOfLines={1}>
                          {who}
                        </Text>
                      ) : null}
                    </View>
                    <Badge label={b.status} color={statusColor[b.status] ?? colors.muted} />
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  row: { flexDirection: "row", alignItems: "center" },
  dateBox: { width: 56 },
  date: { fontWeight: "600", fontSize: 13, color: colors.text },
  time: { color: colors.muted, fontSize: 12 },
  title: { fontWeight: "600", color: colors.text },
  who: { color: colors.muted, fontSize: 12, marginTop: 1 },
});
