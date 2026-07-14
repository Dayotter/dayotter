import type { ChatAction, ChatToolAction, ChatTurn } from "@/lib/ai/chat";

/**
 * Client-side streaming helper for talking to Otter over /api/ai/chat. Both the
 * text panel and the voice ("JARVIS") panel share this so the SSE parsing,
 * accumulation, and confirm-first action plumbing live in one place.
 */

export interface OtterStreamHandlers {
  /** Fires on every token with the full accumulated assistant text so far. */
  onToken?: (fullText: string) => void;
  /** A booking create/reschedule/cancel proposal (rich editable card). */
  onAction?: (action: ChatAction) => void;
  /** A registry action (booking types, availability, prefs, focus) to confirm. */
  onToolAction?: (toolAction: ChatToolAction) => void;
  onError?: (message: string) => void;
  /** The final trimmed assistant text once the turn is complete. */
  onDone?: (finalText: string) => void;
}

/** Stream one assistant turn. Resolves when the stream ends (or errors softly). */
export async function streamOtterChat(
  turns: ChatTurn[],
  handlers: OtterStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: turns }),
      signal,
    });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") return;
    handlers.onError?.("Couldn't reach the assistant.");
    return;
  }

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}) as Record<string, unknown>);
    handlers.onError?.(
      typeof data.error === "string" ? data.error : "The assistant is unavailable.",
    );
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let acc = "";
  let finalText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        const line = chunk.trim();
        if (!line.startsWith("data:")) continue;
        let ev: {
          type: string;
          text?: string;
          message?: string;
          action?: ChatAction;
          toolAction?: ChatToolAction;
        };
        try {
          ev = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (ev.type === "token") {
          acc += ev.text ?? "";
          handlers.onToken?.(acc);
        } else if (ev.type === "action" && ev.action) {
          handlers.onAction?.(ev.action);
        } else if (ev.type === "tool_action" && ev.toolAction) {
          handlers.onToolAction?.(ev.toolAction);
        } else if (ev.type === "error") {
          handlers.onError?.(ev.message ?? "Something went wrong.");
        } else if (ev.type === "done") {
          finalText = (ev.text || acc).trim();
        }
      }
    }
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") return;
    handlers.onError?.("The connection dropped.");
    return;
  }

  handlers.onDone?.(finalText || acc.trim());
}

// ---------------------------------------------------------------------------
// Confirm-first action runners. Each runs ONLY after the human confirms (tap or
// spoken "confirm"). They mirror the endpoints the text panel calls.
// ---------------------------------------------------------------------------

export interface ActionResult {
  ok: boolean;
  message?: string;
  error?: string;
}

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

export async function runCreateEvent(input: {
  title: string;
  startISO: string | null;
  durationMinutes: number;
  notes?: string;
  attendees?: { name?: string; email: string }[];
}): Promise<ActionResult> {
  const res = await postJson("/api/ai/schedule/create", input);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) return { ok: false, error: strOr(data.error, "Couldn't add the event.") };
  return { ok: true };
}

export async function runReschedule(uid: string, startISO: string | null): Promise<ActionResult> {
  const res = await postJson(`/api/bookings/${uid}/reschedule`, { start: startISO });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) return { ok: false, error: strOr(data.error, "Couldn't reschedule that.") };
  return { ok: true };
}

export async function runCancel(uid: string): Promise<ActionResult> {
  const res = await postJson(`/api/bookings/${uid}/cancel`, {});
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) return { ok: false, error: strOr(data.error, "Couldn't cancel that.") };
  return { ok: true };
}

export async function runToolAction(tool: string, input: unknown): Promise<ActionResult> {
  const res = await postJson("/api/ai/act", { tool, input });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !data.ok) {
    return { ok: false, error: strOr(data.message ?? data.error, "Couldn't complete that.") };
  }
  return { ok: true, message: strOr(data.message, "Done.") };
}

function strOr(v: unknown, fallback: string): string {
  return typeof v === "string" && v ? v : fallback;
}
