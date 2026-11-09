import { describe, expect, it } from "vitest";
import {
  insertField,
  joinOptions,
  renderBookingTitle,
  splitOptions,
  titleSegments,
  titleVariables,
  unknownTitlePlaceholders,
} from "./booking-title";

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

describe("event fields", () => {
  const event = { ...ctx(null), host: "Ana", typeTitle: "Intro call", durationMinutes: 30 };

  it("fills host, booking type and duration", () => {
    expect(renderBookingTitle("{host} <> {name} | {booking type} ({duration})", "R", event)).toBe(
      "Ana <> Maria | Intro call (30 min)",
    );
  });

  it("treats event fields as known placeholders", () => {
    expect(unknownTitlePlaceholders("{host} {Booking Type} {duration}", [])).toEqual([]);
  });

  it("skips an account default option that cites a question the type lacks", () => {
    expect(renderBookingTitle("{host} <> {Company} || {host} <> {name}", "R", event)).toBe(
      "Ana <> Maria",
    );
  });
});

describe("options as a list", () => {
  it("splits on || and drops empty options", () => {
    expect(splitOptions(" a || || b ")).toEqual(["a", "b"]);
    expect(splitOptions(null)).toEqual([]);
  });

  it("joins options back into the stored string", () => {
    expect(joinOptions(["a", " ", "b "])).toBe("a || b");
    expect(joinOptions(splitOptions(joinOptions(["x {name}", "y"])))).toBe("x {name} || y");
  });

  it("splits an option into text and field segments", () => {
    expect(titleSegments("Ana <> {name} | {Company}")).toEqual([
      { text: "Ana <> " },
      { field: "name" },
      { text: " | " },
      { field: "Company" },
    ]);
  });
});

describe("editor helpers", () => {
  it("inserts a field at the caret and returns the caret after it", () => {
    expect(insertField("Ana <> ", 7, "name")).toEqual({ text: "Ana <> {name}", caret: 13 });
    expect(insertField("A  B", 2, "host")).toEqual({ text: "A {host} B", caret: 8 });
  });

  it("clamps a caret outside the text to its end", () => {
    expect(insertField("x", 99, "email")).toEqual({ text: "x{email}", caret: 8 });
  });

  it("groups the variables a booking can fill", () => {
    const groups = titleVariables([
      { id: "q1", label: "Company", required: false },
      { id: "q2", label: "Role", required: true },
      { id: "q3", label: "  ", required: false },
    ]);
    expect(groups.map((g) => g.title)).toEqual(["Booker", "This type's questions", "Event"]);
    expect(groups[0]?.fields).toEqual([
      { key: "name", hint: "Always filled" },
      { key: "email", hint: "Always filled" },
    ]);
    expect(groups[1]?.fields).toEqual([
      { key: "Company", hint: "Optional · may be empty" },
      { key: "Role", hint: "Required" },
    ]);
    expect(groups[2]?.fields.map((f) => f.key)).toEqual(["booking type", "host", "duration"]);
  });

  it("leaves out the questions group when there are none", () => {
    expect(titleVariables([]).map((g) => g.title)).toEqual(["Booker", "Event"]);
  });
});
