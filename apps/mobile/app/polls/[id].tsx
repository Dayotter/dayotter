import { ApiError, api, getServerUrl } from "@/api";
import { Badge, ErrorText, Loading } from "@/components/ui";
import { formatDateTime } from "@/format";
import { useAsync } from "@/hooks";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

/** GET /api/polls/[id] detail (mirrors getPollForHost). */
interface PollOption {
  id: string;
  startsAt: string;
}
interface PollVote {
  optionId: string;
  voterName: string;
  response: string; // "yes" | "no" | "maybe"
}
interface PollDetail {
  id: string;
  title: string;
  status: string; // "open" | "finalized"
  token: string;
  finalizedOptionId: string | null;
  durationMinutes?: string | number;
  location?: string | null;
  options: PollOption[];
  votes: PollVote[];
}

interface OptionResult {
  id: string;
  startsAt: string;
  yes: number;
  maybe: number;
  no: number;
  voters: { name: string; response: string }[];
}

function tally(poll: PollDetail): OptionResult[] {
  return poll.options.map((o) => {
    const votes = poll.votes.filter((v) => v.optionId === o.id);
    return {
      id: o.id,
      startsAt: o.startsAt,
      yes: votes.filter((v) => v.response === "yes").length,
      maybe: votes.filter((v) => v.response === "maybe").length,
      no: votes.filter((v) => v.response === "no").length,
      voters: votes.map((v) => ({ name: v.voterName, response: v.response })),
    };
  });
}

export default function PollDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [finalizing, setFinalizing] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync<PollDetail>(async () => {
    const res = await api.get<{ poll: PollDetail }>(`/api/polls/${id}`);
    return res.poll;
  }, [id]);

  const isFinalized = data?.status === "finalized";
  const results = data ? tally(data) : [];
  const uniqueVoters = data ? new Set(data.votes.map((v) => v.voterName)).size : 0;

  // Highlight the leader (most yes, then most maybe) while the poll is open.
  const leaderId = !isFinalized
    ? [...results].sort(
        (a, b) => b.yes - a.yes || b.maybe - a.maybe || a.startsAt.localeCompare(b.startsAt),
      )[0]?.id
    : undefined;

  const shareUrl = data ? `${getServerUrl().replace(/\/$/, "")}/poll/${data.token}` : "";

  function confirmFinalize(opt: OptionResult) {
    Alert.alert(
      "Lock in this time?",
      `${formatDateTime(opt.startsAt)}\n\nEveryone who can make it will be notified and the meeting is added to your calendar.`,
      [
        { text: "Back", style: "cancel" },
        { text: "Pick this", onPress: () => finalize(opt.id) },
      ],
    );
  }

  async function finalize(optionId: string) {
    setFinalizing(optionId);
    try {
      await api.post(`/api/polls/${id}/finalize`, { optionId });
      reload();
    } catch (e) {
      Alert.alert("Couldn't finalize", e instanceof ApiError ? e.message : "Please try again.");
    } finally {
      setFinalizing(null);
    }
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Group poll" }} />
      {loading && !data ? (
        <Loading />
      ) : error || !data ? (
        <ErrorText message={error ?? "Not found"} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.top}>
            <Badge
              label={isFinalized ? "Finalized" : "Open"}
              color={isFinalized ? colors.success : colors.muted}
            />
          </View>
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.subtitle}>
            {isFinalized
              ? "The time is on your calendar and everyone's been notified."
              : `${uniqueVoters} ${uniqueVoters === 1 ? "person has" : "people have"} voted so far.`}
          </Text>

          {!isFinalized ? (
            <Pressable style={styles.shareBox} onPress={() => Linking.openURL(shareUrl)}>
              <Ionicons name="share-outline" size={16} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.shareLabel}>Share to collect votes</Text>
                <Text style={styles.shareUrl} numberOfLines={1}>
                  {shareUrl}
                </Text>
              </View>
              <Ionicons name="open-outline" size={16} color={colors.faint} />
            </Pressable>
          ) : null}

          <Text style={styles.section}>Proposed times</Text>
          {results.map((o) => {
            const isWinner = isFinalized && data.finalizedOptionId === o.id;
            const isLeader = leaderId === o.id && o.yes + o.maybe > 0;
            return (
              <View
                key={o.id}
                style={[
                  styles.option,
                  isWinner && styles.optionWinner,
                  isLeader && styles.optionLeader,
                ]}
              >
                <View style={styles.optionHead}>
                  <Text style={styles.optionTime}>{formatDateTime(o.startsAt)}</Text>
                  {isWinner ? (
                    <View style={styles.tag}>
                      <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                      <Text style={[styles.tagText, { color: colors.success }]}>Booked</Text>
                    </View>
                  ) : isLeader ? (
                    <Text style={[styles.tagText, { color: colors.accent }]}>Leading</Text>
                  ) : null}
                </View>

                <View style={styles.counts}>
                  <Text style={[styles.count, { color: colors.success }]}>{o.yes} yes</Text>
                  <Text style={styles.count}>{o.maybe} maybe</Text>
                  <Text style={[styles.count, { color: colors.faint }]}>{o.no} no</Text>
                </View>

                {o.voters.length > 0 ? (
                  <Text style={styles.voters} numberOfLines={2}>
                    {o.voters
                      .slice(0, 6)
                      .map((v) => `${v.name} (${v.response})`)
                      .join(", ")}
                    {o.voters.length > 6 ? ` +${o.voters.length - 6}` : ""}
                  </Text>
                ) : null}

                {!isFinalized ? (
                  <Pressable
                    style={[styles.pick, isLeader && styles.pickPrimary]}
                    onPress={() => confirmFinalize(o)}
                    disabled={finalizing !== null}
                  >
                    <Text style={[styles.pickText, isLeader && styles.pickTextPrimary]}>
                      {finalizing === o.id ? "Booking…" : "Pick this time"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}

          <Pressable style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backText}>All polls</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  top: { flexDirection: "row", marginBottom: 12 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  subtitle: { color: colors.muted, marginTop: 6, fontSize: 14 },
  shareBox: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
  },
  shareLabel: { color: colors.muted, fontSize: 12 },
  shareUrl: { color: colors.text, fontSize: 13, marginTop: 2 },
  section: { marginTop: 22, marginBottom: 10, fontWeight: "600", color: colors.muted },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 10,
    backgroundColor: colors.surface,
  },
  optionWinner: { borderColor: colors.success, backgroundColor: colors.surface2 },
  optionLeader: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  optionTime: { fontWeight: "600", color: colors.text, fontSize: 15, flexShrink: 1 },
  tag: { flexDirection: "row", alignItems: "center", gap: 4 },
  tagText: { fontSize: 12, fontWeight: "600" },
  counts: { flexDirection: "row", gap: 14, marginTop: 8 },
  count: { fontSize: 13, color: colors.muted },
  voters: { color: colors.faint, fontSize: 12, marginTop: 8 },
  pick: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: "center",
  },
  pickPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  pickText: { color: colors.text, fontWeight: "600", fontSize: 14 },
  pickTextPrimary: { color: colors.white },
  back: { marginTop: 18, alignItems: "center" },
  backText: { color: colors.muted },
});
