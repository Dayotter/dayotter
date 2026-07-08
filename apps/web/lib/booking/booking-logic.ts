/** Pure booking helpers — no I/O — so they can be unit-tested directly. */

export class BookingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface IntakeQuestion {
  id: string;
  label: string;
  type: string;
  required: boolean;
}

/**
 * Enforce an event type's required intake questions against a booker's answers.
 * Throws `BookingError(400)` naming the first unanswered required question.
 * Checkboxes must be exactly `true`; other fields must be a non-empty string.
 */
export function validateResponses(
  questions: IntakeQuestion[] | null | undefined,
  responses: Record<string, unknown> | null | undefined,
): void {
  const answers = responses ?? {};
  for (const q of questions ?? []) {
    if (!q.required) continue;
    const v = answers[q.id];
    const answered = q.type === "checkbox" ? v === true : typeof v === "string" && v.trim() !== "";
    if (!answered) throw new BookingError(`Please answer: ${q.label}`, 400);
  }
}

/**
 * Classify an error thrown while inserting a booking:
 * - a `BookingError` passes through unchanged,
 * - a Postgres unique violation (23505 — the double-book guard) becomes a 409,
 * - anything else is rethrown as-is.
 * Always throws; never returns.
 */
export function mapInsertError(err: unknown): never {
  if (err instanceof BookingError) throw err;
  if ((err as { code?: string })?.code === "23505") {
    throw new BookingError("That time was just booked", 409);
  }
  throw err;
}
