import { TWO_FACTOR_REQUIRED, useAuth } from "@/auth";
import { googleAuthEnabled, phoneAuthEnabled } from "@/auth-client";
import { BrandMark } from "@/components/brand-mark";
import { hasOnboarded } from "@/onboarding-state";
import { serverHost } from "@/server";
import { colors, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
  const {
    signIn,
    signUp,
    signInWithGoogle,
    twoFactorPending,
    verifyTwoFactor,
    cancelTwoFactor,
    sendPhoneOtp,
    verifyPhoneOtp,
  } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [ready, setReady] = useState(false);
  // 2FA step
  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [verifying, setVerifying] = useState(false);
  // Phone / SMS OTP flow (only rendered when the operator enables it).
  const [phoneMode, setPhoneMode] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);

  // First launch → show onboarding before the sign-in form.
  useEffect(() => {
    hasOnboarded().then((done) => {
      if (done) setReady(true);
      else router.replace("/onboarding");
    });
  }, [router]);

  async function submit() {
    setLoading(true);
    setError(null);
    const err = isSignUp
      ? await signUp(name.trim(), email.trim(), password)
      : await signIn(email.trim(), password);
    setLoading(false);
    // 2FA account: stay put; the authenticator-code step renders below.
    if (err === TWO_FACTOR_REQUIRED) return;
    if (err) setError(err);
    else router.replace("/");
  }

  async function verify2fa() {
    setVerifying(true);
    setError(null);
    const err = await verifyTwoFactor(code, useBackup);
    setVerifying(false);
    if (err) setError(err);
    else router.replace("/");
  }

  function backFrom2fa() {
    cancelTwoFactor();
    setCode("");
    setUseBackup(false);
    setError(null);
  }

  async function google() {
    setGoogleLoading(true);
    setError(null);
    const err = await signInWithGoogle();
    setGoogleLoading(false);
    if (err) setError(err);
    else router.replace("/");
  }

  function startPhone() {
    setPhoneMode(true);
    setError(null);
  }

  function backFromPhone() {
    setPhoneMode(false);
    setPhone("");
    setOtp("");
    setOtpSent(false);
    setError(null);
  }

  async function sendOtp() {
    setPhoneBusy(true);
    setError(null);
    const err = await sendPhoneOtp(phone.trim());
    setPhoneBusy(false);
    if (err) setError(err);
    else setOtpSent(true);
  }

  async function verifyOtp() {
    setPhoneBusy(true);
    setError(null);
    const err = await verifyPhoneOtp(phone.trim(), otp.trim());
    setPhoneBusy(false);
    if (err) setError(err);
    else router.replace("/");
  }

  if (!ready) return <View style={styles.safe} />;

  // Phone / SMS OTP: enter number → receive a code → verify. Flag-gated.
  if (phoneMode) {
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
            <Text style={styles.heading}>Sign in with phone</Text>
            <Text style={styles.sub}>
              {otpSent ? "Enter the code we just texted you." : "We'll text you a one-time code."}
            </Text>
            <View style={styles.form}>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Field
                label="Phone number"
                value={phone}
                onChange={setPhone}
                placeholder="+14155551234"
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
              />
              {otpSent ? (
                <Field
                  label="Code"
                  value={otp}
                  onChange={setOtp}
                  placeholder="123456"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                />
              ) : null}
              <Pressable
                style={styles.button}
                onPress={otpSent ? verifyOtp : sendOtp}
                disabled={
                  phoneBusy || (otpSent ? otp.trim().length === 0 : phone.trim().length === 0)
                }
              >
                <Text style={styles.buttonText}>
                  {phoneBusy ? "Please wait…" : otpSent ? "Verify & sign in" : "Send code"}
                </Text>
              </Pressable>
              {otpSent ? (
                <Pressable
                  onPress={() => {
                    setOtpSent(false);
                    setOtp("");
                    setError(null);
                  }}
                >
                  <Text style={styles.toggle}>Use a different number</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={backFromPhone}>
                <Text style={styles.serverLink}>Back to sign in</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // 2FA account mid-sign-in: collect the authenticator (or backup) code.
  if (twoFactorPending) {
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
            <Text style={styles.heading}>Two-factor authentication</Text>
            <Text style={styles.sub}>
              {useBackup
                ? "Enter one of your backup recovery codes."
                : "Enter the 6-digit code from your authenticator app."}
            </Text>
            <View style={styles.form}>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder={useBackup ? "Backup code" : "123456"}
                placeholderTextColor={colors.faint}
                keyboardType={useBackup ? "default" : "number-pad"}
                autoCapitalize="none"
                autoFocus
                autoComplete={useBackup ? "off" : "one-time-code"}
                onSubmitEditing={verify2fa}
                returnKeyType="go"
              />
              <Pressable
                style={[styles.button, { marginTop: 16 }]}
                onPress={verify2fa}
                disabled={verifying || code.trim().length === 0}
              >
                <Text style={styles.buttonText}>{verifying ? "Verifying…" : "Verify"}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setUseBackup((v) => !v);
                  setCode("");
                  setError(null);
                }}
              >
                <Text style={styles.toggle}>
                  {useBackup ? "Use an authenticator code" : "Use a backup code instead"}
                </Text>
              </Pressable>
              <Pressable onPress={backFrom2fa}>
                <Text style={styles.serverLink}>Back to sign in</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const showGoogle = googleAuthEnabled && Platform.OS !== "ios";
  // Phone/email aren't third-party social logins, so no Apple 4.8 concern - phone can show on iOS.
  const showSocial = showGoogle || phoneAuthEnabled;

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
            {/* Lead with Google - the one-tap path most people want. Hidden on
                iOS (offering it there would require Sign in with Apple, App Store
                guideline 4.8); email/password stays available everywhere. */}
            {showGoogle ? (
              <Pressable style={styles.googleBtn} onPress={google} disabled={googleLoading}>
                <Ionicons name="logo-google" size={18} color={colors.text} />
                <Text style={styles.googleText}>
                  {googleLoading ? "Opening…" : "Continue with Google"}
                </Text>
              </Pressable>
            ) : null}

            {phoneAuthEnabled ? (
              <Pressable
                style={[styles.googleBtn, showGoogle ? { marginTop: 12 } : null]}
                onPress={startPhone}
              >
                <Ionicons name="call-outline" size={18} color={colors.text} />
                <Text style={styles.googleText}>Continue with phone</Text>
              </Pressable>
            ) : null}

            {showSocial ? (
              <View style={styles.divider}>
                <View style={styles.line} />
                <Text style={styles.dividerText}>or continue with email</Text>
                <View style={styles.line} />
              </View>
            ) : null}

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
            <Pressable onPress={() => router.push("/server")} hitSlop={8}>
              <Text style={styles.serverLink}>Connected to {serverHost()} · Change server</Text>
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
  keyboardType?: "email-address" | "default" | "phone-pad" | "number-pad";
  // OTP auto-fill hints: iOS reads the code from Messages, Android from the SMS.
  textContentType?: "telephoneNumber" | "oneTimeCode";
  autoComplete?: "tel" | "sms-otp";
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
        textContentType={props.textContentType}
        autoComplete={props.autoComplete}
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
  serverLink: { color: colors.faint, textAlign: "center", marginTop: 22, fontSize: 13 },
});
