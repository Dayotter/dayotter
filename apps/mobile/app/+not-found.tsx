import { colors, radius } from "@/theme";
import { Link, Stack } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";
import relax from "../assets/onboarding/relax.png";

export default function NotFound() {
  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: true, title: "Not found" }} />
      <Image source={relax} style={styles.img} resizeMode="contain" />
      <Text style={styles.title}>This page drifted off.</Text>
      <Text style={styles.body}>The otter looked everywhere and couldn't find it.</Text>
      <Link href="/" style={styles.link}>
        Back home
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  img: { width: 180, height: 180, marginBottom: 24 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, textAlign: "center" },
  body: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 280,
  },
  link: {
    marginTop: 24,
    color: colors.white,
    fontWeight: "600",
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 22,
    overflow: "hidden",
  },
});
