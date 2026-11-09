/**
 * Per-booking calendar titles from an event type's `titleTemplate` (or the
 * host's account default).
 *
 * A template is one or more options separated by `||`; each option is text with
 * `{field}` placeholders. The first option whose placeholders all have a value
 * wins, so `Ana <> {name} | {company} || Ana <> {name}` drops the company part
 * when the booker left it blank. No option fits (or no template) = the event
 * type's own title. Fields: `name`/`nome`, `email`, `host`, `booking type`,
 * `duration`, and any intake question by its label (case/accent-insensitive)
 * or id.
 */

type Question = { id: string; label: string };

export type BookingTitleContext = {
  name: string;
  email: string;
  questions: Question[];
  responses: Record<string, unknown> | null | undefined;
  host?: string | null;
  typeTitle?: string;
  durationMinutes?: number;
};

export type TitleSegment = { text: string } | { field: string };

const OPTION_SEPARATOR = "||";
const PLACEHOLDER = /\{([^{}]+)\}/g;

const normalize = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Fields every booking can fill, keyed by their normalized placeholder name. */
const BUILT_INS: Record<string, (ctx: BookingTitleContext) => string> = {
  name: (ctx) => ctx.name.trim(),
  nome: (ctx) => ctx.name.trim(),
  email: (ctx) => ctx.email.trim(),
  host: (ctx) => ctx.host?.trim() ?? "",
  "booking type": (ctx) => ctx.typeTitle?.trim() ?? "",
  duration: (ctx) => (ctx.durationMinutes ? `${ctx.durationMinutes} min` : ""),
};

export function splitOptions(template: string | null | undefined): string[] {
  return (template || "")
    .split(OPTION_SEPARATOR)
    .map((o) => o.trim())
    .filter(Boolean);
}

export function joinOptions(options: string[]): string {
  return splitOptions(options.join(` ${OPTION_SEPARATOR} `)).join(` ${OPTION_SEPARATOR} `);
}

export function titleSegments(option: string): TitleSegment[] {
  return option
    .split(/(\{[^{}]+\})/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("{") && part.endsWith("}") ? { field: part.slice(1, -1) } : { text: part },
    );
}

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
  const builtIn = BUILT_INS[normalize(key)];
  if (builtIn) return builtIn(ctx);
  const q = findQuestion(key, ctx.questions);
  return q ? answerText(ctx.responses?.[q.id]) : "";
}

export function renderBookingTitle(
  template: string | null | undefined,
  fallback: string,
  ctx: BookingTitleContext,
): string {
  for (const option of splitOptions(template)) {
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
  return splitOptions(template)
    .flatMap(placeholders)
    .filter((key) => !(normalize(key) in BUILT_INS) && !findQuestion(key, questions));
}

/** Puts `{field}` at the caret (clamped to the text) and returns the caret after it. */
export function insertField(
  text: string,
  caret: number,
  field: string,
): { text: string; caret: number } {
  const at = Math.min(Math.max(caret, 0), text.length);
  const token = `{${field}}`;
  return { text: text.slice(0, at) + token + text.slice(at), caret: at + token.length };
}

export type TitleVariableGroup = { title: string; fields: { key: string; hint?: string }[] };

/** What the "Insert variable" picker offers, in the order it shows them. */
export function titleVariables(
  questions: (Question & { required?: boolean })[],
): TitleVariableGroup[] {
  const asked = questions
    .filter((q) => q.label.trim())
    .map((q) => ({
      key: q.label.trim(),
      hint: q.required ? "Required" : "Optional · may be empty",
    }));
  return [
    {
      title: "Booker",
      fields: [
        { key: "name", hint: "Always filled" },
        { key: "email", hint: "Always filled" },
      ],
    },
    ...(asked.length ? [{ title: "This type's questions", fields: asked }] : []),
    { title: "Event", fields: [{ key: "booking type" }, { key: "host" }, { key: "duration" }] },
  ];
}

export type TitleSample = { host: string; typeTitle: string; durationMinutes: number };

/**
 * What the editor's preview shows for a sample booker "Maria": every question
 * answered with its own label, or none. `questions` undefined = account
 * default, where any non built-in field counts as some type's question.
 */
export function previewTitle(
  template: string,
  fallback: string,
  questions: Question[] | undefined,
  sample: TitleSample,
  answered: boolean,
): { title: string } | { unknown: string[] } {
  const named = questions?.filter((q) => q.label.trim());
  const unknown = named ? unknownTitlePlaceholders(template, named) : [];
  if (unknown.length > 0) return { unknown };
  const asked = named ?? unknownTitlePlaceholders(template, []).map((k) => ({ id: k, label: k }));
  const title = renderBookingTitle(template, fallback || "Untitled", {
    name: "Maria",
    email: "maria@example.com",
    questions: asked,
    responses: answered ? Object.fromEntries(asked.map((q) => [q.id, q.label])) : {},
    ...sample,
  });
  return { title };
}
