import { describe, expect, it } from "vitest";
import { renderBookingTitle, unknownTitlePlaceholders } from "./booking-title";

const questions = [
  { id: "q1", label: "Empresa" },
  { id: "q2", label: "Área de atuação" },
];
const TEMPLATE = "José Vitor <> {nome} | {empresa} || José Vitor <> {nome}";
const ctx = (responses: Record<string, unknown> | null) => ({
  name: "Maria",
  email: "maria@xpto.com",
  questions,
  responses,
});

describe("renderBookingTitle", () => {
  it("uses the first option when every field is filled", () => {
    expect(renderBookingTitle(TEMPLATE, "Reunião", ctx({ q1: "XPTO" }))).toBe(
      "José Vitor <> Maria | XPTO",
    );
  });

  it("falls to the next option when a field is blank", () => {
    expect(renderBookingTitle(TEMPLATE, "Reunião", ctx({ q1: "   " }))).toBe("José Vitor <> Maria");
    expect(renderBookingTitle(TEMPLATE, "Reunião", ctx(null))).toBe("José Vitor <> Maria");
  });

  it("keeps literal brackets and matches labels ignoring case and accents", () => {
    expect(
      renderBookingTitle(
        "{Nome} [{EMPRESA}] - {area de atuacao}",
        "R",
        ctx({ q1: "XPTO", q2: "Tech" }),
      ),
    ).toBe("Maria [XPTO] - Tech");
  });

  it("accepts the question id, the English name key and the email", () => {
    expect(renderBookingTitle("{name} {q1} {email}", "R", ctx({ q1: "XPTO" }))).toBe(
      "Maria XPTO maria@xpto.com",
    );
  });

  it("returns the event type title when there is no template or no option fits", () => {
    expect(renderBookingTitle(null, "Reunião", ctx(null))).toBe("Reunião");
    expect(renderBookingTitle("  ", "Reunião", ctx(null))).toBe("Reunião");
    expect(renderBookingTitle("{nome} | {empresa}", "Reunião", ctx({}))).toBe("Reunião");
    expect(renderBookingTitle("{cargo}", "Reunião", ctx({}))).toBe("Reunião");
  });

  it("joins multiple answers and ignores checkbox booleans", () => {
    expect(renderBookingTitle("{nome} {empresa}", "R", ctx({ q1: ["A", "B"] }))).toBe("Maria A, B");
    expect(renderBookingTitle("{nome} {empresa} || x", "R", ctx({ q1: true }))).toBe("x");
  });
});

describe("unknownTitlePlaceholders", () => {
  it("lists only the fields that no question or built-in provides", () => {
    expect(
      unknownTitlePlaceholders("{nome} {Empresa} {q2} {cargo} || {email} {telefone}", questions),
    ).toEqual(["cargo", "telefone"]);
    expect(unknownTitlePlaceholders(null, questions)).toEqual([]);
  });
});
