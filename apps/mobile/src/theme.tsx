/** Design tokens mirroring the DayOtter web app (warm ivory / deep plum, premium violet). */
import * as SecureStore from "expo-secure-store";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";

export const lightColors = {
  bg: "#FAF9F6",
  surface: "#FFFFFF",
  surface2: "#F4F2EC",
  border: "#EBE8E0",
  borderStrong: "#DCD8CD",
  text: "#191720",
  muted: "#6A6660",
  faint: "#9C988E",
  accent: "#6743E6",
  accentSoft: "#EFEAFD",
  mint: "#16A085",
  amber: "#D98829",
  coral: "#EF6A52",
  danger: "#E11D48",
  success: "#16A085",
  white: "#FFFFFF",
} as const;

export type ThemeColors = { [K in keyof typeof lightColors]: string };

/**
 * Dark palette, mirroring the web app's `prefers-color-scheme: dark` tokens
 * (deep plum ground, lifted violet accent) so both clients read as one product.
 * The status hues are brightened a touch so they stay legible on the dark ground.
 */
export const darkColors: ThemeColors = {
  bg: "#0B0A10",
  surface: "#141219",
  surface2: "#1C1A23",
  border: "#262330",
  borderStrong: "#332F3E",
  text: "#EDEAE3",
  muted: "#9D988F",
  faint: "#6C6775",
  accent: "#9079F8",
  accentSoft: "rgba(144, 121, 248, 0.18)",
  mint: "#1FB894",
  amber: "#E59A3D",
  coral: "#F2795F",
  danger: "#F43F5E",
  success: "#1FB894",
  white: "#FFFFFF",
};

/**
 * Back-compat default (light). Prefer `useColors()` inside components so styles
 * follow the active theme - a module-scope `StyleSheet.create` built from this
 * captures light values once at import and won't react to a theme change.
 */
export const colors: ThemeColors = lightColors;

export const radius = { sm: 8, md: 12, lg: 16 } as const;

export const statusColor: Record<string, string> = {
  confirmed: colors.success,
  cancelled: colors.danger,
  pending: colors.amber,
  rejected: colors.danger,
  no_show: colors.amber,
  completed: colors.muted,
};

/** Human label for a booking status (e.g. no_show -> "no-show"). */
export function statusLabel(status: string): string {
  return status === "no_show" ? "no-show" : status;
}

// ---------------------------------------------------------------------------
// Theme context: system | light | dark, resolved to a live palette.
// ---------------------------------------------------------------------------

export type ThemePreference = "system" | "light" | "dark";

/** Non-secret, but SecureStore is the storage this app already ships. */
const THEME_KEY = "dayotter_theme";

type ThemeContextValue = {
  colors: ThemeColors;
  /** The resolved scheme actually in effect. */
  scheme: "light" | "dark";
  /** The user's stored choice ("system" follows the OS). */
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  scheme: "light",
  preference: "system",
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  // Load the stored preference once. Until it resolves we follow the OS, so a
  // dark-mode device opens dark rather than flashing light.
  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(THEME_KEY)
      .then((v) => {
        if (active && (v === "light" || v === "dark" || v === "system")) {
          setPreferenceState(v);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    SecureStore.setItemAsync(THEME_KEY, p).catch(() => {});
  }, []);

  const scheme: "light" | "dark" =
    preference === "system" ? (system === "dark" ? "dark" : "light") : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: scheme === "dark" ? darkColors : lightColors,
      scheme,
      preference,
      setPreference,
    }),
    [scheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** The active palette. Use this in components so styles track the theme. */
export function useColors(): ThemeColors {
  return useContext(ThemeContext).colors;
}
