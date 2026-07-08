import { Ionicons } from "@expo/vector-icons";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/api";
import { Card, EmptyState, ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import type { Team } from "@/models";
import { colors } from "@/theme";

export default function TeamsScreen() {
  const { data, loading, error, reload } = useAsync<Team[]>(async () => {
    const res = await api.get<{ teams: Team[] }>("/api/teams");
    return res.teams;
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Text style={styles.header}>Teams</Text>
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
            <Card key={t.id}>
              <View style={styles.row}>
                <View style={styles.iconBox}>
                  <Ionicons name="people" size={20} color={colors.accent} />
                </View>
                <View>
                  <Text style={styles.name}>{t.name}</Text>
                  <Text style={styles.members}>
                    {t.memberCount} member{t.memberCount === 1 ? "" : "s"}
                  </Text>
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
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  row: { flexDirection: "row", alignItems: "center" },
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
