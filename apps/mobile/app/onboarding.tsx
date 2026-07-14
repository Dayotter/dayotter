import { completeOnboarding } from "@/onboarding-state";
import { colors, radius } from "@/theme";
import { Stack, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import agenda from "../assets/onboarding/agenda.png";
import plan from "../assets/onboarding/plan.png";
import relax from "../assets/onboarding/relax.png";
import remind from "../assets/onboarding/remind.png";

const SLIDES = [
  {
    img: plan,
    title: "Welcome to DayOtter",
    body: "The calm home for your time - scheduling that respects every calendar you own.",
  },
  {
    img: agenda,
    title: "Share one link",
    body: "People pick a time you're actually free. No back-and-forth, no double-booking.",
  },
  {
    img: relax,
    title: "Protect your calm",
    body: "Buffers, focus blocks, and gentle reminders keep your day yours - not your calendar's.",
  },
  {
    img: remind,
    title: "Never miss a beat",
    body: "Automatic reminders and your whole team's free time, together in one place.",
  },
];

export default function Onboarding() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const isLast = index === SLIDES.length - 1;

  async function finish() {
    await completeOnboarding();
    router.replace("/sign-in");
  }

  function next() {
    if (isLast) {
      finish();
      return;
    }
    scroller.current?.scrollTo({ x: (index + 1) * width, animated: true });
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.top}>
        <Pressable onPress={finish} hitSlop={10}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
      >
        {SLIDES.map((s) => (
          <View key={s.title} style={[styles.slide, { width }]}>
            <Image source={s.img} style={styles.img} resizeMode="contain" />
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, idx) => (
            <View key={s.title} style={[styles.dot, idx === index && styles.dotActive]} />
          ))}
        </View>
        <Pressable style={styles.btn} onPress={next}>
          <Text style={styles.btnText}>{isLast ? "Get started" : "Next"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { alignItems: "flex-end", paddingHorizontal: 20, paddingTop: 6 },
  skip: { color: colors.muted, fontSize: 15, fontWeight: "500" },
  slide: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  img: { width: 260, height: 260, marginBottom: 36 },
  title: { fontSize: 26, fontWeight: "700", color: colors.text, textAlign: "center" },
  body: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 320,
  },
  footer: { paddingHorizontal: 24, paddingBottom: 12 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 20 },
  dot: { height: 7, width: 7, borderRadius: 4, backgroundColor: colors.borderStrong },
  dotActive: { backgroundColor: colors.accent, width: 20 },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnText: { color: colors.white, fontWeight: "600", fontSize: 16 },
});
