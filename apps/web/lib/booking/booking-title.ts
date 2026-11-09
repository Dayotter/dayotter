/**
 * Per-booking calendar titles from an event type's `titleTemplate`.
 *
 * A template is one or more options separated by `||`; each option is text with
 * `{field}` placeholders. The first option whose placeholders all have a value
 * wins, so `Ana <> {name} | {company} || Ana <> {name}` drops the company part
 * when the booker left it blank. No option fits (or no template) = the event
 * type's own title. Fields: `name`/`nome`, `email`, and any intake question by
 * its label (case/accent-insensitive) or id.
 */

type Question = { id: string; label: string };

export type BookingTitleContext = {
  name: string;
  email: string;
  questions: Question[];
  responses: Record<string, unknown> | null | undefined;
};

const OPTION_SEPARATOR = "||";
const PLACEHOLDER = /\{([^{}]+)\}/g;
const BUILT_INS = ["name", "nome", "email"];

const normalize = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

const options = (template: string | null | undefined) =>
  (template || "")
    .split(OPTION_SEPARATOR)
    .map((o) => o.trim())
    .filter(Boolean);

const placeholders = (option: string) =>
  [...option.matchAll(PLACEHOLDER)].flatMap((m) => m.slice(1));

function findQuestion(key: string, questions: Question[]) {
  return questions.find((q) => q.id === key || normalize(q.label) === normalize(key));
}

function answerText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(answerText).filter(Boolean).join(", ");
  return ""; // checkbox booleans and empties don't read as a title
}

function fieldValue(key: string, ctx: BookingTitleContext): string {
  const k = normalize(key);
  if (k === "name" || k === "nome") return ctx.name.trim();
  if (k === "email") return ctx.email.trim();
  const q = findQuestion(key, ctx.questions);
  return q ? answerText(ctx.responses?.[q.id]) : "";
}

export function renderBookingTitle(
  template: string | null | undefined,
  fallback: string,
  ctx: BookingTitleContext,
): string {
  for (const option of options(template)) {
    let complete = true;
    const title = option.replace(PLACEHOLDER, (_, key: string) => {
      const value = fieldValue(key, ctx);
      if (!value) complete = false;
      return value;
    });
    if (complete) return title;
  }
  return fallback;
}

/** Placeholders no built-in field or intake question can fill (for form validation). */
export function unknownTitlePlaceholders(
  template: string | null | undefined,
  questions: Question[],
): string[] {
  return options(template)
    .flatMap(placeholders)
    .filter((key) => !BUILT_INS.includes(normalize(key)) && !findQuestion(key, questions));
}
