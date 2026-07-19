import { ApiError, api, getServerUrl } from "@/api";
import { Badge, EmptyState, ErrorText, Loading } from "@/components/ui";
import { useAsync } from "@/hooks";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

// CRM sync is web-CRM parity. The two supported providers mirror
// packages/integrations/src/crm/types.ts (CRM_PROVIDERS) and the web settings
// page apps/web/app/(app)/settings/crm/page.tsx.
type CrmProviderId = "salesforce" | "hubspot";

interface ProviderMeta {
  id: CrmProviderId;
  name: string;
  color: string;
  blurb: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: "salesforce",
    name: "Salesforce",
    color: "#00A1E0",
    blurb: "Log every booking as an Event on the matched Contact.",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    color: "#FF7A59",
    blurb: "Create the contact and log the meeting, kept in sync on reschedule.",
  },
];

// Shape of a connected CRM, mirroring the crmConnections columns the web page reads
// (id, provider, accountLabel, externalAccountId, lastError).
interface CrmConnection {
  id: string;
  provider: CrmProviderId;
  accountLabel?: string | null;
  externalAccountId?: string | null;
  lastError?: string | null;
}

// Status payload we consume when the server exposes a client-readable CRM endpoint,
// mirroring the web page's two data sources: the connection list + crmEnabledProviders().
// Matches the /api/calendars `{ connections }` convention.
interface CrmStatusResponse {
  connections: CrmConnection[];
  enabled: CrmProviderId[];
}

// The web CRM settings page reads the DB directly on the server; there is no
// client GET yet. Until one lands we degrade to a "manage on the web" launcher
// so the screen is still useful instead of erroring. When the status endpoint
// ships, we render live connected/enabled state automatically.
type CrmState =
  | { mode: "status"; connections: CrmConnection[]; enabled: CrmProviderId[] }
  | { mode: "web" };

const STATUS_PATH = "/api/integrations/crm";
const WEB_SETTINGS_URL = `${getServerUrl()}/settings/crm`;

export default function CrmScreen() {
  const { data, loading, error, reload } = useAsync<CrmState>(async () => {
    try {
      const res = await api.get<CrmStatusResponse>(STATUS_PATH);
      return {
        mode: "status",
        connections: res.connections ?? [],
        enabled: res.enabled ?? [],
      };
    } catch (e) {
      // No client-readable status endpoint on this server -> web-managed fallback.
      // Any other failure (auth, network) is a real error worth surfacing.
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
        return { mode: "web" };
      }
      throw e;
    }
  });

  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<CrmProviderId | null>(null);

  function onRefresh() {
    setRefreshing(true);
    reload();
    // useAsync flips loading synchronously; drop the spinner on the next tick.
    setTimeout(() => setRefreshing(false), 600);
  }

  function openWeb() {
    Linking.openURL(WEB_SETTINGS_URL);
  }

  async function disconnect(provider: CrmProviderId) {
    setBusy(provider);
    try {
      await api.del(`/api/integrations/crm/${provider}`);
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        // Already gone server-side - refresh to reconcile.
        reload();
      } else {
        Alert.alert("Couldn't disconnect", e instanceof ApiError ? e.message : "Please try again.");
      }
    } finally {
      setBusy(null);
    }
  }

  function confirmDisconnect(meta: ProviderMeta) {
    Alert.alert(`Disconnect ${meta.name}?`, "New bookings will stop syncing to this CRM.", [
      { text: "Keep", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: () => disconnect(meta.id) },
    ]);
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "CRM",
          headerRight: () => (
            <Pressable onPress={reload} hitSlop={10} accessibilityLabel="Reload">
              <Ionicons name="refresh" size={20} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorText message={error} />
        ) : (
          <>
            <Text style={styles.lead}>
              Push every booking to your CRM: DayOtter finds or creates the guest as a contact and
              logs the meeting as an activity - updated on reschedule, closed on cancel.
            </Text>

            {PROVIDERS.map((meta) => {
              const status = data?.mode === "status" ? data : null;
              const conn = status?.connections.find((c) => c.provider === meta.id) ?? null;
              const isConnected = Boolean(conn);
              const isEnabled = status ? status.enabled.includes(meta.id) : false;

              return (
                <View key={meta.id} style={styles.row}>
                  <View style={[styles.brandDot, { backgroundColor: meta.color }]} />
                  <View style={styles.rowBody}>
                    <View style={styles.rowTitleLine}>
                      <Text style={styles.name}>{meta.name}</Text>
                      {isConnected ? <Badge label="Connected" color={colors.success} /> : null}
                    </View>
                    <Text style={styles.blurb}>
                      {conn?.accountLabel || conn?.externalAccountId || meta.blurb}
                    </Text>
                    {conn?.lastError ? (
                      <Text style={styles.err}>Last sync error: {conn.lastError}</Text>
                    ) : null}
                  </View>

                  {/* Action column: mirrors the web page's per-provider states. */}
                  {status === null ? (
                    // Web-managed fallback: no readable status, so send to the web page.
                    <Pressable style={styles.linkBtn} onPress={openWeb} hitSlop={6}>
                      <Ionicons name="open-outline" size={16} color={colors.accent} />
                      <Text style={styles.linkText}>Manage</Text>
                    </Pressable>
                  ) : isConnected ? (
                    <Pressable
                      style={styles.dangerBtn}
                      onPress={() => confirmDisconnect(meta)}
                      disabled={busy === meta.id}
                      hitSlop={6}
                    >
                      <Text style={styles.dangerText}>
                        {busy === meta.id ? "Removing…" : "Disconnect"}
                      </Text>
                    </Pressable>
                  ) : isEnabled ? (
                    <Pressable style={styles.linkBtn} onPress={openWeb} hitSlop={6}>
                      <Ionicons name="add" size={16} color={colors.accent} />
                      <Text style={styles.linkText}>Connect</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.notConfigured}>Not configured</Text>
                  )}
                </View>
              );
            })}

            {data?.mode === "web" ? (
              <EmptyState
                title="Manage CRM sync on the web"
                body="Connecting a CRM uses a secure OAuth sign-in that opens in your browser. Tap Manage on a provider to connect or disconnect on the DayOtter web app."
              />
            ) : data?.mode === "status" && data.enabled.length === 0 ? (
              <Text style={styles.hint}>
                No CRM is configured on this server. An admin sets the provider OAuth credentials
                (SALESFORCE_CLIENT_ID / HUBSPOT_CLIENT_ID + secrets) to enable connecting.
              </Text>
            ) : null}

            <Pressable style={styles.webRow} onPress={openWeb}>
              <Ionicons name="open-outline" size={18} color={colors.text} />
              <Text style={styles.webRowText}>Open CRM settings on the web</Text>
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
  lead: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  brandDot: { width: 12, height: 12, borderRadius: 999 },
  rowBody: { flex: 1 },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { color: colors.text, fontWeight: "600", fontSize: 15 },
  blurb: { color: colors.muted, fontSize: 12, marginTop: 2 },
  err: { color: colors.danger, fontSize: 12, marginTop: 4 },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  linkText: { color: colors.accent, fontWeight: "600", fontSize: 14 },
  dangerBtn: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  dangerText: { color: colors.danger, fontWeight: "600", fontSize: 13 },
  notConfigured: { color: colors.faint, fontSize: 12 },
  hint: { color: colors.faint, fontSize: 12, lineHeight: 18, marginTop: 8 },
  webRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  webRowText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "500" },
});
