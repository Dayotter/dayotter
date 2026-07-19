import { ApiError, api } from "@/api";
import { EmptyState, ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import type { EventType } from "@/models";
import { colors, radius } from "@/theme";
import { Stack } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

/** A host's package offering (GET /api/packages → packages[]). */
interface PackageRow {
  id: string;
  eventTypeId: string;
  name: string;
  sessionCount: number;
  priceAmount: number;
  currency: string;
  isActive: boolean;
}

/** An outstanding client balance (GET /api/packages → credits[]). */
interface CreditRow {
  id: string;
  eventTypeId: string;
  clientEmail: string;
  total: number;
  used: number;
  remaining: number;
}

interface PackagesResponse {
  packages: PackageRow[];
  credits: CreditRow[];
}

function money(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(minor / 100);
  } catch {
    return `$${(minor / 100).toFixed(2)}`;
  }
}

export default function PackagesScreen() {
  const { data, loading, error, reload } = useAsync<PackagesResponse>(async () => {
    return await api.get<PackagesResponse>("/api/packages");
  });

  // Event types are needed to scope a new package to a booking type.
  const eventTypesState = useAsync<EventType[]>(async () => {
    const res = await api.get<{ eventTypes: EventType[] }>("/api/event-types");
    return res.eventTypes;
  });
  const eventTypes = eventTypesState.data ?? [];

  function titleFor(id: string): string {
    return eventTypes.find((e) => e.id === id)?.title ?? "Unknown booking type";
  }

  // Create-package modal.
  const [createOpen, setCreateOpen] = useState(false);
  const [eventTypeId, setEventTypeId] = useState("");
  const [name, setName] = useState("");
  const [sessions, setSessions] = useState("5");
  const [price, setPrice] = useState("250");
  const [saving, setSaving] = useState(false);

  // Grant-credits modal (scoped to the tapped package).
  const [grantFor, setGrantFor] = useState<PackageRow | null>(null);
  const [grantEmail, setGrantEmail] = useState("");
  const [granting, setGranting] = useState(false);

  function openCreate() {
    setName("");
    setSessions("5");
    setPrice("250");
    setEventTypeId(eventTypes[0]?.id ?? "");
    setCreateOpen(true);
  }

  async function createPackage() {
    const sessionCount = Math.round(Number(sessions));
    const priceAmount = Math.round(Number(price) * 100);
    if (!eventTypeId || !name.trim() || !Number.isFinite(sessionCount) || sessionCount < 1) return;
    setSaving(true);
    try {
      await api.post("/api/packages", {
        eventTypeId,
        name: name.trim(),
        sessionCount,
        priceAmount: Number.isFinite(priceAmount) && priceAmount > 0 ? priceAmount : 0,
        currency: "usd",
      });
      setCreateOpen(false);
      Alert.alert("Package created", `${name.trim()} is now available.`);
      reload();
    } catch (e) {
      Alert.alert("Couldn't create", e instanceof ApiError ? e.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function openGrant(pkg: PackageRow) {
    setGrantFor(pkg);
    setGrantEmail("");
  }

  async function grant() {
    const email = grantEmail.trim();
    if (!grantFor || !email) return;
    setGranting(true);
    try {
      await api.post("/api/packages/grant", { packageId: grantFor.id, clientEmail: email });
      setGrantFor(null);
      Alert.alert("Credits granted", `${grantFor.sessionCount} credits granted to ${email}.`);
      reload();
    } catch (e) {
      Alert.alert("Couldn't grant", e instanceof ApiError ? e.message : "Please try again.");
    } finally {
      setGranting(false);
    }
  }

  const packages = data?.packages ?? [];
  const credits = data?.credits ?? [];
  const noEventTypes = !eventTypesState.loading && eventTypes.length === 0;

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Packages" }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorText message={error} />
        ) : (
          <>
            {noEventTypes ? (
              <EmptyState
                title="Create a booking type first"
                body="Packages are sold against one of your booking types. Add a booking type, then come back here."
              />
            ) : (
              <Pressable style={styles.newBtn} onPress={openCreate}>
                <Text style={styles.newBtnText}>+ New package</Text>
              </Pressable>
            )}

            <Text style={styles.section}>Your packages</Text>
            {packages.length === 0 ? (
              <EmptyState
                title="No packages yet"
                body="Sell a bundle of prepaid sessions for one of your booking types."
              />
            ) : (
              packages.map((p) => (
                <View key={p.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardName}>{p.name}</Text>
                    <Text style={styles.cardMeta}>
                      {p.sessionCount} sessions · {money(p.priceAmount, p.currency)}
                    </Text>
                  </View>
                  <Text style={styles.cardSub}>{titleFor(p.eventTypeId)}</Text>
                  <Pressable style={styles.grantBtn} onPress={() => openGrant(p)}>
                    <Text style={styles.grantBtnText}>Grant credits</Text>
                  </Pressable>
                </View>
              ))
            )}

            <Text style={styles.section}>Client balances</Text>
            {credits.length === 0 ? (
              <Text style={styles.hint}>
                No credits issued yet. Grant a package above, or share a purchase link from the web
                app.
              </Text>
            ) : (
              credits.map((c) => (
                <View key={c.id} style={styles.balanceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.balanceEmail}>{c.clientEmail}</Text>
                    <Text style={styles.cardSub}>{titleFor(c.eventTypeId)}</Text>
                  </View>
                  <Text style={[styles.balanceCount, c.remaining === 0 && { color: colors.faint }]}>
                    {c.used} of {c.total} used
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Create package modal */}
      <Modal
        visible={createOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>New package</Text>
              <Text style={styles.hint}>
                Clients spend one credit each time they book this booking type.
              </Text>

              <Text style={styles.label}>Booking type</Text>
              <View style={styles.pills}>
                {eventTypes.map((et) => (
                  <Pressable
                    key={et.id}
                    onPress={() => setEventTypeId(et.id)}
                    style={[styles.pill, et.id === eventTypeId && styles.pillOn]}
                  >
                    <Text style={[styles.pillText, et.id === eventTypeId && styles.pillTextOn]}>
                      {et.title}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Coaching 5-pack"
                placeholderTextColor={colors.faint}
              />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Sessions</Text>
                  <TextInput
                    style={styles.input}
                    value={sessions}
                    onChangeText={setSessions}
                    keyboardType="number-pad"
                    placeholder="5"
                    placeholderTextColor={colors.faint}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Price (USD)</Text>
                  <TextInput
                    style={styles.input}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                    placeholder="250"
                    placeholderTextColor={colors.faint}
                  />
                </View>
              </View>

              <Pressable
                style={[styles.save, (saving || !name.trim() || !eventTypeId) && styles.disabled]}
                onPress={createPackage}
                disabled={saving || !name.trim() || !eventTypeId}
              >
                <Text style={styles.saveText}>{saving ? "Creating…" : "Create package"}</Text>
              </Pressable>
              <Pressable style={styles.cancel} onPress={() => setCreateOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Grant credits modal */}
      <Modal
        visible={grantFor !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setGrantFor(null)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Grant credits</Text>
            {grantFor ? (
              <Text style={styles.hint}>
                Give {grantFor.sessionCount} credits of “{grantFor.name}” to a client who paid
                offline.
              </Text>
            ) : null}

            <Text style={styles.label}>Client email</Text>
            <TextInput
              style={styles.input}
              value={grantEmail}
              onChangeText={setGrantEmail}
              placeholder="client@example.com"
              placeholderTextColor={colors.faint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Pressable
              style={[styles.save, (granting || !grantEmail.trim()) && styles.disabled]}
              onPress={grant}
              disabled={granting || !grantEmail.trim()}
            >
              <Text style={styles.saveText}>{granting ? "Granting…" : "Grant credits"}</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => setGrantFor(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  newBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  newBtnText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  section: { marginTop: 18, marginBottom: 10, fontWeight: "600", color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  cardName: { color: colors.text, fontWeight: "600", fontSize: 15, flexShrink: 1 },
  cardMeta: { color: colors.muted, fontSize: 13 },
  cardSub: { color: colors.faint, fontSize: 12, marginTop: 2 },
  grantBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  grantBtnText: { color: colors.text, fontWeight: "600", fontSize: 13 },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  balanceEmail: { color: colors.text, fontWeight: "600" },
  balanceCount: { color: colors.muted, fontSize: 13 },
  hint: { color: colors.faint, fontSize: 13, marginBottom: 4 },
  // Modal
  backdrop: { flex: 1, backgroundColor: "#00000055", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 20,
    paddingBottom: 32,
    maxHeight: "90%",
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 6 },
  label: { color: colors.muted, fontWeight: "600", fontSize: 13, marginBottom: 6, marginTop: 12 },
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
  },
  row: { flexDirection: "row", gap: 12 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
  save: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  disabled: { opacity: 0.5 },
  cancel: { marginTop: 10, paddingVertical: 12, alignItems: "center" },
  cancelText: { color: colors.muted, fontWeight: "600", fontSize: 14 },
});
