import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/api";
import { useAuth } from "@/auth";
import { Card, EmptyState, ErrorText, Loading } from "@/components/ui";
import { formatDateTime } from "@/format";
import { useAsync } from "@/hooks";
import type { Booking } from "@/models";
import { colors } from "@/theme";

export default function DashboardScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const firstName = (user?.name ?? "there").split(" ")[0];

  const { data, loading, error, reload } = useAsync<Booking[]>(async () => {
    const res = await api.get<{ bookings: Booking[] }>("/api/bookings");
    const now = Date.now();
    return res.bookings
      .filter((b) => b.status === "confirmed" && new Date(b.endsAt).getTime() > now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  });
  useFocusEffect(useCallback(() => reload(), [reload]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.brand}>calSync</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push("/availability")} hitSlop={10}>
            <Ionicons name="time-outline" size={22} color={colors.muted} />
          </Pressable>
          <Pressable onPress={signOut} hitSlop={10}>
            <Ionicons name="log-out-outline" size={22} color={colors.faint} />
          </Pressable>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
      >
        <Text style={styles.hi}>Good to see you,</Text>
        <Text style={styles.name}>{firstName}</Text>

        <Text style={styles.section}>Upcoming</Text>
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorText message={error} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="Nothing scheduled yet"
            body="When people book you, meetings show up here."
          />
        ) : (
          data.map((b) => (
            <Card key={b.uid}>
              <View style={styles.row}>
                <View style={styles.iconBox}>
                  <Ionicons name="calendar" size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{b.title}</Text>
                  <Text style={styles.when}>{formatDateTime(b.startsAt)}</Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  brand: { fontSize: 16, fontWeight: "700", color: colors.text },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 18 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  hi: { fontSize: 22, color: colors.muted, fontWeight: "500" },
  name: { fontSize: 30, fontWeight: "700", color: colors.text },
  section: { marginTop: 20, marginBottom: 12, fontWeight: "600", color: colors.muted },
  row: { flexDirection: "row", alignItems: "center" },
  iconBox: {
    height: 40,
    width: 40,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  title: { fontWeight: "600", color: colors.text },
  when: { color: colors.muted, fontSize: 13, marginTop: 2 },
});
