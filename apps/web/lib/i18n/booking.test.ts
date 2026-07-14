import { describe, expect, it } from "vitest";
import { resolveLocale, t } from "./booking";

describe("resolveLocale", () => {
  it("defaults to en for empty/unknown", () => {
    expect(resolveLocale(null)).toBe("en");
    expect(resolveLocale("")).toBe("en");
    expect(resolveLocale("ja-JP,ja")).toBe("en");
  });

  it("maps a regional tag to its base locale", () => {
    expect(resolveLocale("es-419,es;q=0.9")).toBe("es");
    expect(resolveLocale("fr-CA")).toBe("fr");
    expect(resolveLocale("de")).toBe("de");
    expect(resolveLocale("pt-BR")).toBe("pt");
  });

  it("picks the first supported language in the list", () => {
    expect(resolveLocale("ja,es;q=0.8,en;q=0.5")).toBe("es");
  });
});

describe("t", () => {
  it("translates a key per locale", () => {
    expect(t("en", "selectTime")).toBe("Select a time");
    expect(t("es", "selectTime")).toBe("Elige una hora");
    expect(t("de", "recommended")).toBe("Empfohlene Zeiten");
  });

  it("interpolates variables", () => {
    expect(t("en", "timesIn", { zone: "Asia/Calcutta" })).toBe("Times shown in Asia/Calcutta");
    expect(t("es", "overlaySummaryMany", { n: 3 })).toContain("3 compromisos");
  });

  it("falls back to English for an unmapped locale", () => {
    // @ts-expect-error - exercising the runtime fallback path
    expect(t("zz", "selectTime")).toBe("Select a time");
  });
});
