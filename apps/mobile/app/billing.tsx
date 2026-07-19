import { ApiError, api, getServerUrl } from "@/api";
import { ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

/** Per-seat monthly price, mirroring the web app's PRO_PRICE_USD / pro-lock copy. */
const PRO_PRICE_USD = 9;

/** Headline Pro capabilities, matching the web billing page's feature list. */
const PRO_FEATURES = [
  "AI scheduling assistant",
  "Automations & workflows",
  "Booking-funnel analytics",
  "Developer platform & API keys",
  "Team scheduling",
];

/** Shape of `entitlements` from GET /api/me (lib/billing/entitlements.ts). */
interface Entitlements {
  edition: "cloud" | "self-hosted";
  plan: "free" | "pro";
  isCloud: boolean;
  isPro: boolean;
  organizationId: string | null;
  features?: Record<string, boolean>;
}

interface MeResponse {
  entitlements: Entitlements;
  /** True when Stripe is configured on this deployment. */
  paymentsEnabled?: boolean;
}

/** POST /api/billing/{portal,checkout} both return a Stripe redirect URL. */
interface BillingUrl {
  url?: string;
}

function FeatureList() {
  return (
    <View style={styles.features}>
      {PRO_FEATURES.map((f) => (
        <View key={f} style={styles.featureRow}>
          <Ionicons name="checkmark" size={16} color={colors.accent} />
          <Text style={styles.featureText}>{f}</Text>
        </View>
      ))}
    </View>
  );
}

export default function BillingScreen() {
  const { data, loading, error } = useAsync<MeResponse>(() => api.get<MeResponse>("/api/me"));
  const [busy, setBusy] = useState(false);

  /** Fetch a Stripe URL from the API and hand off to the browser; fall back to
   *  the web billing page if the endpoint is unavailable or returns no URL. */
  async function openBilling(path: "/api/billing/portal" | "/api/billing/checkout") {
    setBusy(true);
    try {
      const res = await api.post<BillingUrl>(path, {});
      const url = res.url ?? `${getServerUrl()}/settings/billing`;
      await Linking.openURL(url);
    } catch (e) {
      // Owner/admin-only or misconfigured billing surfaces here - degrade to the
      // web settings page rather than dead-ending the user.
      if (e instanceof ApiError && e.status !== 400 && e.status !== 404) {
        Alert.alert("Couldn't open billing", e.message);
      } else {
        await Linking.openURL(`${getServerUrl()}/settings/billing`).catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }

  const ent = data?.entitlements;

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Billing" }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorText message={error} />
        ) : !ent ? (
          <ErrorText message="Couldn't load your plan." />
        ) : !ent.isCloud ? (
          // Self-hosted: no billing - every Pro feature is free, forever.
          <View style={styles.card}>
            <View style={styles.selfRow}>
              <Ionicons name="heart" size={16} color={colors.accent} />
              <Text style={styles.selfTitle}>Self-hosted — everything unlocked</Text>
            </View>
            <Text style={styles.body}>
              You're running the open-source edition. Every Pro feature is free, forever. No
              subscription needed.
            </Text>
            <FeatureList />
          </View>
        ) : (
          // DayOtter Cloud: show the plan and the upgrade / manage actions.
          <View style={styles.card}>
            <View style={styles.planHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.overline}>Current plan</Text>
                <Text style={styles.planName}>{ent.plan === "pro" ? "Pro" : "Free"}</Text>
              </View>
              <Text style={styles.planMeta}>
                {ent.plan === "pro"
                  ? `$${PRO_PRICE_USD}/seat/mo`
                  : `$${PRO_PRICE_USD}/seat/mo unlocks everything below`}
              </Text>
            </View>

            <FeatureList />

            {data?.paymentsEnabled === false ? (
              <Text style={styles.hint}>Billing isn't fully configured on this server yet.</Text>
            ) : ent.plan === "pro" ? (
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => openBilling("/api/billing/portal")}
                disabled={busy}
              >
                <Text style={styles.secondaryText}>{busy ? "Opening…" : "Manage billing"}</Text>
              </Pressable>
            ) : Platform.OS === "ios" ? (
              // iOS: no external purchase CTA / pricing (App Store guideline 3.1.1).
              <Text style={styles.hint}>This is included with the DayOtter Pro plan.</Text>
            ) : (
              <Pressable
                style={styles.primaryBtn}
                onPress={() => openBilling("/api/billing/checkout")}
                disabled={busy}
              >
                <Text style={styles.primaryText}>{busy ? "Starting…" : "Upgrade to Pro"}</Text>
              </Pressable>
            )}
          </View>
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
    padding: 18,
    gap: 16,
  },
  planHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  overline: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.faint,
  },
  planName: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 2 },
  planMeta: { flexShrink: 1, textAlign: "right", fontSize: 13, color: colors.muted, marginTop: 14 },
  selfRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  selfTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  features: { gap: 10 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { color: colors.text, fontSize: 14 },
  hint: { color: colors.faint, fontSize: 13, lineHeight: 19 },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryText: { color: colors.text, fontWeight: "600", fontSize: 15 },
});
