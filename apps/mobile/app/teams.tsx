import { api } from "@/api";
import { Card, EmptyState, ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import type { Team } from "@/models";
import { colors } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

export default function TeamsScreen() {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync<Team[]>(async () => {
    const res = await api.get<{ teams: Team[] }>("/api/teams");
    return res.teams;
  });

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Teams" }} />
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
            title="No teams yet"
            body="Create a team on the web to share availability with your founders."
          />
        ) : (
          data.map((t) => (
            <Pressable key={t.id} onPress={() => router.push(`/teams/${t.id}`)}>
              <Card>
                <View style={styles.row}>
                  <View style={styles.iconBox}>
                    <Ionicons name="people" size={20} color={colors.accent} />
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.name}>{t.name}</Text>
                    <Text style={styles.members}>
                      {t.memberCount} member{t.memberCount === 1 ? "" : "s"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.faint} />
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
  scroll: { padding: 20, paddingBottom: 32 },
  row: { flexDirection: "row", alignItems: "center" },
  grow: { flex: 1 },
  iconBox: {
    height: 42,
    width: 42,
    borderRadius: 11,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  name: { fontWeight: "600", color: colors.text },
  members: { color: colors.muted, fontSize: 13 },
});
