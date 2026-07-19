import { ApiError, api } from "@/api";
import { ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import type { Team } from "@/models";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

/**
 * A team scheduling rule (GET /api/teams/[id]/rules). Company holidays and
 * meeting-free windows that block bookings for every member.
 */
interface TeamRule {
  id: string;
  kind: "holiday" | "no_meeting";
  label: string | null;
  theDate: string | null;
  dayOfWeek: number | null;
  startMinute: number | null;
  endMinute: number | null;
}

type Role = "owner" | "admin" | "member";

/** A member row from GET /api/teams/[id]. */
interface Member {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: Role;
  priority: number;
}

/** Everything the detail screen needs, loaded together so one reload refreshes all. */
interface DetailData {
  team: Team;
  viewerRole: Role;
  members: Member[];
  rules: TeamRule[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const pad = (n: number) => String(n).padStart(2, "0");
const toHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const toMin = (s: string): number => {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** "2026-12-25" -> "Dec 25, 2026" without timezone drift from Date parsing. */
function formatDate(iso: string | null): string {
  if (!iso || !DATE_RE.test(iso)) return "a day";
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1] ?? ""} ${d}, ${y}`;
}

function describeRule(r: TeamRule): string {
  if (r.kind === "holiday") return `Holiday · ${formatDate(r.theDate)}`;
  const when = r.dayOfWeek == null ? "Every day" : DAYS_LONG[r.dayOfWeek];
  const win =
    r.startMinute != null && r.endMinute != null
      ? `${toHHMM(r.startMinute)}–${toHHMM(r.endMinute)}`
      : "";
  return `No meetings · ${when} ${win}`.trim();
}

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  // Team detail (name + roster + viewer's role) and rules, loaded together so a
  // single reload() refreshes team + members + rules.
  const { data, loading, error, reload } = useAsync<DetailData>(async () => {
    const [detailRes, rulesRes] = await Promise.all([
      api.get<{
        team: { id: string; name: string; slug: string };
        viewerRole: Role;
        members: Member[];
      }>(`/api/teams/${id}`),
      api.get<{ rules: TeamRule[] }>(`/api/teams/${id}/rules`),
    ]);
    const team: Team = {
      id: detailRes.team.id,
      name: detailRes.team.name,
      slug: detailRes.team.slug,
      memberCount: detailRes.members.length,
    };
    return {
      team,
      viewerRole: detailRes.viewerRole,
      members: detailRes.members,
      rules: rulesRes.rules,
    };
  }, [id]);

  const canManage = data?.viewerRole === "owner" || data?.viewerRole === "admin";

  // Add member (POST /api/teams/[id]/members). Roster listing + removal aren't
  // exposed by the REST API, so this is add-only; the server gates to admins.
  const [email, setEmail] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  async function addMember() {
    const value = email.trim();
    if (!value) return;
    setAddingMember(true);
    try {
      const res = await api.post<{ ok: boolean; name: string }>(`/api/teams/${id}/members`, {
        email: value,
      });
      setEmail("");
      Alert.alert("Member added", `${res.name} is now on the team.`);
      reload();
    } catch (err) {
      Alert.alert(
        "Couldn't add member",
        err instanceof ApiError ? err.message : "Please try again.",
      );
    } finally {
      setAddingMember(false);
    }
  }

  // Remove member (DELETE /api/teams/[id]/members/[memberId]). Owner/admin only;
  // the owner can't be removed. Server enforces both — we mirror in the UI.
  function confirmRemoveMember(member: Member) {
    Alert.alert("Remove member?", member.name ?? member.email, [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api.del(`/api/teams/${id}/members/${member.id}`);
            reload();
          } catch (err) {
            Alert.alert(
              "Couldn't remove",
              err instanceof ApiError ? err.message : "Please try again.",
            );
          }
        },
      },
    ]);
  }

  // Add rule (POST /api/teams/[id]/rules).
  const [ruleKind, setRuleKind] = useState<"holiday" | "no_meeting">("holiday");
  const [ruleLabel, setRuleLabel] = useState("");
  const [ruleDate, setRuleDate] = useState("");
  const [ruleDow, setRuleDow] = useState<number | null>(null); // null = every day
  const [ruleStart, setRuleStart] = useState("13:00");
  const [ruleEnd, setRuleEnd] = useState("17:00");
  const [savingRule, setSavingRule] = useState(false);

  const canAddRule =
    ruleKind === "holiday"
      ? DATE_RE.test(ruleDate.trim())
      : TIME_RE.test(ruleStart.trim()) &&
        TIME_RE.test(ruleEnd.trim()) &&
        toMin(ruleEnd.trim()) > toMin(ruleStart.trim());

  async function addRule() {
    if (!canAddRule) return;
    setSavingRule(true);
    try {
      const body =
        ruleKind === "holiday"
          ? { kind: "holiday", label: ruleLabel.trim() || undefined, theDate: ruleDate.trim() }
          : {
              kind: "no_meeting",
              label: ruleLabel.trim() || undefined,
              dayOfWeek: ruleDow,
              startMinute: toMin(ruleStart.trim()),
              endMinute: toMin(ruleEnd.trim()),
            };
      await api.post(`/api/teams/${id}/rules`, body);
      setRuleLabel("");
      setRuleDate("");
      reload();
    } catch (err) {
      Alert.alert("Couldn't add rule", err instanceof ApiError ? err.message : "Please try again.");
    } finally {
      setSavingRule(false);
    }
  }

  function confirmDeleteRule(rule: TeamRule) {
    Alert.alert("Remove rule?", describeRule(rule), [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api.del(`/api/teams/${id}/rules/${rule.id}`);
            reload();
          } catch (err) {
            Alert.alert(
              "Couldn't remove",
              err instanceof ApiError ? err.message : "Please try again.",
            );
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Team" }} />
      {loading && !data ? (
        <Loading />
      ) : error || !data ? (
        <ErrorText message={error ?? "Not found"} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        >
          <Text style={styles.title}>{data.team.name}</Text>
          <Text style={styles.subtitle}>
            {data.team.memberCount} member{data.team.memberCount === 1 ? "" : "s"}
          </Text>

          {/* MEMBERS — roster with role + weight; add/remove gated on admin. */}
          <Text style={styles.section}>Members</Text>
          {data.members.map((m) => (
            <View key={m.id} style={styles.member}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(m.name ?? m.email).charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.memberInfo}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {m.name ?? "Member"}
                  </Text>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{m.role}</Text>
                  </View>
                </View>
                <Text style={styles.memberEmail} numberOfLines={1}>
                  {m.email}
                </Text>
                <Text style={styles.memberWeight}>Weight {m.priority}</Text>
              </View>
              {canManage && m.role !== "owner" ? (
                <Pressable onPress={() => confirmRemoveMember(m)} hitSlop={8}>
                  <Ionicons name="person-remove-outline" size={18} color={colors.faint} />
                </Pressable>
              ) : null}
            </View>
          ))}

          {canManage ? (
            <>
              <Text style={styles.help}>
                Add a teammate by their DayOtter email. They need an account first.
              </Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="teammate@company.com"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
              <Pressable
                style={[styles.primary, (!email.trim() || addingMember) && styles.disabled]}
                onPress={addMember}
                disabled={!email.trim() || addingMember}
              >
                <Ionicons name="person-add-outline" size={16} color={colors.white} />
                <Text style={styles.primaryText}>{addingMember ? "Adding…" : "Add member"}</Text>
              </Pressable>
            </>
          ) : null}

          {/* RULES — list, add (holiday / meeting-free window), remove. */}
          <Text style={styles.section}>Scheduling rules</Text>
          <Text style={styles.help}>
            Company holidays and meeting-free windows that block bookings for every member.
          </Text>
          {data.rules.length > 0 ? (
            data.rules.map((r) => (
              <View key={r.id} style={styles.rule}>
                <Ionicons
                  name={r.kind === "holiday" ? "calendar-clear-outline" : "time-outline"}
                  size={18}
                  color={colors.accent}
                />
                <View style={{ flex: 1 }}>
                  {r.label ? <Text style={styles.ruleName}>{r.label}</Text> : null}
                  <Text style={styles.ruleDesc}>{describeRule(r)}</Text>
                </View>
                {canManage ? (
                  <Pressable onPress={() => confirmDeleteRule(r)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.faint} />
                  </Pressable>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.help}>
              No rules yet. Add a company holiday or meeting-free window below.
            </Text>
          )}

          {canManage ? (
            <>
              <Text style={styles.subsection}>New rule</Text>
              <View style={styles.pills}>
                {(["holiday", "no_meeting"] as const).map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => setRuleKind(k)}
                    style={[styles.pill, k === ruleKind && styles.pillOn]}
                  >
                    <Text style={[styles.pillText, k === ruleKind && styles.pillTextOn]}>
                      {k === "holiday" ? "Company holiday" : "Meeting-free window"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                style={styles.input}
                value={ruleLabel}
                onChangeText={setRuleLabel}
                placeholder={
                  ruleKind === "holiday" ? "Christmas Day (optional)" : "Focus Fridays (optional)"
                }
                placeholderTextColor={colors.faint}
              />

              {ruleKind === "holiday" ? (
                <TextInput
                  style={styles.input}
                  value={ruleDate}
                  onChangeText={setRuleDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              ) : (
                <>
                  <Text style={styles.fieldLabel}>Day</Text>
                  <View style={styles.pills}>
                    <Pressable
                      onPress={() => setRuleDow(null)}
                      style={[styles.pill, ruleDow === null && styles.pillOn]}
                    >
                      <Text style={[styles.pillText, ruleDow === null && styles.pillTextOn]}>
                        Every day
                      </Text>
                    </Pressable>
                    {DAYS.map((d, i) => (
                      <Pressable
                        key={d}
                        onPress={() => setRuleDow(i)}
                        style={[styles.pill, ruleDow === i && styles.pillOn]}
                      >
                        <Text style={[styles.pillText, ruleDow === i && styles.pillTextOn]}>
                          {d}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.timeRow}>
                    <View style={styles.timeCol}>
                      <Text style={styles.fieldLabel}>From</Text>
                      <TextInput
                        style={styles.input}
                        value={ruleStart}
                        onChangeText={setRuleStart}
                        placeholder="13:00"
                        placeholderTextColor={colors.faint}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    <View style={styles.timeCol}>
                      <Text style={styles.fieldLabel}>To</Text>
                      <TextInput
                        style={styles.input}
                        value={ruleEnd}
                        onChangeText={setRuleEnd}
                        placeholder="17:00"
                        placeholderTextColor={colors.faint}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>
                </>
              )}

              <Pressable
                style={[styles.primary, (!canAddRule || savingRule) && styles.disabled]}
                onPress={addRule}
                disabled={!canAddRule || savingRule}
              >
                <Ionicons name="add" size={18} color={colors.white} />
                <Text style={styles.primaryText}>{savingRule ? "Adding…" : "Add rule"}</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  subtitle: { color: colors.muted, marginTop: 4 },
  section: { marginTop: 26, marginBottom: 6, fontWeight: "700", color: colors.text, fontSize: 16 },
  subsection: { marginTop: 18, marginBottom: 10, fontWeight: "600", color: colors.muted },
  help: { color: colors.muted, fontSize: 13, marginBottom: 12, lineHeight: 18 },
  fieldLabel: { color: colors.muted, fontSize: 13, marginBottom: 6 },
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
    marginBottom: 12,
  },
  timeRow: { flexDirection: "row", gap: 12 },
  timeCol: { flex: 1 },
  member: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  avatar: {
    height: 36,
    width: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  memberName: { color: colors.text, fontWeight: "600", flexShrink: 1 },
  roleBadge: {
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  memberEmail: { color: colors.muted, fontSize: 12, marginTop: 2 },
  memberWeight: { color: colors.faint, fontSize: 11, marginTop: 2 },
  rule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  ruleName: { color: colors.text, fontWeight: "600" },
  ruleDesc: { color: colors.muted, fontSize: 12, marginTop: 2 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  pill: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  pillOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pillText: { color: colors.muted, fontSize: 13 },
  pillTextOn: { color: colors.text, fontWeight: "600" },
  primary: {
    marginTop: 6,
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  disabled: { opacity: 0.5 },
});
