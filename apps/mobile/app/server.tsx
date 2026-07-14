import { useAuth } from "@/auth";
import {
  DEFAULT_SERVER_URL,
  getServerUrl,
  isDefaultServer,
  normalizeServerUrl,
  probeServer,
  resetServerUrl,
  serverHost,
  setServerUrl,
} from "@/server";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Status = { kind: "idle" | "testing" | "ok" | "error"; msg?: string };

export default function ServerScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [url, setUrl] = useState(getServerUrl());
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [saving, setSaving] = useState(false);

  async function test() {
    setStatus({ kind: "testing" });
    const r = await probeServer(url);
    setStatus(
      r.ok
        ? {
            kind: "ok",
            msg: r.degraded
              ? "Reachable, but the server reports a database/queue issue."
              : "Connected - this is a DayOtter server.",
          }
        : { kind: "error", msg: r.error },
    );
  }

  /** Sessions are per-server, so a switch signs out and returns to sign-in. */
  async function switchTo(target: string) {
    const changed = target !== getServerUrl();
    await setServerUrl(target);
    if (!changed) {
      router.back();
      return;
    }
    if (user) await signOut();
    router.replace("/sign-in");
  }

  async function save() {
    setSaving(true);
    const normalized = normalizeServerUrl(url);
    const r = await probeServer(normalized);
    if (!r.ok) {
      setStatus({ kind: "error", msg: r.error });
      setSaving(false);
      return;
    }
    await switchTo(normalized);
    setSaving(false);
  }

  async function reset() {
    setSaving(true);
    await resetServerUrl();
    setUrl(DEFAULT_SERVER_URL);
    await switchTo(DEFAULT_SERVER_URL);
    setSaving(false);
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Server" }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.h}>Which DayOtter server?</Text>
        <Text style={styles.sub}>
          Use the hosted cloud, or point the app at your own self-hosted DayOtter. Switching servers
          signs you out.
        </Text>

        <Text style={styles.label}>Server URL</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={(v) => {
            setUrl(v);
            setStatus({ kind: "idle" });
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://dayotter.com"
          placeholderTextColor={colors.faint}
        />
        <Text style={styles.hint}>Currently connected to {serverHost()}.</Text>

        {status.kind !== "idle" ? (
          <View style={styles.status}>
            {status.kind === "testing" ? (
              <ActivityIndicator size="small" color={colors.muted} />
            ) : (
              <Ionicons
                name={status.kind === "ok" ? "checkmark-circle" : "alert-circle"}
                size={16}
                color={status.kind === "ok" ? colors.success : colors.danger}
              />
            )}
            <Text style={styles.statusText}>
              {status.kind === "testing" ? "Testing…" : status.msg}
            </Text>
          </View>
        ) : null}

        <Pressable
          style={styles.testBtn}
          onPress={test}
          disabled={status.kind === "testing" || saving}
        >
          <Text style={styles.testText}>Test connection</Text>
        </Pressable>
        <Pressable
          style={styles.saveBtn}
          onPress={save}
          disabled={saving || status.kind === "testing"}
        >
          <Text style={styles.saveText}>{saving ? "Saving…" : "Save & use this server"}</Text>
        </Pressable>

        {!isDefaultServer() ? (
          <Pressable style={styles.reset} onPress={reset} disabled={saving}>
            <Text style={styles.resetText}>
              Reset to the hosted cloud ({serverHost(DEFAULT_SERVER_URL)})
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  h: { fontSize: 20, fontWeight: "700", color: colors.text },
  sub: { color: colors.muted, marginTop: 6, fontSize: 14, lineHeight: 20 },
  label: { fontWeight: "500", fontSize: 14, marginTop: 22, marginBottom: 6, color: colors.text },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  hint: { color: colors.faint, fontSize: 12, marginTop: 8 },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 18 },
  testBtn: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  testText: { color: colors.text, fontWeight: "600", fontSize: 15 },
  saveBtn: {
    marginTop: 10,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  reset: { marginTop: 22, alignItems: "center" },
  resetText: { color: colors.muted, fontSize: 14 },
});
