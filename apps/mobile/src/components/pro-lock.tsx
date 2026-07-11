import { BASE_URL, api } from "@/api";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

const LABELS: Record<string, string> = {
  ai: "AI scheduling",
  automation: "Automations",
  analytics: "Analytics",
  developer: "Developer platform",
};

/**
 * Whether the account may use `feature`. Reads /api/me entitlements; fails OPEN
 * (allowed) on error so a hiccup never paywalls a self-hoster.
 */
export function useFeature(feature: string): { loading: boolean; allowed: boolean } {
  const [state, setState] = useState({ loading: true, allowed: true });
  useEffect(() => {
    let active = true;
    api
      .get<{ entitlements?: { features?: Record<string, boolean> } }>("/api/me")
      .then((d) => {
        if (active)
          setState({ loading: false, allowed: d.entitlements?.features?.[feature] ?? true });
      })
      .catch(() => active && setState({ loading: false, allowed: true }));
    return () => {
      active = false;
    };
  }, [feature]);
  return state;
}

/** Paywall shown in place of a Pro feature on the free plan (cloud only). */
export function ProLock({ feature }: { feature: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <Ionicons name="lock-closed" size={20} color={colors.accent} />
      </View>
      <Text style={styles.title}>{LABELS[feature] ?? "This"} is a Pro feature</Text>
      <Text style={styles.body}>
        Upgrade to Pro ($9/seat/mo) to unlock it and every other dayotter differentiator.
      </Text>
      <Pressable style={styles.btn} onPress={() => Linking.openURL(`${BASE_URL}/settings/billing`)}>
        <Text style={styles.btnText}>Upgrade on the web</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", padding: 28, gap: 10 },
  icon: {
    height: 46,
    width: 46,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.text, textAlign: "center" },
  body: { color: colors.muted, textAlign: "center", fontSize: 14, lineHeight: 20 },
  btn: {
    marginTop: 6,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  btnText: { color: colors.white, fontWeight: "600" },
});
