import { ApiError, BASE_URL, api } from "@/api";
import { ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import type { CalendarConnection } from "@/models";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft",
  apple: "Apple iCloud",
};
const PROVIDER_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  google: "logo-google",
  microsoft: "logo-microsoft",
  apple: "logo-apple",
};

export default function CalendarsScreen() {
  const { data, loading, error, reload } = useAsync<CalendarConnection[]>(async () => {
    const res = await api.get<{ connections: CalendarConnection[] }>("/api/calendars");
    return res.connections;
  });

  const [showApple, setShowApple] = useState(false);
  const [appleId, setAppleId] = useState("");
  const [applePw, setApplePw] = useState("");
  const [connecting, setConnecting] = useState(false);

  async function connectApple() {
    setConnecting(true);
    try {
      const res = await api.post<{ calendarCount: number }>("/api/calendars/apple", {
        username: appleId.trim(),
        password: applePw,
      });
      setShowApple(false);
      setAppleId("");
      setApplePw("");
      reload();
      Alert.alert("Connected", `Synced ${res.calendarCount} calendar(s).`);
    } catch (e) {
      Alert.alert("Couldn't connect", e instanceof ApiError ? e.message : "Please try again.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Calendars" }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorText message={error} />
        ) : (
          <>
            {data && data.length > 0 ? (
              data.map((c) => (
                <View key={c.id} style={styles.conn}>
                  <Ionicons
                    name={PROVIDER_ICON[c.provider] ?? "calendar-outline"}
                    size={20}
                    color={colors.text}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.connName}>{PROVIDER_LABEL[c.provider] ?? c.provider}</Text>
                    <Text style={styles.connMeta}>
                      {c.account} · {c.calendarCount} calendar{c.calendarCount === 1 ? "" : "s"}
                      {c.status !== "active" ? ` · ${c.status}` : ""}
                    </Text>
                  </View>
                  <View
                    style={[styles.dot, { backgroundColor: c.status === "active" ? colors.success : colors.danger }]}
                  />
                </View>
              ))
            ) : (
              <Text style={styles.empty}>No calendars connected yet.</Text>
            )}

            <Text style={styles.section}>Add a calendar</Text>

            {/* Apple: form-based (app-specific password), works natively. */}
            {showApple ? (
              <View style={styles.appleBox}>
                <TextInput
                  style={styles.input}
                  value={appleId}
                  onChangeText={setAppleId}
                  placeholder="Apple ID email"
                  placeholderTextColor={colors.faint}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TextInput
                  style={styles.input}
                  value={applePw}
                  onChangeText={setApplePw}
                  placeholder="App-specific password"
                  placeholderTextColor={colors.faint}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <Text style={styles.hint}>
                  Create one at account.apple.com → Sign-In and Security → App-Specific Passwords.
                </Text>
                <Pressable style={styles.connectBtn} onPress={connectApple} disabled={connecting}>
                  <Text style={styles.connectText}>{connecting ? "Connecting…" : "Connect"}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.addRow} onPress={() => setShowApple(true)}>
                <Ionicons name="logo-apple" size={18} color={colors.text} />
                <Text style={styles.addText}>Connect Apple iCloud</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.faint} />
              </Pressable>
            )}

            {/* Google / Microsoft need the OAuth redirect — open the web app. */}
            <Pressable
              style={styles.addRow}
              onPress={() => Linking.openURL(`${BASE_URL}/settings/calendars`)}
            >
              <Ionicons name="open-outline" size={18} color={colors.text} />
              <Text style={styles.addText}>Connect Google or Microsoft (web)</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  conn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  connName: { color: colors.text, fontWeight: "600" },
  connMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 999 },
  empty: { color: colors.muted },
  section: { marginTop: 18, marginBottom: 12, fontWeight: "600", color: colors.muted },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  addText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "500" },
  appleBox: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  hint: { color: colors.faint, fontSize: 12, marginBottom: 12 },
  connectBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
  },
  connectText: { color: colors.white, fontWeight: "600" },
});
