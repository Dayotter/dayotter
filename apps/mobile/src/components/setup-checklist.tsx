import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface Setup {
  hasCalendar: boolean;
  hasHours: boolean;
  hasEventType: boolean;
}

/**
 * "Get bookable in 3 steps" for the mobile home - mirrors the web dashboard.
 * Hidden once every step is done. Tapping an unfinished step jumps to it.
 */
export function SetupChecklist({ setup }: { setup?: Setup }) {
  const router = useRouter();
  if (!setup) return null;

  const steps: { done: boolean; title: string; route: Href }[] = [
    { done: setup.hasCalendar, title: "Connect your calendar", route: "/calendars" },
    { done: setup.hasHours, title: "Set your hours", route: "/availability" },
    { done: setup.hasEventType, title: "Create a booking type", route: "/events" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Get set up to take bookings</Text>
        <Text style={styles.count}>
          {doneCount} of {steps.length}
        </Text>
      </View>
      {steps.map((s, i) => (
        <Pressable
          key={s.title}
          style={styles.row}
          onPress={() => !s.done && router.push(s.route)}
          disabled={s.done}
        >
          <View style={[styles.num, s.done && styles.numDone]}>
            {s.done ? (
              <Ionicons name="checkmark" size={14} color={colors.white} />
            ) : (
              <Text style={styles.numText}>{i + 1}</Text>
            )}
          </View>
          <Text style={[styles.step, s.done && styles.stepDone]}>{s.title}</Text>
          {!s.done ? <Ionicons name="chevron-forward" size={16} color={colors.accent} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 14,
    gap: 8,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 15, fontWeight: "700", color: colors.text },
  count: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  num: {
    height: 24,
    width: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  numDone: { backgroundColor: colors.success, borderColor: colors.success },
  numText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  step: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },
  stepDone: { color: colors.muted, textDecorationLine: "line-through" },
});
