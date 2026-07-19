import { api } from "@/api";
import { Badge, Card, EmptyState, ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import { colors } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

/** A host's poll as returned by GET /api/polls (mirrors listPolls). */
interface PollListItem {
  id: string;
  title: string;
  status: string;
  // The server helper returns option/vote rows; a REST wrapper may instead send
  // pre-computed counts. Accept either so the list is robust to both shapes.
  options?: { id: string }[];
  votes?: { id: string }[];
  optionCount?: number;
  voteCount?: number;
}

function optionCount(p: PollListItem): number {
  return p.optionCount ?? p.options?.length ?? 0;
}
function voteCount(p: PollListItem): number {
  return p.voteCount ?? p.votes?.length ?? 0;
}

export default function PollsListScreen() {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync<PollListItem[]>(async () => {
    const res = await api.get<{ polls: PollListItem[] }>("/api/polls");
    return res.polls;
  });

  // Refresh when returning from create / detail (a finalize changes status).
  useFocusEffect(useCallback(() => reload(), [reload]));

  return (
    <View style={styles.safe}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Group polls",
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/polls/new")}
              hitSlop={8}
              style={styles.headerBtn}
            >
              <Ionicons name="add" size={16} color={colors.white} />
              <Text style={styles.headerBtnText}>New</Text>
            </Pressable>
          ),
        }}
      />
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
            title="No polls yet"
            body="Propose a few times, share the link, and let the group vote on what works."
          />
        ) : (
          data.map((p) => (
            <Pressable key={p.id} onPress={() => router.push(`/polls/${p.id}`)}>
              <Card>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>
                    {p.title}
                  </Text>
                  <Badge
                    label={p.status === "finalized" ? "Finalized" : "Open"}
                    color={p.status === "finalized" ? colors.success : colors.muted}
                  />
                </View>
                <View style={styles.metaRow}>
                  <View style={styles.meta}>
                    <Ionicons name="time-outline" size={13} color={colors.faint} />
                    <Text style={styles.metaText}>{optionCount(p)} time options</Text>
                  </View>
                  <View style={styles.meta}>
                    <Ionicons name="people-outline" size={13} color={colors.faint} />
                    <Text style={styles.metaText}>{voteCount(p)} votes</Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  headerBtnText: { color: colors.white, fontWeight: "600", fontSize: 14 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: { fontWeight: "600", fontSize: 15, color: colors.text, flexShrink: 1 },
  metaRow: { flexDirection: "row", gap: 16, marginTop: 8 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: colors.muted, fontSize: 13 },
});
