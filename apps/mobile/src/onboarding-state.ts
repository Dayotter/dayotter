import * as SecureStore from "expo-secure-store";

const KEY = "dayotter_onboarded";

/** Whether the first-launch onboarding has been completed on this device. */
export async function hasOnboarded(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === "1";
  } catch {
    return false;
  }
}

export async function completeOnboarding(): Promise<void> {
  await SecureStore.setItemAsync(KEY, "1");
}
