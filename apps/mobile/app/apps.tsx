import { api, getServerUrl } from "@/api";
import { ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface AppItem {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  blurb: string;
  color: string;
  href: string;
  external: boolean;
  builtIn: boolean;
  needsConnection: boolean;
  configured: boolean;
  connected: boolean;
}

/** Status pill text + color for an app. */
function status(a: AppItem): { label: string; color: string } {
  if (a.builtIn) return { label: "Included", color: colors.muted };
  if (!a.configured) return { label: "Not configured", color: colors.faint };
  if (a.connected) return { label: "Connected", color: colors.success };
  return { label: "Available", color: colors.accent };
}

export default function AppsScreen() {
  const { data, loading, error, reload } = useAsync<AppItem[]>(async () => {
    const res = await api.get<{ apps: AppItem[] }>("/api/apps");
    return res.apps;
  });
  const [filter, setFilter] = useState<string | null>(null);

  const categories = useMemo(() => {
    const seen: { key: string; label: string }[] = [];
    for (const a of data ?? []) {
      if (!seen.some((c) => c.key === a.category))
        seen.push({ key: a.category, label: a.categoryLabel });
    }
    return seen;
  }, [data]);

  const shown = (data ?? []).filter((a) => !filter || a.category === filter);

  // Connecting/managing is a web flow (OAuth or env). Open it on the server host.
  function open(a: AppItem) {
    const base = getServerUrl().replace(/\/$/, "");
    const url = a.href.startsWith("http") ? a.href : `${base}${a.href}`;
    Linking.openURL(url).catch(() => {});
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Apps" }} />
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorText message={error} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.intro}>
            Connect calendars, video, CRM, payments, and more. Connecting opens the web app.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <Pressable
              onPress={() => setFilter(null)}
              style={[styles.filterChip, filter === null && styles.filterChipOn]}
            >
              <Text style={[styles.filterText, filter === null && styles.filterTextOn]}>All</Text>
            </Pressable>
            {categories.map((c) => (
              <Pressable
                key={c.key}
                onPress={() => setFilter(c.key)}
                style={[styles.filterChip, filter === c.key && styles.filterChipOn]}
              >
                <Text style={[styles.filterText, filter === c.key && styles.filterTextOn]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {shown.map((a) => {
            const st = status(a);
            return (
              <Pressable
                key={a.id}
                style={styles.card}
                onPress={() => open(a)}
                onLongPress={reload}
              >
                <View style={[styles.marker, { backgroundColor: a.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{a.name}</Text>
                  <Text style={styles.blurb} numberOfLines={2}>
                    {a.blurb}
                  </Text>
                  <Text style={[styles.status, { color: st.color }]}>{st.label}</Text>
                </View>
                {a.builtIn ? null : <Ionicons name="open-outline" size={16} color={colors.faint} />}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  filterRow: { gap: 8, paddingBottom: 16 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  filterChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.muted, fontSize: 13 },
  filterTextOn: { color: colors.white, fontWeight: "600" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  marker: { width: 10, height: 10, borderRadius: 5 },
  name: { color: colors.text, fontWeight: "600", fontSize: 15 },
  blurb: { color: colors.muted, fontSize: 12, marginTop: 3, lineHeight: 17 },
  status: { fontSize: 12, fontWeight: "600", marginTop: 6 },
});
