import { AuthProvider, useAuth } from "@/auth";
import { ErrorBoundary } from "@/components/error-boundary";
import { OtterLauncher } from "@/components/otter-launcher";
import { colors } from "@/theme";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Show reminder pushes while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          {/* Pushed screens set headerShown; give them the brand chrome, not the OS default. */}
          <Stack
            screenOptions={{
              headerShown: false,
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerTitleStyle: { fontWeight: "700", color: colors.text },
              headerShadowVisible: false,
            }}
          />
          {/* Floating "Ask DayOtter" - one tap from any signed-in screen. */}
          <OtterGate />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

/** Only render the launcher once the user is signed in (never on sign-in/onboarding). */
function OtterGate() {
  const { user } = useAuth();
  return user ? <OtterLauncher /> : null;
}
