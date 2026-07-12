/** Design tokens mirroring the DayOtter web app (warm ivory, premium violet). */
export const colors = {
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

export const radius = { sm: 8, md: 12, lg: 16 } as const;

export const statusColor: Record<string, string> = {
  confirmed: colors.success,
  cancelled: colors.danger,
  pending: colors.amber,
  rejected: colors.danger,
};
