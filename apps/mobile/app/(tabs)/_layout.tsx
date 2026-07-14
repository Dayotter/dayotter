import { useAuth } from "@/auth";
import { Loading } from "@/components/ui";
import { colors } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { Platform } from "react-native";

/** One tab. Icon shown filled when active, outline when not - a common iOS/Android idiom. */
function tabIcon(base: keyof typeof Ionicons.glyphMap, active: keyof typeof Ionicons.glyphMap) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? active : base} color={color} size={24} />
  );
}

export default function TabsLayout() {
  const { user, initializing } = useAuth();

  if (initializing) return <Loading />;
  if (!user) return <Redirect href="/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: -2 },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: Platform.OS === "ios" ? 86 : 64,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: tabIcon("home-outline", "home") }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: "Bookings", tabBarIcon: tabIcon("calendar-outline", "calendar") }}
      />
      <Tabs.Screen
        name="events"
        options={{ title: "Events", tabBarIcon: tabIcon("albums-outline", "albums") }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: tabIcon("settings-outline", "settings") }}
      />
    </Tabs>
  );
}
