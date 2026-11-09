import { describe, expect, it } from "vitest";
import {
  insertField,
  joinOptions,
  previewTitle,
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

  it("clamps a negative caret to the start", () => {
    expect(insertField("ab", -3, "name")).toEqual({ text: "{name}ab", caret: 6 });
  });

  it("keeps a lone brace as text, not a field", () => {
    expect(titleSegments("{oops")).toEqual([{ text: "{oops" }]);
    expect(titleSegments("oops}")).toEqual([{ text: "oops}" }]);
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

  const sample = { host: "Ana", typeTitle: "Intro call", durationMinutes: 30 };
  const qs = [
    { id: "q1", label: "Company" },
    { id: "q2", label: " " },
  ];

  it("previews a title with every question answered by its own label", () => {
    expect(previewTitle("{host} <> {name} | {Company}", "Intro", qs, sample, true)).toEqual({
      title: "Ana <> Maria | Company",
    });
  });

  it("previews the next option when no question is answered", () => {
    const t = "{name} | {Company} || {name} · {duration}";
    expect(previewTitle(t, "Intro", qs, sample, false)).toEqual({ title: "Maria · 30 min" });
  });

  it("previews the fallback, or Untitled when it is blank", () => {
    expect(previewTitle("{Company}", "Intro", qs, sample, false)).toEqual({ title: "Intro" });
    expect(previewTitle("", "", qs, sample, true)).toEqual({ title: "Untitled" });
  });

  it("names the fields no question of the type can fill, ignoring blank labels", () => {
    expect(previewTitle("{name} {Role} {Company}", "Intro", qs, sample, true)).toEqual({
      unknown: ["Role"],
    });
  });

  it("treats any field as a question for the account default", () => {
    expect(previewTitle("{name} | {Role}", "Intro", undefined, sample, true)).toEqual({
      title: "Maria | Role",
    });
    expect(previewTitle("{name} | {Role}", "Intro", undefined, sample, false)).toEqual({
      title: "Intro",
    });
  });
});
