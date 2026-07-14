/** Minimal TwiML builders for the voice receptionist. */

function esc(s: string): string {
  return s.replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c,
  );
}

const VOICE = 'voice="Polly.Joanna-Neural"';

/** Scheduling words we bias the recognizer toward - improves phone accuracy. */
const SPEECH_HINTS =
  "book, appointment, reschedule, cancel, availability, hours, meeting, consultation, price, times";

function doc(inner: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, {
    status: 200,
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

/**
 * Speak `say`, then listen for the caller's next utterance. Uses Twilio's
 * enhanced phone-call speech model + domain hints for better transcription, and
 * lets the caller barge in over the prompt so it feels like a real conversation.
 */
export function sayAndGather(say: string, actionPath: string): Response {
  return doc(
    `<Gather input="speech" speechTimeout="auto" speechModel="phone_call" enhanced="true"` +
      ` language="en-US" bargeIn="true" hints="${esc(SPEECH_HINTS)}"` +
      ` action="${esc(actionPath)}" method="POST">` +
      `<Say ${VOICE}>${esc(say)}</Say>` +
      `</Gather>` +
      // If they say nothing, re-prompt once by re-hitting the same action.
      `<Redirect method="POST">${esc(actionPath)}</Redirect>`,
  );
}

/** Speak `say` and end the call. */
export function sayAndHangup(say: string): Response {
  return doc(`<Say ${VOICE}>${esc(say)}</Say><Hangup/>`);
}
