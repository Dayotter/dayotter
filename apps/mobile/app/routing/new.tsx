import { ApiError, api } from "@/api";
import { colors, radius } from "@/theme";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

/** POST /api/routing response — `{ id, url }` (mirrors createForm on the web). */
interface CreateResponse {
  id: string;
  url?: string;
}

export default function NewRoutingFormScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const name = title.trim();
    if (!name) return setError("Give your form a name.");
    setError(null);
    setSaving(true);
    try {
      // Body matches the POST zod schema exactly: title (required), description (optional).
      const body: { title: string; description?: string } = { title: name };
      const desc = description.trim();
      if (desc) body.description = desc;
      const res = await api.post<CreateResponse>("/api/routing", body);
      // Continue building on the detail screen. Replace so Back returns to the list.
      router.replace(`/routing/${res.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create form");
      setSaving(false);
    }
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "New routing form" }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Ask a couple of questions, then send each visitor to the right booking page automatically.
        </Text>

        <Text style={styles.label}>Form name</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Talk to sales"
          placeholderTextColor={colors.faint}
          autoFocus
          maxLength={120}
        />

        <Text style={styles.label}>Intro (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Answer a couple of questions and we'll get you to the right person."
          placeholderTextColor={colors.faint}
          multiline
          maxLength={1000}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.save, (saving || !title.trim()) && styles.saveDisabled]}
          onPress={submit}
          disabled={saving || !title.trim()}
        >
          <Text style={styles.saveText}>{saving ? "Creating…" : "Create & build"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  intro: { color: colors.muted, fontSize: 13, marginBottom: 20, lineHeight: 19 },
  label: { color: colors.muted, fontWeight: "600", marginBottom: 8, fontSize: 13 },
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
    marginBottom: 18,
  },
  multiline: { minHeight: 88, textAlignVertical: "top" },
  error: { color: colors.danger, marginBottom: 12 },
  save: {
    marginTop: 4,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: colors.white, fontWeight: "600", fontSize: 15 },
});
