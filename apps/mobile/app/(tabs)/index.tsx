import { api, getServerUrl } from "@/api";
import { useAuth } from "@/auth";
import { AiCommandBar } from "@/components/ai-command-bar";
import { BrandMark } from "@/components/brand-mark";
import { SetupChecklist } from "@/components/setup-checklist";
import { Card, EmptyState, ErrorText, Loading } from "@/components/ui";
import { formatDateTime } from "@/format";
import { useAsync } from "@/hooks";
import type { Booking, Recommendation } from "@/models";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Me {
  user?: { handle?: string | null };
  setup?: { hasCalendar: boolean; hasHours: boolean; hasEventType: boolean };
}

/** Maps the Intelligence engine's icon names to Ionicons. */
const REC_ICON: Record<Recommendation["icon"], keyof typeof Ionicons.glyphMap> = {
  sun: "sunny-outline",
  layers: "layers-outline",
  "calendar-x": "calendar-outline",
  gauge: "speedometer-outline",
  shield: "shield-checkmark-outline",
};

export default function DashboardScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const firstName = (user?.name ?? "there").split(" ")[0];

  const { data, loading, error, reload } = useAsync<Booking[]>(async () => {
    const res = await api.get<{ bookings: Booking[] }>("/api/bookings");
    const now = Date.now();
    return res.bookings
      .filter((b) => b.status === "confirmed" && new Date(b.endsAt).getTime() > now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  });

  const { data: recs, reload: reloadRecs } = useAsync<Recommendation[]>(async () => {
    const res = await api.get<{ recommendations: Recommendation[] }>("/api/recommendations");
    return res.recommendations;
  });

  const { data: me, reload: reloadMe } = useAsync<Me>(async () => api.get<Me>("/api/me"));
  const handle = me?.user?.handle ?? null;
  const bookingUrl = handle ? `${getServerUrl()}/${handle}` : null;

  useFocusEffect(
    useCallback(() => {
      reload();
      reloadRecs();
      reloadMe();
    }, [reload, reloadRecs, reloadMe]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <BrandMark size={24} />
          <Text style={styles.brand}>DayOtter</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push("/inbox")} hitSlop={10}>
            <Ionicons name="file-tray-outline" size={21} color={colors.muted} />
          </Pressable>
          <Pressable onPress={() => router.push("/insights")} hitSlop={10}>
            <Ionicons name="stats-chart-outline" size={21} color={colors.muted} />
          </Pressable>
          <Pressable onPress={() => router.push("/analytics")} hitSlop={10}>
            <Ionicons name="trending-up-outline" size={21} color={colors.muted} />
          </Pressable>
          <Pressable onPress={() => router.push("/availability")} hitSlop={10}>
            <Ionicons name="time-outline" size={22} color={colors.muted} />
          </Pressable>
          <Pressable onPress={signOut} hitSlop={10}>
            <Ionicons name="log-out-outline" size={22} color={colors.faint} />
          </Pressable>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
      >
        <Text style={styles.hi}>Good to see you,</Text>
        <Text style={styles.name}>{firstName}</Text>

        <SetupChecklist setup={me?.setup} />

        {bookingUrl ? (
          <Pressable style={styles.linkCard} onPress={() => Share.share({ message: bookingUrl })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkLabel}>YOUR BOOKING LINK</Text>
              <Text style={styles.linkUrl} numberOfLines={1}>
                {bookingUrl.replace(/^https?:\/\//, "")}
              </Text>
            </View>
            <Pressable
              onPress={() => Linking.openURL(bookingUrl)}
              hitSlop={8}
              style={styles.linkView}
            >
              <Ionicons name="open-outline" size={18} color={colors.muted} />
            </Pressable>
            <View style={styles.shareBtn}>
              <Ionicons name="share-outline" size={15} color={colors.white} />
              <Text style={styles.shareText}>Share</Text>
            </View>
          </Pressable>
        ) : null}

        <View style={{ marginTop: 18 }}>
          <AiCommandBar onDone={reload} />
        </View>

        {recs && recs.length > 0 ? (
          <>
            <Text style={styles.section}>Suggestions</Text>
            {recs.map((r) => (
              <Card key={r.id}>
                <View style={styles.row}>
                  <View style={styles.recIconBox}>
                    <Ionicons name={REC_ICON[r.icon]} size={17} color={colors.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{r.title}</Text>
                    <Text style={styles.when}>{r.detail}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </>
        ) : null}

        <Text style={styles.section}>Upcoming</Text>
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorText message={error} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="Nothing scheduled yet"
            body="Calm waters — when people book you, meetings surface here."
          />
        ) : (
          data.map((b) => (
            <Card key={b.uid}>
              <View style={styles.row}>
                <View style={styles.iconBox}>
                  <Ionicons name="calendar" size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{b.title}</Text>
                  <Text style={styles.when}>{formatDateTime(b.startsAt)}</Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: { fontSize: 16, fontWeight: "700", color: colors.text },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 18 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  hi: { fontSize: 22, color: colors.muted, fontWeight: "500" },
  name: { fontSize: 30, fontWeight: "700", color: colors.text },
  section: { marginTop: 20, marginBottom: 12, fontWeight: "600", color: colors.muted },
  linkCard: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  linkLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: colors.accent,
    textTransform: "uppercase",
  },
  linkUrl: { marginTop: 2, fontSize: 15, fontWeight: "600", color: colors.text },
  linkView: { padding: 4 },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  shareText: { color: colors.white, fontWeight: "600", fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center" },
  iconBox: {
    height: 40,
    width: 40,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  recIconBox: {
    height: 36,
    width: 36,
    borderRadius: 10,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  title: { fontWeight: "600", color: colors.text },
  when: { color: colors.muted, fontSize: 13, marginTop: 2 },
});
