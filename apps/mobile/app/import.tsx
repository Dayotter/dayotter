import { ApiError, api } from "@/api";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

interface ImportSummary {
  eventTypesImported: number;
  eventTypesSkipped: number;
}

/**
 * Bring event types across from another scheduler. The token / API key is used
 * only for the one request and never stored (matches the web Import page).
 */
export default function ImportScreen() {
  const [calendlyToken, setCalendlyToken] = useState("");
  const [calcomKey, setCalcomKey] = useState("");
  const [calcomBaseUrl, setCalcomBaseUrl] = useState("");
  const [running, setRunning] = useState<"calendly" | "calcom" | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(source: "calendly" | "calcom") {
    setRunning(source);
    setResult(null);
    setError(null);
    try {
      const body =
        source === "calendly"
          ? { token: calendlyToken.trim() }
          : { apiKey: calcomKey.trim(), baseUrl: calcomBaseUrl.trim() || undefined };
      const res = await api.post<ImportSummary>(`/api/import/${source}`, body);
      const plural = res.eventTypesImported === 1 ? "" : "s";
      const skipped = res.eventTypesSkipped ? ` · ${res.eventTypesSkipped} skipped` : "";
      setResult(`Imported ${res.eventTypesImported} event type${plural}${skipped}`);
      if (source === "calendly") setCalendlyToken("");
      else setCalcomKey("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Import failed. Check the token and retry.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Import" }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Move your event types over from another scheduler. Your token is used once for the import
          and never stored.
        </Text>

        {result ? (
          <View style={styles.resultBox}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.resultText}>{result}</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Calendly */}
        <Text style={styles.section}>From Calendly</Text>
        <Text style={styles.hint}>
          Paste a Calendly personal access token (Calendly → Integrations → API & webhooks).
        </Text>
        <TextInput
          style={styles.input}
          value={calendlyToken}
          onChangeText={setCalendlyToken}
          placeholder="Calendly access token"
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
          secureTextEntry
        />
        <Pressable
          style={[
            styles.btn,
            (running !== null || calendlyToken.trim().length < 10) && styles.btnOff,
          ]}
          onPress={() => run("calendly")}
          disabled={running !== null || calendlyToken.trim().length < 10}
        >
          <Text style={styles.btnText}>
            {running === "calendly" ? "Importing…" : "Import from Calendly"}
          </Text>
        </Pressable>

        {/* Cal.com */}
        <Text style={styles.section}>From Cal.com</Text>
        <Text style={styles.hint}>
          Paste a Cal.com API key. For a self-hosted Cal.com, add its base URL.
        </Text>
        <TextInput
          style={styles.input}
          value={calcomKey}
          onChangeText={setCalcomKey}
          placeholder="Cal.com API key"
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          value={calcomBaseUrl}
          onChangeText={setCalcomBaseUrl}
          placeholder="Base URL (optional, self-hosted)"
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
        />
        <Pressable
          style={[styles.btn, (running !== null || calcomKey.trim().length < 6) && styles.btnOff]}
          onPress={() => run("calcom")}
          disabled={running !== null || calcomKey.trim().length < 6}
        >
          <Text style={styles.btnText}>
            {running === "calcom" ? "Importing…" : "Import from Cal.com"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 48 },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  section: { marginTop: 22, marginBottom: 6, fontWeight: "700", color: colors.text, fontSize: 16 },
  hint: { color: colors.faint, fontSize: 12, marginBottom: 10, lineHeight: 17 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 2,
  },
  btnOff: { opacity: 0.5 },
  btnText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  resultBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 12,
  },
  resultText: { color: colors.text, fontSize: 14, flex: 1 },
  error: { color: colors.danger, marginBottom: 12 },
});
