import { api } from "@/api";
import { Card, EmptyState, ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import { type EventType, eventColorHex } from "@/models";
import { colors } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function EventsScreen() {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync<EventType[]>(async () => {
    const res = await api.get<{ eventTypes: EventType[] }>("/api/event-types");
    return res.eventTypes;
  });

  // Refresh when returning from the create/edit screen.
  useFocusEffect(useCallback(() => reload(), [reload]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Event Types</Text>
        <Pressable style={styles.newBtn} onPress={() => router.push("/event-type")}>
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.newBtnText}>New</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
      >
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorText message={error} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="No event types yet"
            body="Create bookable meetings from the web app — they show up here."
          />
        ) : (
          data.map((e) => (
            <Pressable
              key={e.id}
              onPress={() =>
                router.push({
                  pathname: "/event-type",
                  params: {
                    id: e.id,
                    title: e.title,
                    slug: e.slug,
                    durationMinutes: String(e.durationMinutes),
                    description: e.description ?? "",
                  },
                })
              }
            >
              <Card>
                <View style={styles.titleRow}>
                  <View style={styles.titleLeft}>
                    <View style={[styles.dot, { backgroundColor: eventColorHex(e.color) }]} />
                    <Text style={styles.title}>{e.title}</Text>
                  </View>
                  <Text style={styles.duration}>{e.durationMinutes}m</Text>
                </View>
                {e.description ? (
                  <Text style={styles.desc} numberOfLines={2}>
                    {e.description}
                  </Text>
                ) : null}
                {e.url ? <Text style={styles.url}>{e.url}</Text> : null}
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  header: { fontSize: 22, fontWeight: "700", color: colors.text },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  newBtnText: { color: colors.white, fontWeight: "600", fontSize: 14 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 999 },
  title: { fontWeight: "600", fontSize: 15, color: colors.text, flexShrink: 1 },
  duration: { color: colors.muted, fontSize: 13 },
  desc: { color: colors.muted, fontSize: 13, marginTop: 4 },
  url: { color: colors.accent, fontSize: 13, marginTop: 10 },
});
