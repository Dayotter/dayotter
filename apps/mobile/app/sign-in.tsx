import { useAuth } from "@/auth";
import { googleAuthEnabled } from "@/auth-client";
import { BrandMark } from "@/components/brand-mark";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    const err = isSignUp
      ? await signUp(name.trim(), email.trim(), password)
      : await signIn(email.trim(), password);
    setLoading(false);
    if (err) setError(err);
    else router.replace("/");
  }

  async function google() {
    setGoogleLoading(true);
    setError(null);
    const err = await signInWithGoogle();
    setGoogleLoading(false);
    if (err) setError(err);
    else router.replace("/");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoRow}>
            <BrandMark size={48} />
          </View>
          <Text style={styles.heading}>{isSignUp ? "Create your account" : "Welcome back"}</Text>
          <Text style={styles.sub}>
            {isSignUp ? "Start scheduling in minutes." : "Sign in to your DayOtter account."}
          </Text>

          <View style={styles.form}>
            {isSignUp ? (
              <Field label="Name" value={name} onChange={setName} placeholder="Ada Lovelace" />
            ) : null}
            <Field
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="you@company.com"
              keyboardType="email-address"
            />
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              secure
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.button} onPress={submit} disabled={loading}>
              <Text style={styles.buttonText}>
                {loading ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
              </Text>
            </Pressable>

            {/* Google hidden on iOS: offering it would require Sign in with Apple
                (App Store guideline 4.8). Email/password stays available. */}
            {googleAuthEnabled && Platform.OS !== "ios" ? (
              <>
                <View style={styles.divider}>
                  <View style={styles.line} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.line} />
                </View>
                <Pressable style={styles.googleBtn} onPress={google} disabled={googleLoading}>
                  <Ionicons name="logo-google" size={17} color={colors.text} />
                  <Text style={styles.googleText}>
                    {googleLoading ? "Opening…" : "Continue with Google"}
                  </Text>
                </Pressable>
              </>
            ) : null}
            <Pressable
              onPress={() => {
                setIsSignUp((v) => !v);
                setError(null);
              }}
            >
              <Text style={styles.toggle}>
                {isSignUp ? "Already have an account? Sign in" : "No account? Create one"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: "email-address" | "default";
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChange}
        placeholder={props.placeholder}
        placeholderTextColor={colors.faint}
        secureTextEntry={props.secure}
        autoCapitalize="none"
        keyboardType={props.keyboardType ?? "default"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logoRow: { marginBottom: 20, alignSelf: "flex-start" },
  heading: { fontSize: 28, fontWeight: "700", color: colors.text },
  sub: { color: colors.muted, marginTop: 6 },
  form: { marginTop: 28 },
  label: { fontWeight: "500", fontSize: 14, marginBottom: 6, color: colors.text },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  error: { color: colors.danger, marginBottom: 12 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  buttonText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 18 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.faint, fontSize: 12 },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  googleText: { color: colors.text, fontWeight: "600", fontSize: 15 },
  toggle: { color: colors.accent, textAlign: "center", marginTop: 18 },
});
