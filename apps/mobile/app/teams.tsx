import { ApiError, api } from "@/api";
import { Card, EmptyState, ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import type { Team } from "@/models";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function TeamsScreen() {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync<Team[]>(async () => {
    const res = await api.get<{ teams: Team[] }>("/api/teams");
    return res.teams;
  });

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function createTeam() {
    const value = name.trim();
    if (!value) return;
    setCreating(true);
    try {
      const res = await api.post<{ id: string }>("/api/teams", { name: value });
      setName("");
      reload();
      router.push(`/teams/${res.id}`);
    } catch (e) {
      Alert.alert("Couldn't create team", e instanceof ApiError ? e.message : "Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Teams" }} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
      >
        <View style={styles.createBox}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="New team name"
            placeholderTextColor={colors.faint}
          />
          <Pressable
            style={[styles.createBtn, (!name.trim() || creating) && styles.disabled]}
            onPress={createTeam}
            disabled={!name.trim() || creating}
          >
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={styles.createText}>{creating ? "Creating…" : "Create"}</Text>
          </Pressable>
        </View>

        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorText message={error} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="No teams yet"
            body="Create a team above to share availability with your teammates."
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
  createBox: { flexDirection: "row", gap: 8, marginBottom: 16 },
  input: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 16,
  },
  createText: { color: colors.white, fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
