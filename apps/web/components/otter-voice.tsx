"use client";

import { Button } from "@/components/ui/button";
import type { ChatAction, ChatToolAction, ChatTurn } from "@/lib/ai/chat";
import {
  runCancel,
  runCreateEvent,
  runReschedule,
  runToolAction,
  streamOtterChat,
} from "@/lib/ai/otter-client";
import { track } from "@/lib/analytics";
import { useSpeechInput, useSpeechOutput } from "@/lib/use-speech";
import { MessageSquare, Mic, Volume2, VolumeX, X } from "lucide-react";
import { DateTime } from "luxon";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "listening" | "thinking" | "speaking";

const CONFIRM_RE =
  /\b(confirm|yes|yep|yeah|do it|go ahead|book it|sounds good|please do|okay|ok)\b/i;
const DISCARD_RE = /\b(discard|no thanks|nope|never ?mind|forget it|stop|not now)\b/i;

const HINTS = [
  "What's next on my calendar?",
  "Protect 3 hours of focus this week",
  "Move my next meeting to Friday",
];

function fmtWhen(iso: string): string {
  const dt = DateTime.fromISO(iso);
  return dt.isValid ? dt.toFormat("ccc, LLL d 'at' h:mm a") : iso;
}

/**
 * Otter Voice - a hands-free, JARVIS-style conversation with the scheduling
 * assistant. Tap the orb and talk: Otter listens, thinks, and speaks its reply,
 * then listens again. It stays confirm-first - any calendar change surfaces a
 * card you approve by tapping Confirm or simply saying "confirm".
 */
export function OtterVoice({
  onSwitchToChat,
  onClose,
}: {
  onSwitchToChat?: () => void;
  onClose?: () => void;
}) {
  const out = useSpeechOutput();

  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [interim, setInterim] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const [action, setAction] = useState<ChatAction | null>(null);
  const [toolAction, setToolAction] = useState<ChatToolAction | null>(null);
  const [busy, setBusy] = useState(false);

  // Refs mirror state for use inside speech callbacks (registered once).
  const activeRef = useRef(active);
  activeRef.current = active;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const pendingRef = useRef(false);
  pendingRef.current = Boolean(action || toolAction);
  const scrollRef = useRef<HTMLDivElement>(null);

  const say = useCallback(
    (text: string, onEnd?: () => void) => {
      if (muted || !out.supported) {
        onEnd?.();
        return;
      }
      out.speak(text, { onEnd });
    },
    [muted, out],
  );

  const beginListening = useCallback(() => {
    if (!activeRef.current) return;
    setInterim("");
    setPhase("listening");
    speechStartRef.current?.();
  }, []);

  // Forward ref to speech.start (defined after the hook below).
  const speechStartRef = useRef<(() => void) | null>(null);

  const runTurn = useCallback(
    (turns: ChatTurn[]) => {
      setReply("");
      setError(null);
      setPhase("thinking");
      let localAction: ChatAction | null = null;
      let localTool: ChatToolAction | null = null;

      void streamOtterChat(turns, {
        onToken: (full) => setReply(full),
        onAction: (a) => {
          localAction = a;
          setAction(a);
        },
        onToolAction: (t) => {
          localTool = t;
          setToolAction(t);
        },
        onError: (msg) => {
          setError(msg);
          setPhase("idle");
          say("Sorry, I ran into a problem.");
        },
        onDone: (finalText) => {
          const text = finalText.trim();
          if (text) setMessages((prev) => [...prev, { role: "assistant", content: text }]);
          setReply("");
          const hasPending = Boolean(localAction || localTool);
          const spoken =
            text || (hasPending ? "I've drafted that - say confirm to go ahead, or discard." : "");
          setPhase("speaking");
          say(spoken, () => {
            // After speaking: if awaiting a confirm, listen for confirm/discard.
            // Otherwise loop back to listening for the next request.
            if (activeRef.current) beginListening();
            else setPhase("idle");
          });
        },
      });
    },
    [say, beginListening],
  );

  const handleUtterance = useCallback(
    (finalText: string) => {
      const text = finalText.trim();
      if (!text) return;
      setInterim("");

      // If a confirm-first card is showing, treat speech as confirm / discard.
      if (pendingRef.current) {
        if (CONFIRM_RE.test(text)) {
          void confirmPending();
          return;
        }
        if (DISCARD_RE.test(text)) {
          discardPending();
          say("Discarded.", () => {
            if (activeRef.current) beginListening();
          });
          return;
        }
        // Unclear - re-prompt and listen again.
        setPhase("speaking");
        say("Say confirm to go ahead, or discard.", () => {
          if (activeRef.current) beginListening();
        });
        return;
      }

      const next: ChatTurn[] = [...messagesRef.current, { role: "user", content: text }];
      setMessages(next);
      runTurn(next);
    },
    // confirmPending/discardPending are defined below but stable via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runTurn, say, beginListening],
  );

  const speech = useSpeechInput(handleUtterance, {
    interim: true,
    onInterim: (t) => setInterim(t),
  });
  speechStartRef.current = speech.start;

  // If listening ends with no result (silence / denied mic), fall back to idle.
  useEffect(() => {
    if (!speech.listening && phaseRef.current === "listening" && activeRef.current) {
      setPhase("idle");
    }
  }, [speech.listening]);

  // Pin the transcript to the latest line.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on any change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, reply, interim, action, toolAction]);

  function startConversation() {
    setError(null);
    setActive(true);
    activeRef.current = true;
    setInterim("");
    setPhase("listening");
    // Speak a short greeting only on the very first start of an empty thread.
    if (messagesRef.current.length === 0) {
      setPhase("speaking");
      say("Hi, I'm Otter. What can I do with your calendar?", () => {
        if (activeRef.current) beginListening();
      });
    } else {
      beginListening();
    }
    track("Otter Voice Started");
  }

  const stopConversation = useCallback(() => {
    setActive(false);
    activeRef.current = false;
    speech.abort();
    out.cancel();
    setInterim("");
    setPhase("idle");
  }, [speech, out]);

  function onOrbTap() {
    if (!activeRef.current) {
      startConversation();
      return;
    }
    // Barge-in: tapping while Otter speaks interrupts and listens.
    if (out.speaking) {
      out.cancel();
      beginListening();
      return;
    }
    if (phase === "listening") {
      stopConversation();
      return;
    }
    // thinking - ignore taps
  }

  function discardPending() {
    setAction(null);
    setToolAction(null);
  }

  async function confirmPending() {
    const a = action;
    const t = toolAction;
    if (!a && !t) return;
    setBusy(true);
    setError(null);
    out.cancel();
    setPhase("thinking");

    let summary = "Done.";
    let ok = false;
    try {
      if (a) {
        const d = a.draft;
        if (d.intent === "create") {
          const r = await runCreateEvent({
            title: d.title,
            startISO: d.startISO,
            durationMinutes: a.matchedEventType?.durationMinutes ?? d.durationMinutes,
            notes: d.notes || undefined,
            attendees: d.attendees,
          });
          ok = r.ok;
          summary = r.ok ? `Added ${d.title} to your calendar.` : (r.error ?? "That didn't work.");
          if (r.ok) track("AI Event Added", { kind: d.kind, via: "voice" });
        } else if (d.intent === "reschedule" && a.target) {
          const r = await runReschedule(a.target.uid, d.newStartISO);
          ok = r.ok;
          summary = r.ok ? "Rescheduled - attendees notified." : (r.error ?? "That didn't work.");
          if (r.ok) track("AI Reschedule Confirmed", { via: "voice" });
        } else if (d.intent === "cancel" && a.target) {
          const r = await runCancel(a.target.uid);
          ok = r.ok;
          summary = r.ok ? "Cancelled - attendees notified." : (r.error ?? "That didn't work.");
          if (r.ok) track("AI Cancel Confirmed", { via: "voice" });
        }
      } else if (t) {
        const r = await runToolAction(t.tool, t.input);
        ok = r.ok;
        summary = r.ok ? (r.message ?? "Done.") : (r.error ?? "That didn't work.");
        if (r.ok) track("AI Tool Action", { tool: t.tool, via: "voice" });
      }
    } catch {
      summary = "Something went wrong.";
    }

    setBusy(false);
    setAction(null);
    setToolAction(null);
    if (!ok) setError(summary);
    setMessages((prev) => [...prev, { role: "assistant", content: summary }]);
    setPhase("speaking");
    say(summary, () => {
      if (activeRef.current) beginListening();
      else setPhase("idle");
    });
  }

  const noRecognition = !speech.supported;

  const statusLabel = !active
    ? messages.length > 0
      ? "Tap to continue"
      : "Tap to start talking"
    : phase === "listening"
      ? "Listening…"
      : phase === "thinking"
        ? "Thinking…"
        : phase === "speaking"
          ? "Otter is speaking"
          : "Tap the orb to talk";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <VoiceStyles />

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-5 py-3.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <Mic size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-none">Talk to Otter</p>
          <p className="mt-1 text-xs text-[var(--color-faint)]">
            Hands-free · you confirm before anything changes
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-pressed={muted}
          title={muted ? "Otter's voice is muted" : "Otter's voice is on"}
          className={
            muted
              ? "rounded-md p-1.5 text-[var(--color-faint)] hover:text-[var(--color-text)]"
              : "rounded-md p-1.5 text-[var(--color-accent)]"
          }
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        {onSwitchToChat ? (
          <button
            type="button"
            onClick={() => {
              stopConversation();
              onSwitchToChat();
            }}
            title="Switch to text chat"
            className="rounded-md p-1.5 text-[var(--color-faint)] hover:text-[var(--color-text)]"
          >
            <MessageSquare size={16} />
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={() => {
              stopConversation();
              onClose();
            }}
            aria-label="Close"
            className="rounded-md p-1.5 text-[var(--color-faint)] hover:text-[var(--color-text)]"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 && !reply && !interim ? (
          <div className="mt-2 text-center">
            <p className="text-sm text-[var(--color-muted)]">
              Tap the orb and just say what you need. Try:
            </p>
            <ul className="mt-3 space-y-1.5">
              {HINTS.map((h) => (
                <li key={h} className="text-sm italic text-[var(--color-faint)]">
                  “{h}”
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <Bubble key={i} who={m.role} text={m.content} />
            ))}
            {reply ? <Bubble who="assistant" text={reply} /> : null}
            {interim ? <Bubble who="user" text={interim} muted /> : null}
          </div>
        )}

        {/* Confirm-first card */}
        {action ? (
          <ConfirmCard
            title={confirmTitle(action)}
            body={confirmBody(action)}
            danger={action.draft.intent === "cancel"}
            busy={busy}
            onConfirm={() => void confirmPending()}
            onDiscard={discardPending}
          />
        ) : null}
        {toolAction ? (
          <ConfirmCard
            title={toolAction.title}
            body={`${toolAction.summary}.`}
            danger={toolAction.confirmLevel === "danger"}
            busy={busy}
            onConfirm={() => void confirmPending()}
            onDiscard={discardPending}
          />
        ) : null}
      </div>

      {/* Orb + controls */}
      <div className="border-t border-[var(--color-border)] px-5 py-6">
        {error ? (
          <p className="mb-3 text-center text-sm text-[var(--color-danger)]">{error}</p>
        ) : null}

        {noRecognition ? (
          <div className="text-center">
            <p className="text-sm text-[var(--color-muted)]">
              Voice input isn't supported in this browser. Try Chrome or Safari - or switch to text
              chat.
            </p>
            {onSwitchToChat ? (
              <Button className="mt-3" variant="outline" size="sm" onClick={onSwitchToChat}>
                Switch to chat
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={onOrbTap}
              aria-label={active ? "Stop or interrupt Otter" : "Start talking to Otter"}
              className="otter-orb-btn"
              data-phase={active ? phase : "off"}
            >
              <span className="otter-orb-ring otter-orb-ring-1" />
              <span className="otter-orb-ring otter-orb-ring-2" />
              <span className="otter-orb-core">
                <img
                  src="/brand/illustrations/otter-focus.png"
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              </span>
            </button>
            <p className="text-sm font-medium text-[var(--color-muted)]">{statusLabel}</p>
            {active ? (
              <Button variant="ghost" size="sm" onClick={stopConversation}>
                End conversation
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function confirmTitle(a: ChatAction): string {
  if (a.draft.intent === "create") return a.matchedEventType?.title ?? "New event";
  if (a.draft.intent === "reschedule") return "Reschedule";
  if (a.draft.intent === "cancel") return "Cancel meeting";
  return "Confirm";
}

function confirmBody(a: ChatAction): string {
  const d = a.draft;
  if (d.intent === "create") {
    const dur = a.matchedEventType?.durationMinutes ?? d.durationMinutes;
    return `${d.title} · ${fmtWhen(d.startISO)} · ${dur} min`;
  }
  if (d.intent === "reschedule" && a.target) {
    return `Move “${a.target.title}” to ${fmtWhen(d.newStartISO)}`;
  }
  if (d.intent === "cancel" && a.target) {
    return `Cancel “${a.target.title}” on ${fmtWhen(a.target.startISO)}. Attendees are notified.`;
  }
  return "";
}

function Bubble({
  who,
  text,
  muted,
}: { who: "user" | "assistant"; text: string; muted?: boolean }) {
  return (
    <div className={who === "user" ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          who === "user"
            ? `max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2 text-sm text-white ${muted ? "bg-[color-mix(in_srgb,var(--color-accent)_55%,transparent)]" : "bg-[var(--color-accent)]"}`
            : "max-w-[85%] rounded-2xl rounded-bl-sm bg-[var(--color-surface-2)] px-3.5 py-2 text-sm text-[var(--color-text)]"
        }
      >
        {text}
      </div>
    </div>
  );
}

function ConfirmCard({
  title,
  body,
  danger,
  busy,
  onConfirm,
  onDiscard,
}: {
  title: string;
  body: string;
  danger?: boolean;
  busy: boolean;
  onConfirm: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      className={`mt-3 space-y-3 rounded-lg border p-4 shadow-[var(--shadow-card)] ${
        danger
          ? "border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_5%,transparent)]"
          : "border-[var(--color-border)] bg-[var(--color-surface)]"
      }`}
    >
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
          danger
            ? "bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-[var(--color-danger)]"
            : "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
        }`}
      >
        {title}
      </span>
      <p className="text-sm text-[var(--color-text)]">{body}</p>
      <p className="text-xs text-[var(--color-faint)]">Tap Confirm, or just say “confirm”.</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={danger ? "danger" : "primary"}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Working…" : danger ? "Confirm" : "Confirm"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard} disabled={busy}>
          Discard
        </Button>
      </div>
    </div>
  );
}

/** Scoped keyframes + orb styling. Injected inline so the component is self-contained. */
function VoiceStyles() {
  return (
    <style>{`
      .otter-orb-btn{position:relative;display:flex;align-items:center;justify-content:center;width:168px;height:168px;border:0;background:transparent;cursor:pointer;-webkit-tap-highlight-color:transparent;}
      .otter-orb-core{position:relative;z-index:2;display:flex;align-items:center;justify-content:center;width:104px;height:104px;border-radius:9999px;overflow:hidden;box-shadow:0 0 0 4px color-mix(in srgb,var(--color-accent) 30%,transparent),0 12px 40px color-mix(in srgb,var(--color-accent) 35%,transparent);animation:otterBreathe 4s ease-in-out infinite;}
      .otter-orb-ring{position:absolute;inset:0;margin:auto;width:120px;height:120px;border-radius:9999px;background:radial-gradient(circle,color-mix(in srgb,var(--color-accent) 22%,transparent) 0%,transparent 70%);opacity:0;}
      .otter-orb-btn[data-phase="off"] .otter-orb-core{animation-duration:5s;}
      .otter-orb-btn[data-phase="off"] .otter-orb-ring{opacity:.25;}
      .otter-orb-btn[data-phase="idle"] .otter-orb-ring{opacity:.3;}
      /* Listening: outward sonar pulses */
      .otter-orb-btn[data-phase="listening"] .otter-orb-ring-1{animation:otterPulse 1.6s ease-out infinite;}
      .otter-orb-btn[data-phase="listening"] .otter-orb-ring-2{animation:otterPulse 1.6s ease-out infinite;animation-delay:.8s;}
      /* Speaking: faster, brighter pulses + livelier core */
      .otter-orb-btn[data-phase="speaking"] .otter-orb-ring-1{animation:otterPulse .9s ease-out infinite;}
      .otter-orb-btn[data-phase="speaking"] .otter-orb-ring-2{animation:otterPulse .9s ease-out infinite;animation-delay:.45s;}
      .otter-orb-btn[data-phase="speaking"] .otter-orb-core{animation:otterBreathe 1.1s ease-in-out infinite;}
      /* Thinking: rotating halo */
      .otter-orb-btn[data-phase="thinking"] .otter-orb-ring-1{opacity:1;background:conic-gradient(from 0deg,transparent 0%,color-mix(in srgb,var(--color-accent) 55%,transparent) 35%,transparent 70%);animation:otterSpin 1s linear infinite;-webkit-mask:radial-gradient(circle,transparent 46px,#000 47px);mask:radial-gradient(circle,transparent 46px,#000 47px);}
      @keyframes otterBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
      @keyframes otterPulse{0%{transform:scale(.7);opacity:.55}100%{transform:scale(1.5);opacity:0}}
      @keyframes otterSpin{to{transform:rotate(360deg)}}
      @media (prefers-reduced-motion: reduce){
        .otter-orb-core{animation:none!important}
        .otter-orb-ring{animation:none!important}
      }
    `}</style>
  );
}
