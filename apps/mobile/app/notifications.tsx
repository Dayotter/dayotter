import { ApiError, api } from "@/api";
import { EmptyState, Loading } from "@/components/ui";
import type { ChannelType, NotificationChannel } from "@/models";
import { registerPushChannel } from "@/push";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

const LABELS: Record<ChannelType, string> = {
  slack: "Slack",
  whatsapp: "WhatsApp",
  sms: "SMS",
  push: "Mobile push",
};

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  slack: "chatbubbles-outline",
  whatsapp: "logo-whatsapp",
  sms: "chatbox-outline",
  push: "phone-portrait-outline",
  email: "mail-outline",
};

export default function NotificationsScreen() {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [available, setAvailable] = useState<ChannelType[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<ChannelType>("slack");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [adding, setAdding] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPush = channels.some((c) => c.type === "push");

  async function enablePush() {
    setRegistering(true);
    const res = await registerPushChannel();
    setRegistering(false);
    if (res.ok) {
      // Refresh the list so the new device channel appears.
      const d = await api
        .get<{ channels: NotificationChannel[] }>("/api/settings/channels")
        .catch(() => null);
      if (d) setChannels(d.channels);
      Alert.alert("Push enabled", "You'll get meeting reminders on this device.");
      return;
    }
    const msg =
      res.reason === "simulator"
        ? "Push needs a real device (not a simulator)."
        : res.reason === "denied"
          ? "Enable notifications for calSync in your device settings."
          : res.reason === "token"
            ? "Couldn't get a push token — this needs a dev build, not Expo Go."
            : (res.message ?? "Couldn't verify the device. Please try again.");
    Alert.alert("Couldn't enable push", msg);
  }

  useEffect(() => {
    let active = true;
    api
      .get<{ channels: NotificationChannel[]; available: ChannelType[] }>("/api/settings/channels")
      .then((d) => {
        if (!active) return;
        setChannels(d.channels);
        setAvailable(d.available);
        // Prefer a manually-addable channel type as the default selection.
        const addable = d.available.filter((t) => t !== "push");
        if (addable[0]) setType(addable[0]);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  async function add() {
    setError(null);
    setAdding(true);
    const body =
      type === "slack" ? { type, webhookUrl: webhookUrl.trim() } : { type, phone: phone.trim() };
    try {
      const { channel } = await api.post<{ channel: NotificationChannel }>(
        "/api/settings/channels",
        body,
      );
      setChannels((prev) => [...prev, channel]);
      setWebhookUrl("");
      setPhone("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't add that channel. Check the details.");
    } finally {
      setAdding(false);
    }
  }

  async function toggle(ch: NotificationChannel) {
    const next = !ch.remindersEnabled;
    setChannels((prev) => prev.map((c) => (c.id === ch.id ? { ...c, remindersEnabled: next } : c)));
    try {
      await api.patch(`/api/settings/channels/${ch.id}`, { remindersEnabled: next });
    } catch {
      setChannels((prev) =>
        prev.map((c) => (c.id === ch.id ? { ...c, remindersEnabled: !next } : c)),
      );
    }
  }

  function confirmRemove(ch: NotificationChannel) {
    Alert.alert("Remove channel?", "You'll stop receiving reminders here.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api.del(`/api/settings/channels/${ch.id}`);
            setChannels((prev) => prev.filter((c) => c.id !== ch.id));
          } catch {
            Alert.alert("Could not remove", "Please try again.");
          }
        },
      },
    ]);
  }

  // Only channel types this server can deliver to, minus push (registered by the
  // app automatically, not typed in by hand).
  const addable = available.filter((t) => t !== "push");

  if (loading) return <Loading />;

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Notifications" }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Get meeting reminders where you are — push, Slack, WhatsApp, or SMS. Email reminders are
          always on.
        </Text>

        {hasPush ? null : (
          <Pressable style={styles.pushBtn} onPress={enablePush} disabled={registering}>
            <Ionicons name="phone-portrait-outline" size={18} color={colors.white} />
            <Text style={styles.pushBtnText}>
              {registering ? "Enabling…" : "Enable push on this device"}
            </Text>
          </Pressable>
        )}

        {channels.length === 0 ? (
          <EmptyState
            title="No extra channels"
            body="Add one below; we'll send a test to verify."
          />
        ) : (
          channels.map((ch) => (
            <View key={ch.id} style={styles.channel}>
              <Ionicons
                name={ICONS[ch.type] ?? "notifications-outline"}
                size={20}
                color={colors.accent}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.channelName}>{LABELS[ch.type as ChannelType] ?? ch.type}</Text>
                <Text style={styles.channelLabel}>{ch.label}</Text>
              </View>
              <Switch
                value={ch.remindersEnabled}
                onValueChange={() => toggle(ch)}
                trackColor={{ true: colors.accent }}
              />
              <Pressable onPress={() => confirmRemove(ch)} style={styles.remove}>
                <Ionicons name="trash-outline" size={18} color={colors.faint} />
              </Pressable>
            </View>
          ))
        )}

        {addable.length === 0 ? (
          <Text style={styles.hint}>
            No addable channel types are enabled on this server (WhatsApp/SMS need Twilio).
          </Text>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Add a channel</Text>
            <View style={styles.pills}>
              {addable.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => {
                    setType(t);
                    setError(null);
                  }}
                  style={[styles.pill, t === type && styles.pillOn]}
                >
                  <Text style={[styles.pillText, t === type && styles.pillTextOn]}>
                    {LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {type === "slack" ? (
              <TextInput
                style={styles.input}
                value={webhookUrl}
                onChangeText={setWebhookUrl}
                placeholder="https://hooks.slack.com/services/…"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                keyboardType="url"
              />
            ) : (
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+14155551234"
                placeholderTextColor={colors.faint}
                keyboardType="phone-pad"
              />
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable style={styles.add} onPress={add} disabled={adding}>
              <Text style={styles.addText}>{adding ? "Sending test…" : "Add & verify"}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  intro: { color: colors.muted, fontSize: 14, marginBottom: 18, lineHeight: 20 },
  pushBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 13,
    marginBottom: 18,
  },
  pushBtnText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  channel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  channelName: { color: colors.text, fontWeight: "500", fontSize: 15 },
  channelLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  remove: { padding: 6 },
  form: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 18 },
  label: { fontWeight: "500", fontSize: 14, marginBottom: 10, color: colors.text },
  hint: { color: colors.faint, fontSize: 13, marginTop: 12 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  pill: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  pillOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pillText: { color: colors.muted },
  pillTextOn: { color: colors.text, fontWeight: "600" },
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
  error: { color: colors.danger, marginTop: 10 },
  add: {
    marginTop: 14,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  addText: { color: colors.white, fontWeight: "600", fontSize: 15 },
});
