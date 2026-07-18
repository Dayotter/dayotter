"use client";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import type { ChatAction, ChatToolAction } from "@/lib/ai/chat";
import { track } from "@/lib/analytics";
import type { Locale } from "@/lib/i18n";
import { tOtter } from "@/lib/i18n/otter";
import { useAppLocale } from "@/lib/i18n/use-locale";
import { useSpeechInput, useSpeechOutput } from "@/lib/use-speech";
import { Mic, Send, Sparkles, Volume2, VolumeX, Waves, X } from "lucide-react";
import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

function suggestions(locale: Locale): string[] {
  return [
    tOtter(locale, "suggestWhatsNext"),
    tOtter(locale, "suggestHowBusy"),
    tOtter(locale, "suggestProtectFocus"),
    tOtter(locale, "suggestFindDeck"),
  ];
}

function kindLabel(locale: Locale, kind: string): string {
  if (kind === "focus") return tOtter(locale, "kindFocus");
  if (kind === "reminder") return tOtter(locale, "kindReminder");
  return tOtter(locale, "kindMeeting");
}

function toLocalInput(iso: string): string {
  const dt = DateTime.fromISO(iso);
  return (dt.isValid ? dt : DateTime.now()).toFormat("yyyy-MM-dd'T'HH:mm");
}
function fmtWhen(iso: string, locale: Locale): string {
  const dt = DateTime.fromISO(iso).setLocale(locale);
  return dt.isValid ? dt.toFormat("ccc, LLL d 'at' h:mm a") : iso;
}

/**
 * Otter - the conversational scheduling assistant. Streams replies from
 * /api/ai/chat, supports voice in (speech-to-text) and spoken replies, and
 * renders a confirm-first action card whenever it proposes a calendar change.
 * The assistant only proposes; the human always confirms before anything runs.
 */
export function AiAssistant({
  variant = "card",
  onClose,
  onSwitchToVoice,
}: {
  variant?: "card" | "panel";
  onClose?: () => void;
  onSwitchToVoice?: () => void;
} = {}) {
  const panel = variant === "panel";
  const locale = useAppLocale();
  const router = useRouter();
  const out = useSpeechOutput();
  const speak = useCallback((text: string) => out.speak(text), [out]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakReplies, setSpeakReplies] = useState(false);

  // Current confirm-first proposal + its editable fields.
  const [action, setAction] = useState<ChatAction | null>(null);
  const [title, setTitle] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState("");
  const [newStartLocal, setNewStartLocal] = useState("");
  const [busy, setBusy] = useState(false);
  // Generic confirm-first registry action (booking types, availability, prefs, …).
  const [toolAction, setToolAction] = useState<ChatToolAction | null>(null);

  const messagesRef = useRef<Msg[]>(messages);
  messagesRef.current = messages;
  const scrollRef = useRef<HTMLDivElement>(null);
  const speakRef = useRef(false);
  speakRef.current = speakReplies;

  // Restore the spoken-replies preference.
  useEffect(() => {
    setSpeakReplies(localStorage.getItem("dayotter_tts") === "1");
  }, []);
  function toggleSpeak() {
    setSpeakReplies((v) => {
      const next = !v;
      localStorage.setItem("dayotter_tts", next ? "1" : "0");
      if (!next) out.cancel();
      return next;
    });
  }

  // Keep the thread pinned to the latest message.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on any thread change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, action]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: speak is stable enough; re-creating send per voice change is unnecessary
  const send = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      if (!content || streaming) return;
      setError(null);
      setAction(null);
      setToolAction(null);
      setInput("");
      const history = [...messagesRef.current, { role: "user" as const, content }];
      // Add the user turn + an empty assistant bubble we stream into.
      setMessages([...history, { role: "assistant", content: "" }]);
      setStreaming(true);

      let acc = "";
      const setAssistant = (text: string) =>
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: text };
          return copy;
        });

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            typeof data.error === "string" ? data.error : tOtter(locale, "unavailable"),
          );
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";
          for (const chunk of chunks) {
            const line = chunk.trim();
            if (!line.startsWith("data:")) continue;
            const ev = JSON.parse(line.slice(5).trim());
            if (ev.type === "token") {
              acc += ev.text;
              setAssistant(acc);
            } else if (ev.type === "action") {
              initAction(ev.action as ChatAction);
            } else if (ev.type === "tool_action") {
              setToolAction(ev.toolAction as ChatToolAction);
            } else if (ev.type === "error") {
              setError(ev.message);
              // Drop the empty streaming bubble so only the error shows.
              if (!acc) {
                setMessages((prev) =>
                  prev.filter(
                    (m, i) => !(i === prev.length - 1 && m.role === "assistant" && !m.content),
                  ),
                );
              }
            } else if (ev.type === "done") {
              const finalText = (ev.text as string) || acc;
              // Drop a stray empty assistant bubble (e.g. action-only turns).
              if (!finalText.trim()) {
                setMessages((prev) =>
                  prev.filter((m, i) => !(i === prev.length - 1 && !m.content)),
                );
              }
              if (speakRef.current) speak(finalText);
              track("AI Chat Turn");
            }
          }
        }
      } catch (err) {
        setMessages((prev) => prev.filter((m, i) => !(i === prev.length - 1 && !m.content)));
        setError(err instanceof Error ? err.message : tOtter(locale, "somethingWrong"));
      } finally {
        setStreaming(false);
      }
    },
    [streaming, locale, speak],
  );

  function initAction(a: ChatAction) {
    setAction(a);
    const d = a.draft;
    if (d.intent === "create") {
      setTitle(d.title);
      setStartLocal(toLocalInput(d.startISO));
      setDuration(a.matchedEventType?.durationMinutes ?? d.durationMinutes);
      setNotes(d.notes);
    } else if (d.intent === "reschedule") {
      setNewStartLocal(toLocalInput(d.newStartISO));
    }
  }

  // Speak-to-send: dictate a message and fire it.
  const speech = useSpeechInput((transcript) => void send(transcript));

  function afterAction(summary: string) {
    setAction(null);
    setMessages((prev) => [...prev, { role: "assistant", content: summary }]);
    if (speakRef.current) speak(summary);
    router.refresh();
  }

  async function confirmCreate() {
    if (!action) return;
    setBusy(true);
    setError(null);
    const startISO = DateTime.fromFormat(startLocal, "yyyy-MM-dd'T'HH:mm").toISO();
    const res = await fetch("/api/ai/schedule/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        startISO,
        durationMinutes: duration,
        notes: notes || undefined,
        attendees: action.draft.attendees,
      }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : tOtter(locale, "couldntAdd"));
      return;
    }
    track("AI Event Added", { kind: action.draft.kind, via: "chat" });
    afterAction(tOtter(locale, "addedEvent", { title }));
  }

  async function confirmReschedule() {
    if (!action?.target) return;
    setBusy(true);
    setError(null);
    const startISO = DateTime.fromFormat(newStartLocal, "yyyy-MM-dd'T'HH:mm").toISO();
    const res = await fetch(`/api/bookings/${action.target.uid}/reschedule`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ start: startISO }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : tOtter(locale, "couldntReschedule"));
      return;
    }
    track("AI Reschedule Confirmed", { via: "chat" });
    afterAction(tOtter(locale, "rescheduledOk"));
  }

  async function confirmCancel() {
    if (!action?.target) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/bookings/${action.target.uid}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : tOtter(locale, "couldntCancel"));
      return;
    }
    track("AI Cancel Confirmed", { via: "chat" });
    afterAction(tOtter(locale, "cancelledOk"));
  }

  // Confirm a registry action (create/update/delete booking types, availability,
  // preferences, focus blocks). Runs only on this explicit click; deletes arrive
  // with confirmLevel 'danger' and a red confirm button.
  async function confirmToolAction() {
    if (!toolAction) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/ai/act", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: toolAction.tool, input: toolAction.input }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setError(
        typeof data.message === "string"
          ? data.message
          : typeof data.error === "string"
            ? data.error
            : tOtter(locale, "couldntComplete"),
      );
      return;
    }
    track("AI Tool Action", { tool: toolAction.tool });
    const msg = typeof data.message === "string" ? data.message : tOtter(locale, "done");
    setToolAction(null);
    setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
    if (speakRef.current) speak(msg);
    router.refresh();
  }

  const intent = action?.draft.intent;

  return (
    <div
      className={
        panel
          ? "flex h-full min-h-0 flex-col"
          : "mb-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
      }
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-5 py-3.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <Sparkles size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-none">{tOtter(locale, "askOtter")}</p>
          <p className="mt-1 text-xs text-[var(--color-faint)]">{tOtter(locale, "chatSubtitle")}</p>
        </div>
        {onSwitchToVoice ? (
          <button
            type="button"
            onClick={onSwitchToVoice}
            title={tOtter(locale, "switchToVoice")}
            className="rounded-md p-1.5 text-[var(--color-faint)] hover:text-[var(--color-text)]"
          >
            <Waves size={16} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={toggleSpeak}
          aria-pressed={speakReplies}
          title={speakReplies ? tOtter(locale, "spokenOn") : tOtter(locale, "spokenOff")}
          className={
            speakReplies
              ? "rounded-md p-1.5 text-[var(--color-accent)]"
              : "rounded-md p-1.5 text-[var(--color-faint)] hover:text-[var(--color-text)]"
          }
        >
          {speakReplies ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={tOtter(locale, "close")}
            className="rounded-md p-1.5 text-[var(--color-faint)] hover:text-[var(--color-text)]"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      {/* Thread */}
      <div
        ref={scrollRef}
        className={`overflow-y-auto px-5 py-4 ${panel ? "min-h-0 flex-1" : "max-h-[380px] min-h-[132px]"}`}
      >
        {messages.length === 0 ? (
          <div>
            <p className="text-sm text-[var(--color-muted)]">{tOtter(locale, "emptyGreeting")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions(locale).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-full border border-[var(--color-border-strong)] px-3 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--color-accent)] px-3.5 py-2 text-sm text-white"
                      : "max-w-[85%] rounded-2xl rounded-bl-sm bg-[var(--color-surface-2)] px-3.5 py-2 text-sm text-[var(--color-text)]"
                  }
                >
                  {m.content || (
                    <span className="inline-flex gap-1">
                      <Dot /> <Dot /> <Dot />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Confirm-first action card */}
        {action && intent === "create" ? (
          <div className="mt-3 space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
            <span className="inline-block rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
              {kindLabel(locale, action.draft.kind)}
              {action.matchedEventType ? ` · ${action.matchedEventType.title}` : ""}
            </span>
            <div>
              <Label htmlFor="otter-title">{tOtter(locale, "fieldTitle")}</Label>
              <Input id="otter-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="otter-start">{tOtter(locale, "fieldStarts")}</Label>
                <Input
                  id="otter-start"
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="otter-dur">{tOtter(locale, "fieldDuration")}</Label>
                <Input
                  id="otter-dur"
                  type="number"
                  min={5}
                  max={1440}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value) || 30)}
                />
              </div>
            </div>
            {action.draft.attendees.length > 0 ? (
              <p className="text-xs text-[var(--color-muted)]">
                {tOtter(locale, "withAttendees", {
                  names: action.draft.attendees.map((a) => a.name || a.email).join(", "),
                })}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmCreate} disabled={busy}>
                {busy ? tOtter(locale, "adding") : tOtter(locale, "addToCalendar")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAction(null)} disabled={busy}>
                {tOtter(locale, "discard")}
              </Button>
            </div>
          </div>
        ) : null}

        {action && intent === "reschedule" && action.target ? (
          <div className="mt-3 space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
            <span className="inline-block rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
              {tOtter(locale, "reschedule")}
            </span>
            <p className="text-sm">
              {tOtter(locale, "moveMeeting", {
                title: action.target.title,
                when: fmtWhen(action.target.startISO, locale),
              })}
            </p>
            <Input
              type="datetime-local"
              value={newStartLocal}
              onChange={(e) => setNewStartLocal(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmReschedule} disabled={busy}>
                {busy ? tOtter(locale, "rescheduling") : tOtter(locale, "reschedule")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAction(null)} disabled={busy}>
                {tOtter(locale, "discard")}
              </Button>
            </div>
          </div>
        ) : null}

        {action && intent === "cancel" && action.target ? (
          <div className="mt-3 space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
            <span className="inline-block rounded-full bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--color-danger)]">
              {tOtter(locale, "cancel")}
            </span>
            <p className="text-sm">
              {tOtter(locale, "cancelMeetingConfirm", {
                title: action.target.title,
                when: fmtWhen(action.target.startISO, locale),
              })}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="danger" onClick={confirmCancel} disabled={busy}>
                {busy ? tOtter(locale, "cancelling") : tOtter(locale, "cancelMeeting")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAction(null)} disabled={busy}>
                {tOtter(locale, "keepIt")}
              </Button>
            </div>
          </div>
        ) : null}

        {/* Generic confirm-first action (booking types, availability, prefs, focus). */}
        {toolAction ? (
          <div
            className={`mt-3 space-y-3 rounded-lg border p-4 shadow-[var(--shadow-card)] ${
              toolAction.confirmLevel === "danger"
                ? "border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_5%,transparent)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)]"
            }`}
          >
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                toolAction.confirmLevel === "danger"
                  ? "bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-[var(--color-danger)]"
                  : "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
              }`}
            >
              {toolAction.title}
            </span>
            <p className="text-sm">{toolAction.summary}.</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={toolAction.confirmLevel === "danger" ? "danger" : "primary"}
                onClick={confirmToolAction}
                disabled={busy}
              >
                {busy
                  ? tOtter(locale, "working")
                  : toolAction.confirmLevel === "danger"
                    ? tOtter(locale, "confirmDelete")
                    : tOtter(locale, "confirm")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setToolAction(null)} disabled={busy}>
                {tOtter(locale, "discard")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <div className="border-t border-[var(--color-border)] px-3 py-3">
        {error ? (
          <div className="mb-2">
            <FormError>{error}</FormError>
          </div>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              speech.listening ? tOtter(locale, "listening") : tOtter(locale, "messagePlaceholder")
            }
            disabled={streaming}
          />
          {speech.supported ? (
            <button
              type="button"
              onClick={speech.toggle}
              aria-label={
                speech.listening ? tOtter(locale, "stopListening") : tOtter(locale, "speak")
              }
              aria-pressed={speech.listening}
              className={
                speech.listening
                  ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--color-danger)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] text-[var(--color-danger)]"
                  : "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--color-border-strong)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
              }
            >
              <Mic size={16} className={speech.listening ? "animate-pulse" : undefined} />
            </button>
          ) : null}
          <Button
            type="submit"
            disabled={streaming || !input.trim()}
            aria-label={tOtter(locale, "send")}
            className="h-10 w-10 shrink-0 px-0"
          >
            <Send size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-faint)]" />;
}
