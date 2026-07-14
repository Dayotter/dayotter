import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

export type PushResult =
  | { ok: true }
  | { ok: false; reason: "simulator" | "denied" | "token" | "server"; message?: string };

/**
 * Registers this device to receive push reminders: asks OS permission, fetches
 * the Expo push token, and stores it as a `push` notification channel via the
 * existing /api/settings/channels endpoint (which sends a real test push to
 * verify it before persisting). Real push needs a physical device + a dev build
 * - the simulator/Expo-Go paths degrade gracefully.
 */
export async function registerPushChannel(): Promise<PushResult> {
  if (!Device.isDevice) return { ok: false, reason: "simulator" };

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") return { ok: false, reason: "denied" };

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  let token: string;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const res = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    token = res.data;
  } catch (e) {
    return { ok: false, reason: "token", message: e instanceof Error ? e.message : undefined };
  }

  try {
    await api.post("/api/settings/channels", {
      type: "push",
      pushToken: token,
      platform: Platform.OS === "ios" ? "ios" : "android",
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: "server",
      message: e instanceof Error ? e.message : undefined,
    };
  }
}
