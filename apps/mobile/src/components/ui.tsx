import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, radius } from "../theme";

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + "22" }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </View>
  );
}

export function ErrorText({ message }: { message: string }) {
  return (
    <View style={styles.center}>
      <Text style={{ color: colors.danger }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
  },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  center: { paddingVertical: 40, alignItems: "center", justifyContent: "center" },
  empty: {
    marginVertical: 12,
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  emptyTitle: { fontWeight: "600", color: colors.text },
  emptyBody: { marginTop: 6, color: colors.muted, fontSize: 13, textAlign: "center" },
});
