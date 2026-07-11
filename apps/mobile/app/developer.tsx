import { ApiError, api } from "@/api";
import { ProLock, useFeature } from "@/components/pro-lock";
import { ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import type { ApiKey } from "@/models";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

interface Endpoint {
  id: string;
  url: string;
  events: string[];
  disabled: boolean;
}

export default function DeveloperScreen() {
  const feat = useFeature("developer");
  const keys = useAsync<ApiKey[]>(async () => {
    const res = await api.get<{ keys: ApiKey[] }>("/api/api-keys");
    return res.keys;
  });
  const hooks = useAsync<Endpoint[]>(async () => {
    const res = await api.get<{ endpoints: Endpoint[] }>("/api/webhooks");
    return res.endpoints;
  });

  const [keyName, setKeyName] = useState("");
  const [hookUrl, setHookUrl] = useState("");
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [newHookSecret, setNewHookSecret] = useState<string | null>(null);

  async function createKey() {
    if (!keyName.trim()) return;
    try {
      const res = await api.post<{ secret: string }>("/api/api-keys", { name: keyName });
      setKeyName("");
      setNewKeySecret(res.secret);
      keys.reload();
    } catch (e) {
      Alert.alert("Couldn't create", e instanceof ApiError ? e.message : "Please try again.");
    }
  }

  function revokeKey(id: string) {
    Alert.alert("Revoke key?", "Apps using it will stop working.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: async () => {
          await api.del(`/api/api-keys/${id}`).catch(() => {});
          keys.reload();
        },
      },
    ]);
  }

  async function createHook() {
    if (!hookUrl.trim()) return;
    try {
      const res = await api.post<{ secret: string }>("/api/webhooks", {
        url: hookUrl,
        events: ["*"],
      });
      setHookUrl("");
      setNewHookSecret(res.secret);
      hooks.reload();
    } catch (e) {
      Alert.alert("Couldn't add", e instanceof ApiError ? e.message : "Please try again.");
    }
  }

  async function toggleHook(ep: Endpoint) {
    await api.patch(`/api/webhooks/${ep.id}`, { disabled: !ep.disabled }).catch(() => {});
    hooks.reload();
  }

  function deleteHook(id: string) {
    Alert.alert("Delete endpoint?", "", [
      { text: "Keep", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.del(`/api/webhooks/${id}`).catch(() => {});
          hooks.reload();
        },
      },
    ]);
  }

  if (!feat.loading && !feat.allowed) {
    return (
      <View style={styles.safe}>
        <Stack.Screen options={{ headerShown: true, title: "Developer" }} />
        <ProLock feature="developer" />
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Developer" }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>API keys</Text>
        <Text style={styles.hint}>Bearer auth for the REST API (base /api/v1).</Text>
        {newKeySecret ? (
          <SecretReveal
            label="Copy your key now — it won't be shown again."
            value={newKeySecret}
            onDone={() => setNewKeySecret(null)}
          />
        ) : null}
        {keys.loading && !keys.data ? (
          <Loading />
        ) : keys.error ? (
          <ErrorText message={keys.error} />
        ) : (
          <>
            {(keys.data ?? []).map((k) => (
              <View key={k.id} style={styles.item}>
                <Ionicons name="key-outline" size={16} color={colors.faint} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{k.name}</Text>
                  <Text style={styles.itemMeta}>
                    {k.prefix}
                    {k.lastUsedAt
                      ? ` · used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                      : " · never used"}
                  </Text>
                </View>
                <Pressable onPress={() => revokeKey(k.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.faint} />
                </Pressable>
              </View>
            ))}
            <View style={styles.row}>
              <TextInput
                style={styles.input}
                value={keyName}
                onChangeText={setKeyName}
                placeholder="Key name (e.g. Zapier)"
                placeholderTextColor={colors.faint}
              />
              <Pressable style={styles.addBtn} onPress={createKey}>
                <Text style={styles.addText}>Create</Text>
              </Pressable>
            </View>
          </>
        )}

        <Text style={styles.section}>Webhooks</Text>
        <Text style={styles.hint}>Signed POST on booking.created / cancelled / rescheduled.</Text>
        {newHookSecret ? (
          <SecretReveal
            label="Signing secret — copy it now, it won't be shown again."
            value={newHookSecret}
            onDone={() => setNewHookSecret(null)}
          />
        ) : null}
        {hooks.loading && !hooks.data ? (
          <Loading />
        ) : hooks.error ? (
          <ErrorText message={hooks.error} />
        ) : (
          <>
            {(hooks.data ?? []).map((ep) => (
              <View key={ep.id} style={styles.item}>
                <Ionicons name="git-network-outline" size={16} color={colors.faint} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {ep.url}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {ep.events.includes("*") ? "all events" : ep.events.join(", ")}
                  </Text>
                </View>
                <Switch value={!ep.disabled} onValueChange={() => toggleHook(ep)} />
                <Pressable onPress={() => deleteHook(ep.id)} hitSlop={8} style={{ marginLeft: 8 }}>
                  <Ionicons name="trash-outline" size={18} color={colors.faint} />
                </Pressable>
              </View>
            ))}
            <View style={styles.row}>
              <TextInput
                style={styles.input}
                value={hookUrl}
                onChangeText={setHookUrl}
                placeholder="https://example.com/webhook"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Pressable style={styles.addBtn} onPress={createHook}>
                <Text style={styles.addText}>Add</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SecretReveal({
  label,
  value,
  onDone,
}: { label: string; value: string; onDone: () => void }) {
  return (
    <View style={styles.reveal}>
      <Text style={styles.revealLabel}>{label}</Text>
      <Text selectable style={styles.revealValue}>
        {value}
      </Text>
      <Pressable onPress={onDone} style={{ marginTop: 8 }}>
        <Text style={styles.revealDone}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  reveal: {
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 12,
  },
  revealLabel: { color: colors.text, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  revealValue: { color: colors.text, fontFamily: "Courier", fontSize: 12 },
  revealDone: { color: colors.muted, fontSize: 12 },
  scroll: { padding: 20, paddingBottom: 60 },
  section: { marginTop: 18, fontWeight: "600", color: colors.text, fontSize: 16 },
  hint: { color: colors.faint, fontSize: 12, marginTop: 2, marginBottom: 12 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
  },
  itemTitle: { color: colors.text, fontWeight: "600", fontSize: 13 },
  itemMeta: { color: colors.faint, fontSize: 12, marginTop: 2 },
  row: { flexDirection: "row", gap: 8, marginTop: 4 },
  input: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  addText: { color: colors.white, fontWeight: "600" },
});
