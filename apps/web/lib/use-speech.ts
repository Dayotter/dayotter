"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Minimal shape of the browser's SpeechRecognition we use - the DOM lib doesn't
 * ship types for the (prefixed) Web Speech API, so we describe just what we call.
 */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface SpeechInputOptions {
  lang?: string;
  /** Emit partial (interim) transcripts as the user is still speaking. */
  interim?: boolean;
  /** Called with the live interim transcript (only when `interim` is true). */
  onInterim?: (text: string) => void;
}

/**
 * Speak-to-type via the browser's built-in Web Speech API - no server, no key,
 * transcription happens on the device/browser. `onResult` fires once with the
 * final transcript. With `interim: true`, `onInterim` streams the partial text
 * live (for captions). `supported` is false where the API is missing (e.g.
 * Firefox); callers should hide the mic in that case.
 *
 * Back-compat: the second arg may be a bare language string (legacy callers).
 */
export function useSpeechInput(
  onResult: (text: string) => void,
  options?: SpeechInputOptions | string,
) {
  const opts: SpeechInputOptions =
    typeof options === "string" ? { lang: options } : (options ?? {});
  const { lang, interim = false } = opts;

  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const onInterimRef = useRef(opts.onInterim);
  onInterimRef.current = opts.onInterim;

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => recRef.current?.abort();
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const abort = useCallback(() => {
    recRef.current?.abort();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    // Tear down any prior instance so we never run two recognizers at once.
    recRef.current?.abort();
    const rec = new Ctor();
    rec.lang = lang ?? navigator.language ?? "en-US";
    rec.interimResults = interim;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = (e) => {
      let interimText = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (!res) continue;
        const transcript = res[0]?.transcript ?? "";
        if (res.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (interimText && onInterimRef.current) onInterimRef.current(interimText.trim());
      const done = finalText.trim();
      if (done) onResultRef.current(done);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [lang, interim]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, start, stop, abort, toggle };
}

// ---------------------------------------------------------------------------
// Speech output (text-to-speech) - Otter's voice.
// ---------------------------------------------------------------------------

/**
 * Ordered preference of natural-sounding English voices across platforms. We
 * match by substring (case-insensitive) against the available voices and pick
 * the first that exists - falling back to any online (neural) en voice, then
 * any en voice at all. These names are the higher-quality system/cloud voices
 * on macOS, iOS, Windows, and Chrome.
 */
const PREFERRED_VOICES = [
  "Google UK English Female",
  "Microsoft Aria Online",
  "Microsoft Jenny Online",
  "Microsoft Emma Online",
  "Samantha",
  "Serena",
  "Karen",
  "Google US English",
  "Microsoft Zira",
  "Daniel",
];

const VOICE_KEY = "dayotter_voice";

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  const idx = PREFERRED_VOICES.findIndex((p) => name.includes(p.toLowerCase()));
  if (idx >= 0) return 1000 - idx; // earlier in the list = higher score
  if (!v.lang.toLowerCase().startsWith("en")) return -1;
  // Online/cloud voices tend to sound markedly better than local ones.
  return (v.localService ? 0 : 50) + (name.includes("female") ? 5 : 0);
}

/** Pick the best available voice, honouring a saved preference by name. */
function pickBestVoice(
  voices: SpeechSynthesisVoice[],
  preferredName?: string | null,
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  if (preferredName) {
    const saved = voices.find((v) => v.name === preferredName);
    if (saved) return saved;
  }
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = en.length > 0 ? en : voices;
  return [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? null;
}

export interface SpeakOptions {
  /** 0.1–2, speaking rate. Default 1.0 (natural). */
  rate?: number;
  /** 0–2, pitch. Default 1.02 (a touch bright and friendly). */
  pitch?: number;
  onEnd?: () => void;
}

/** Split into sentence-ish chunks so speech starts fast and phrasing sounds natural. */
function splitSentences(text: string): string[] {
  return (
    text
      .replace(/\s+/g, " ")
      .match(/[^.!?]+[.!?]*/g)
      ?.map((s) => s.trim())
      .filter(Boolean) ?? [text]
  );
}

/**
 * Otter's voice. Selects a natural-sounding voice, remembers the user's choice,
 * and speaks with tuned modulation. `speaking` reflects whether audio is playing.
 * A no-op (but `supported: false`) where speechSynthesis is unavailable.
 */
export function useSpeechOutput() {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceNameState] = useState<string | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);
    const saved = localStorage.getItem(VOICE_KEY);

    const load = () => {
      const list = window.speechSynthesis.getVoices();
      if (list.length === 0) return;
      setVoices(list);
      const best = pickBestVoice(list, saved);
      voiceRef.current = best;
      setVoiceNameState(best?.name ?? null);
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const setVoiceName = useCallback(
    (name: string) => {
      const v = voices.find((x) => x.name === name) ?? null;
      voiceRef.current = v;
      setVoiceNameState(v?.name ?? null);
      if (v) localStorage.setItem(VOICE_KEY, v.name);
    },
    [voices],
  );

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string, o: SpeakOptions = {}) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const clean = text.trim();
    if (!clean) {
      o.onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const chunks = splitSentences(clean);
    setSpeaking(true);
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      if (voiceRef.current) {
        u.voice = voiceRef.current;
        u.lang = voiceRef.current.lang;
      }
      u.rate = o.rate ?? 1.0;
      u.pitch = o.pitch ?? 1.02;
      if (i === chunks.length - 1) {
        u.onend = () => {
          setSpeaking(false);
          o.onEnd?.();
        };
        u.onerror = () => {
          setSpeaking(false);
          o.onEnd?.();
        };
      }
      window.speechSynthesis.speak(u);
    });
  }, []);

  return { supported, speaking, voices, voiceName, setVoiceName, speak, cancel };
}
