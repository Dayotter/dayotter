import { api } from "@/api";
import { EmptyState, ErrorText, Loading } from "@/components/ui";
import { formatDateTime } from "@/format";
import { useAsync } from "@/hooks";
import type { InboxData } from "@/models";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function InboxScreen() {
  const router = useRouter();
  const { data, loading, error } = useAsync<InboxData>(async () => {
    const res = await api.get<{ inbox: InboxData }>("/api/inbox");
    return res.inbox;
  });

  const empty = data && data.reconnect.length === 0 && data.conflicts.length === 0;

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Inbox" }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorText message={error} />
        ) : empty ? (
          <EmptyState title="All clear" body="No calendars to reconnect and no double-bookings." />
        ) : (
          <>
            {data && data.reconnect.length > 0 ? (
              <>
                <Text style={styles.section}>Needs reconnecting</Text>
                {data.reconnect.map((r) => (
                  <View key={r.connectionId} style={[styles.item, styles.warn]}>
                    <Ionicons name="warning-outline" size={18} color={colors.danger} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>
                        {r.provider} — {r.account}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {r.error ?? "Stopped syncing"} · reconnect on the web app
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            ) : null}

            {data && data.conflicts.length > 0 ? (
              <>
                <Text style={styles.section}>Double-booked</Text>
                {data.conflicts.map((c) => (
                  <Pressable
                    key={c.uid}
                    style={styles.item}
                    onPress={() => router.push(`/booking/${c.uid}`)}
                  >
                    <Ionicons name="alert-circle-outline" size={18} color={colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{c.title}</Text>
                      <Text style={styles.itemMeta}>
                        {formatDateTime(c.startsAt)} · clashes with “{c.clashTitle}”
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.faint} />
                  </Pressable>
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20 },
  section: { marginTop: 8, marginBottom: 10, fontWeight: "600", color: colors.muted },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  warn: { borderWidth: 1, borderColor: colors.danger },
  itemTitle: { color: colors.text, fontWeight: "600" },
  itemMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
