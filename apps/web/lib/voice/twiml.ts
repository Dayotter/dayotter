/** Minimal TwiML builders for the voice receptionist. */

function esc(s: string): string {
  return s.replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c,
  );
}

const VOICE = 'voice="Polly.Joanna-Neural"';

function doc(inner: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, {
    status: 200,
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

/** Speak `say`, then listen for the caller's next utterance (speech). */
export function sayAndGather(say: string, actionPath: string): Response {
  return doc(
    `<Gather input="speech" speechTimeout="auto" action="${esc(actionPath)}" method="POST">` +
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
