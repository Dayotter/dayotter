import { api, getServerUrl } from "@/api";
import { EmptyState, ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

/** Shareable public URL for a form's booker page (mirrors web `/forms/<token>`). */
const publicFormUrl = (token: string) => `${getServerUrl().replace(/\/$/, "")}/forms/${token}`;

/** One row of GET /api/routing (mirrors listForms() on the web). */
interface RoutingFormListItem {
  id: string;
  title: string;
  description: string | null;
  token: string;
  isActive: boolean;
  routes: unknown[];
  responses: unknown[];
}

/**
 * The list GET may return a bare array or a `{ forms }` wrapper (the mobile API
 * convention). Accept either so the screen is resilient to the shape the shared
 * route ships.
 */
function normalizeList(res: unknown): RoutingFormListItem[] {
  const raw = Array.isArray(res)
    ? res
    : res && typeof res === "object" && Array.isArray((res as { forms?: unknown[] }).forms)
      ? (res as { forms: unknown[] }).forms
      : [];
  return raw.map((r) => {
    const f = (r ?? {}) as Record<string, unknown>;
    return {
      id: String(f.id ?? ""),
      title: typeof f.title === "string" ? f.title : "Untitled form",
      description: typeof f.description === "string" ? f.description : null,
      token: typeof f.token === "string" ? f.token : "",
      isActive: f.isActive !== false,
      routes: Array.isArray(f.routes) ? f.routes : [],
      responses: Array.isArray(f.responses) ? f.responses : [],
    };
  });
}

export default function RoutingListScreen() {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync<RoutingFormListItem[]>(async () => {
    const res = await api.get<unknown>("/api/routing");
    return normalizeList(res);
  });

  return (
    <View style={styles.safe}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Routing forms",
          headerRight: () => (
            <Pressable onPress={() => router.push("/routing/new")} hitSlop={10}>
              <Ionicons name="add" size={24} color={colors.accent} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorText message={error} />
        ) : data && data.length > 0 ? (
          <>
            <Text style={styles.intro}>
              Ask a few questions up front, then send each visitor to the right booking page.
            </Text>
            {data.map((f) => (
              <View key={f.id} style={styles.row}>
                <Pressable style={styles.card} onPress={() => router.push(`/routing/${f.id}`)}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleLine}>
                      <Ionicons name="git-branch-outline" size={15} color={colors.accent} />
                      <Text style={styles.title} numberOfLines={1}>
                        {f.title}
                      </Text>
                    </View>
                    <Text style={styles.meta}>
                      {f.routes.length} rule{f.routes.length === 1 ? "" : "s"} ·{" "}
                      {f.responses.length} response{f.responses.length === 1 ? "" : "s"}
                    </Text>
                  </View>
                  <View style={[styles.badge, f.isActive ? styles.badgeLive : styles.badgeDraft]}>
                    <Text
                      style={[
                        styles.badgeText,
                        f.isActive ? styles.badgeTextLive : styles.badgeTextDraft,
                      ]}
                    >
                      {f.isActive ? "Live" : "Draft"}
                    </Text>
                  </View>
                </Pressable>
                {f.token ? (
                  <Pressable
                    onPress={() => Linking.openURL(publicFormUrl(f.token))}
                    hitSlop={8}
                    style={styles.linkBtn}
                    accessibilityLabel="Open public form"
                  >
                    <Ionicons name="open-outline" size={18} color={colors.faint} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </>
        ) : (
          <EmptyState
            title="No routing forms yet"
            body="Route enterprise leads to you and everyone else to the team — automatically, based on their answers."
          />
        )}

        <Pressable style={styles.new} onPress={() => router.push("/routing/new")}>
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.newText}>New form</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  intro: { color: colors.muted, fontSize: 13, marginBottom: 16, lineHeight: 19 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  card: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
  },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { color: colors.text, fontWeight: "600", flexShrink: 1 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeLive: { backgroundColor: `${colors.success}26` },
  badgeDraft: { backgroundColor: colors.border },
  badgeText: { fontSize: 11, fontWeight: "600" },
  badgeTextLive: { color: colors.success },
  badgeTextDraft: { color: colors.muted },
  linkBtn: { padding: 6 },
  new: {
    marginTop: 18,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
  },
  newText: { color: colors.white, fontWeight: "600", fontSize: 15 },
});
