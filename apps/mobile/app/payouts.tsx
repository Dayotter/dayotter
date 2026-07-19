import { ApiError, api, getServerUrl } from "@/api";
import { ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

// --- Local types -------------------------------------------------------------
// Mirrors the web Payouts settings (apps/web/components/payouts-panel.tsx +
// apps/web/app/(app)/settings/payouts/page.tsx), fed by GET /api/payments/status.

/** One currency bucket on the host's connected account (minor units). */
interface Balance {
  currency: string;
  /** Minor units clear to withdraw now. */
  available: number;
  /** Minor units still in Stripe's hold period ("on the way"). */
  pending: number;
}

/** GET /api/payments/status shape. */
interface PayoutStatus {
  paymentsEnabled: boolean;
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  balances: Balance[];
  /** WITHDRAW_MINIMUM in minor units (10000 = $100). */
  minimum: number;
  feePercent: number;
}

/** POST /api/payments/withdraw success shape: one entry per paid-out currency. */
interface WithdrawResult {
  ok?: boolean;
  payouts?: { amount: number; currency: string }[];
}

/** Format minor units as currency, mirroring payouts-panel's money(). */
function money(minor: number, currency = "usd"): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(minor / 100);
}

export default function PayoutsScreen() {
  const { data, loading, error, reload } = useAsync<PayoutStatus>(() =>
    api.get<PayoutStatus>("/api/payments/status"),
  );

  const [busy, setBusy] = useState(false);

  // Manual payout - the server pays out every currency bucket that clears the
  // minimum; we surface its result/error and refresh the balances after.
  async function withdraw() {
    setBusy(true);
    try {
      const res = await api.post<WithdrawResult>("/api/payments/withdraw", {});
      const paid = Array.isArray(res.payouts) ? res.payouts : [];
      const sent = paid.map((p) => money(p.amount ?? 0, p.currency)).join(" + ");
      reload();
      Alert.alert("Withdrawal started", `${sent || "Your balance"} is on its way to your bank.`);
    } catch (e) {
      Alert.alert("Couldn't withdraw", e instanceof ApiError ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Confirm before moving money.
  function confirmWithdraw(minimum: number) {
    Alert.alert(
      "Withdraw to bank",
      `Pay out your available balance to your connected bank account? Minimum ${money(minimum)} per currency.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Withdraw", onPress: withdraw },
      ],
    );
  }

  // Stripe Express onboarding needs a full browser redirect - open the web app.
  function openSetup() {
    Linking.openURL(`${getServerUrl()}/settings/payouts`);
  }

  // 302s to the host's Stripe Express dashboard (payout history, bank + tax details).
  function openDashboard() {
    Linking.openURL(`${getServerUrl()}/api/payments/dashboard`);
  }

  const ready = data
    ? data.connected && data.chargesEnabled && data.payoutsEnabled && data.detailsSubmitted
    : false;
  // Withdraw is enabled if ANY currency bucket clears the minimum.
  const canWithdraw = !!data && ready && data.balances.some((b) => b.available >= data.minimum);
  const primary = data?.balances[0]?.currency ?? "usd";

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Payouts" }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorText message={error} />
        ) : !data?.paymentsEnabled ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payouts aren't available</Text>
            <Text style={styles.cardBody}>
              Payments aren't configured on this server. Once your host enables Stripe, you'll be
              able to get paid directly for paid bookings and session packages.
            </Text>
          </View>
        ) : !ready ? (
          // Not connected, or onboarding not finished → send them to Stripe.
          <View style={styles.card}>
            <View style={styles.titleRow}>
              <Ionicons name="card-outline" size={18} color={colors.accent} />
              <Text style={styles.cardTitle}>Get paid directly</Text>
            </View>
            <Text style={styles.cardBody}>
              {data.connected && data.detailsSubmitted
                ? "Your payout account still needs a few details before Stripe can enable charges and payouts."
                : "Connect a Stripe account so booking and package payments land in your bank - not ours. You'll add your bank details on Stripe; it takes a couple of minutes."}
              {data.feePercent > 0
                ? ` DayOtter keeps a ${data.feePercent}% platform fee on each payment; the rest is yours.`
                : ""}
            </Text>
            <Pressable style={styles.primaryBtn} onPress={openSetup}>
              <Ionicons name="open-outline" size={18} color={colors.white} />
              <Text style={styles.primaryText}>
                {data.connected && data.detailsSubmitted
                  ? "Finish setting up payouts"
                  : "Set up payouts (web)"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.titleRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.cardTitle}>Payouts connected</Text>
              </View>
              <Text style={styles.cardBody}>
                {data.feePercent > 0
                  ? `Payments land in your Stripe account minus DayOtter's ${data.feePercent}% fee.`
                  : "Payments land straight in your Stripe account."}
              </Text>

              <View style={styles.balBox}>
                <Text style={styles.balLabel}>Available to withdraw</Text>
                {data.balances.length === 0 ? (
                  <Text style={styles.balValue}>{money(0, primary)}</Text>
                ) : (
                  data.balances.map((b) => (
                    <View key={b.currency} style={styles.balRow}>
                      <Text style={styles.balValue}>{money(b.available, b.currency)}</Text>
                      {b.pending > 0 ? (
                        <Text style={styles.balPending}>
                          {money(b.pending, b.currency)} on the way
                        </Text>
                      ) : null}
                    </View>
                  ))
                )}
                <Text style={styles.balHint}>
                  Minimum withdrawal {money(data.minimum, primary)} per currency. Payouts are manual
                  - withdraw once your balance clears the minimum.
                </Text>
              </View>
            </View>

            <Pressable
              style={[styles.primaryBtn, (!canWithdraw || busy) && styles.btnDisabled]}
              onPress={() => confirmWithdraw(data.minimum)}
              disabled={!canWithdraw || busy}
            >
              <Ionicons name="cash-outline" size={18} color={colors.white} />
              <Text style={styles.primaryText}>{busy ? "Starting…" : "Withdraw to bank"}</Text>
            </Pressable>
            {!canWithdraw ? (
              <Text style={styles.belowMin}>
                You can withdraw once your balance reaches {money(data.minimum, primary)}.
              </Text>
            ) : null}

            <Text style={styles.section}>Manage</Text>

            <Pressable style={styles.addRow} onPress={openDashboard}>
              <Ionicons name="stats-chart-outline" size={18} color={colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={styles.addText}>Open Stripe dashboard</Text>
                <Text style={styles.addSub}>Payout history, bank / tax details.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>

            <Pressable style={styles.addRow} onPress={openSetup}>
              <Ionicons name="open-outline" size={18} color={colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={styles.addText}>Update payout details (web)</Text>
                <Text style={styles.addSub}>Manage your Stripe account.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  cardBody: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  balBox: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
  },
  balLabel: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  balRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
  },
  balValue: { color: colors.text, fontSize: 28, fontWeight: "700" },
  balPending: { color: colors.faint, fontSize: 12 },
  balHint: { color: colors.faint, fontSize: 12, marginTop: 10 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginBottom: 4,
  },
  btnDisabled: { opacity: 0.5 },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: "600" },
  belowMin: { color: colors.muted, fontSize: 13, marginTop: 6 },
  section: { marginTop: 20, marginBottom: 12, fontWeight: "600", color: colors.muted },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  addText: { color: colors.text, fontSize: 15, fontWeight: "500" },
  addSub: { color: colors.faint, fontSize: 12, marginTop: 2 },
});
