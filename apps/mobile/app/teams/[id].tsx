import { ApiError, api } from "@/api";
import { ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import type { Team } from "@/models";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
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
  publicBookable: boolean;
}

/** A team event type (GET /api/teams/[id]/event-types). */
interface TeamEventType {
  id: string;
  title: string;
  slug: string;
  durationMinutes: number;
  schedulingType: string;
  isActive: boolean;
}

/** Everything the detail screen needs, loaded together so one reload refreshes all. */
interface DetailData {
  team: Team;
  viewerRole: Role;
  members: Member[];
  rules: TeamRule[];
  eventTypes: TeamEventType[];
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
  const router = useRouter();
  const { data, loading, error, reload } = useAsync<DetailData>(async () => {
    const [detailRes, rulesRes, eventsRes] = await Promise.all([
      api.get<{
        team: { id: string; name: string; slug: string };
        viewerRole: Role;
        members: Member[];
      }>(`/api/teams/${id}`),
      api.get<{ rules: TeamRule[] }>(`/api/teams/${id}/rules`),
      api.get<{ eventTypes: TeamEventType[] }>(`/api/teams/${id}/event-types`),
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
      eventTypes: eventsRes.eventTypes,
    };
  }, [id]);

  const canManage = data?.viewerRole === "owner" || data?.viewerRole === "admin";

  // Create a team event type (POST /api/teams/[id]/event-types). The full set of
  // fields is edited afterwards in the shared event-type editor.
  const [etTitle, setEtTitle] = useState("");
  const [etDuration, setEtDuration] = useState(30);
  const [etType, setEtType] = useState<"collective" | "round_robin">("collective");
  const [creatingEvent, setCreatingEvent] = useState(false);

  async function createEventType() {
    const title = etTitle.trim();
    if (!title) return;
    setCreatingEvent(true);
    try {
      const res = await api.post<{ id: string }>(`/api/teams/${id}/event-types`, {
        title,
        durationMinutes: etDuration,
        schedulingType: etType,
      });
      setEtTitle("");
      reload();
      // Jump straight into the full editor to finish setup (location, limits, ...).
      router.push({ pathname: "/event-type", params: { id: res.id } });
    } catch (e) {
      Alert.alert("Couldn't create", e instanceof ApiError ? e.message : "Please try again.");
    } finally {
      setCreatingEvent(false);
    }
  }

  // Member controls (PATCH /api/teams/[id]/members/[memberId]). Each accepts one
  // of: round-robin weight, publicBookable, or a role change (promote/transfer).
  async function patchMember(memberId: string, patch: Record<string, unknown>) {
    try {
      await api.patch(`/api/teams/${id}/members/${memberId}`, patch);
      reload();
    } catch (e) {
      Alert.alert("Couldn't update", e instanceof ApiError ? e.message : "Please try again.");
    }
  }

  function setWeight(m: Member, next: number) {
    const clamped = Math.max(0, Math.min(10, next));
    if (clamped !== m.priority) patchMember(m.id, { priority: clamped });
  }

  function confirmPromote(m: Member) {
    Alert.alert("Promote to admin", `Give ${m.name ?? m.email} admin access to this team?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Promote", onPress: () => patchMember(m.id, { role: "admin" }) },
    ]);
  }

  function confirmTransfer(m: Member) {
    Alert.alert(
      "Transfer ownership",
      `Make ${m.name ?? m.email} the owner? You'll become an admin. This can't be undone by you alone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Transfer",
          style: "destructive",
          onPress: () => patchMember(m.id, { role: "owner" }),
        },
      ],
    );
  }

  function confirmDeleteEventType(et: TeamEventType) {
    Alert.alert("Delete event type", `Delete "${et.title}"? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.del(`/api/event-types/${et.id}`);
            reload();
          } catch (e) {
            Alert.alert("Couldn't delete", e instanceof ApiError ? e.message : "Please try again.");
          }
        },
      },
    ]);
  }

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
            <View key={m.id} style={styles.memberCard}>
              <View style={styles.memberTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(m.name ?? m.email).charAt(0).toUpperCase()}
                  </Text>
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
                  {!canManage ? <Text style={styles.memberWeight}>Weight {m.priority}</Text> : null}
                </View>
                {canManage && m.role !== "owner" ? (
                  <Pressable onPress={() => confirmRemoveMember(m)} hitSlop={8}>
                    <Ionicons name="person-remove-outline" size={18} color={colors.faint} />
                  </Pressable>
                ) : null}
              </View>

              {canManage ? (
                <View style={styles.memberControls}>
                  <View style={styles.ctrlRow}>
                    <Text style={styles.ctrlLabel}>Weight</Text>
                    <Pressable
                      style={styles.stepBtn}
                      hitSlop={6}
                      onPress={() => setWeight(m, m.priority - 1)}
                    >
                      <Ionicons name="remove" size={16} color={colors.text} />
                    </Pressable>
                    <Text style={styles.weightVal}>{m.priority}</Text>
                    <Pressable
                      style={styles.stepBtn}
                      hitSlop={6}
                      onPress={() => setWeight(m, m.priority + 1)}
                    >
                      <Ionicons name="add" size={16} color={colors.text} />
                    </Pressable>
                  </View>
                  <View style={styles.ctrlRow}>
                    <Text style={styles.ctrlLabel}>Bookable</Text>
                    <Switch
                      value={m.publicBookable}
                      onValueChange={(v) => patchMember(m.id, { publicBookable: v })}
                    />
                  </View>
                  {(m.role === "member" && canManage) ||
                  (data.viewerRole === "owner" && m.role !== "owner") ? (
                    <View style={styles.memberActions}>
                      {m.role === "member" ? (
                        <Pressable style={styles.smallBtn} onPress={() => confirmPromote(m)}>
                          <Text style={styles.smallBtnText}>Make admin</Text>
                        </Pressable>
                      ) : null}
                      {data.viewerRole === "owner" ? (
                        <Pressable style={styles.smallBtn} onPress={() => confirmTransfer(m)}>
                          <Text style={styles.smallBtnText}>Make owner</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
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

          {/* TEAM EVENT TYPES — list, create (collective / round-robin), edit, delete. */}
          <Text style={styles.section}>Team event types</Text>
          {data.eventTypes.length === 0 ? (
            <Text style={styles.help}>No team event types yet.</Text>
          ) : (
            data.eventTypes.map((et) => (
              <Pressable
                key={et.id}
                style={styles.memberRow}
                onPress={() => router.push({ pathname: "/event-type", params: { id: et.id } })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>
                    {et.title}
                    {et.isActive ? "" : " (inactive)"}
                  </Text>
                  <Text style={styles.memberMeta}>
                    {et.durationMinutes}m ·{" "}
                    {et.schedulingType === "round_robin" ? "Round-robin" : "Collective"}
                  </Text>
                </View>
                {canManage ? (
                  <Pressable hitSlop={8} onPress={() => confirmDeleteEventType(et)}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                )}
              </Pressable>
            ))
          )}
          {canManage ? (
            <View style={styles.addBox}>
              <TextInput
                style={styles.input}
                value={etTitle}
                onChangeText={setEtTitle}
                placeholder="New event type title"
                placeholderTextColor={colors.faint}
              />
              <View style={styles.etControls}>
                <View style={styles.pills}>
                  {[15, 30, 45, 60].map((d) => (
                    <Pressable
                      key={d}
                      onPress={() => setEtDuration(d)}
                      style={[styles.pill, d === etDuration && styles.pillOn]}
                    >
                      <Text style={[styles.pillText, d === etDuration && styles.pillTextOn]}>
                        {d}m
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.pills}>
                  {(["collective", "round_robin"] as const).map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setEtType(t)}
                      style={[styles.pill, t === etType && styles.pillOn]}
                    >
                      <Text style={[styles.pillText, t === etType && styles.pillTextOn]}>
                        {t === "round_robin" ? "Round-robin" : "Collective"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Pressable
                style={[styles.primary, (!etTitle.trim() || creatingEvent) && styles.disabled]}
                onPress={createEventType}
                disabled={!etTitle.trim() || creatingEvent}
              >
                <Ionicons name="add-circle-outline" size={16} color={colors.white} />
                <Text style={styles.primaryText}>
                  {creatingEvent ? "Creating…" : "Create event type"}
                </Text>
              </Pressable>
            </View>
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
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  memberMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  addBox: { gap: 10, marginBottom: 10 },
  etControls: { gap: 8 },
  memberWeight: { color: colors.faint, fontSize: 11, marginTop: 2 },
  memberCard: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  memberTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  memberControls: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  ctrlRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ctrlLabel: { color: colors.muted, fontSize: 13, flex: 1 },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  weightVal: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    minWidth: 20,
    textAlign: "center",
  },
  memberActions: { flexDirection: "row", gap: 8 },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  smallBtnText: { color: colors.text, fontSize: 12, fontWeight: "600" },
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
