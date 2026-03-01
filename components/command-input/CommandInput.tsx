"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Zap, Mic, MicOff } from "lucide-react";

const EXAMPLES = [
  "Research top 3 AI startups on Crunchbase and compare funding",
  "Find pricing for Slack, Discord, and Teams, create comparison",
  "Search for YC W24 companies in AI, get their descriptions",
  "Search Google for 'Anthropic' and for 'Claude', return the first result URL for each.",
];

interface CommandInputProps {
  onExecute: (input: string) => Promise<void>;
  disabled?: boolean;
  showRunAnother?: boolean;
}

export function CommandInput({ onExecute, disabled, showRunAnother }: CommandInputProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SILENCE_STOP_MS = 2500;
  const getSpeechRecognition = useCallback((): (new () => SpeechRecognition) | null => {
    if (typeof window === "undefined") return null;
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
  }, []);
  const placeholder = showRunAnother
    ? "Run another workflow — reputation and memory updated"
    : "Describe your workflow...";

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || loading || disabled) return;
    setLoading(true);
    try {
      await onExecute(text);
      setInput("");
    } finally {
      setLoading(false);
    }
  };

  const startVoiceInput = useCallback(() => {
    if (disabled) return;
    setVoiceError(null);
    const SR = getSpeechRecognition();
    if (!SR) {
      setVoiceError("Voice not supported. Use Chrome or Safari.");
      return;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
      setListening(false);
      return;
    }
    try {
      const recognition = new SR();
      recognitionRef.current = recognition as SpeechRecognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.length > 0) transcript += result[0].transcript;
          if (i < event.results.length - 1) transcript += " ";
        }
        if (transcript.trim()) setInput(transcript.trim());
        silenceTimeoutRef.current = setTimeout(() => {
          silenceTimeoutRef.current = null;
          if (recognitionRef.current) {
            try {
              recognitionRef.current.stop();
            } catch {
              /* noop */
            }
            recognitionRef.current = null;
            setListening(false);
          }
        }, SILENCE_STOP_MS);
      };

      recognition.onend = () => {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
        recognitionRef.current = null;
        setListening(false);
      };

      recognition.onerror = (event: Event & { error?: string }) => {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
        recognitionRef.current = null;
        setListening(false);
        const msg = event.error === "not-allowed" ? "Microphone access denied" : event.error ?? "Speech error";
        setVoiceError(msg);
      };

      recognition.onnomatch = () => {
        setListening(false);
      };

      recognition.start();
      setListening(true);
      silenceTimeoutRef.current = setTimeout(() => {
        silenceTimeoutRef.current = null;
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {
            /* noop */
          }
          recognitionRef.current = null;
          setListening(false);
        }
      }, SILENCE_STOP_MS);
    } catch (err) {
      setListening(false);
      setVoiceError(err instanceof Error ? err.message : "Could not start voice input");
    }
  }, [disabled, getSpeechRecognition]);

  const stopVoiceInput = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0 sm:flex-row sm:items-stretch sm:gap-0">
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="relative flex min-w-0 flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder={placeholder}
              className="min-w-0 flex-1 rounded-t-xl border border-gray-700 bg-gray-900/80 py-3 pl-4 pr-12 text-base text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 sm:rounded-b-xl sm:rounded-r-none sm:border-r-0"
              disabled={disabled}
            />
            <button
              type="button"
              onClick={listening ? stopVoiceInput : startVoiceInput}
              disabled={disabled}
              title={listening ? "Stop listening" : "Voice input (speak your workflow)"}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 flex-shrink-0 items-center justify-center rounded-lg text-sky-400/90 transition hover:bg-gray-700/80 hover:text-sky-300"
              aria-label={listening ? "Stop listening" : "Voice input"}
            >
              <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                {listening ? (
                  <>
                    <span className="absolute inset-0 animate-ping rounded-full bg-red-400/30" aria-hidden />
                    <MicOff className="h-5 w-5 text-red-400" aria-hidden />
                  </>
                ) : (
                  <Mic className="h-5 w-5" aria-hidden />
                )}
              </span>
            </button>
          </div>
          {voiceError && (
            <p className="mt-1 text-xs text-amber-400">{voiceError}</p>
          )}
        </div>
        <motion.button
          type="button"
          onClick={handleSubmit}
          disabled={!input.trim() || loading || disabled}
          className="flex items-center justify-center gap-2 rounded-b-xl border border-t-0 border-gray-700 bg-gradient-to-b from-sky-600 to-sky-700 px-6 py-3 font-medium text-white shadow-lg shadow-sky-900/30 transition hover:from-sky-500 hover:to-sky-600 disabled:opacity-50 sm:rounded-l-none sm:rounded-r-xl sm:border-l-0 sm:border-t sm:border-gray-700"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <Zap className="h-4 w-4" />
          Execute
        </motion.button>
      </div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <motion.button
            key={ex}
            type="button"
            onClick={() => setInput(ex)}
            className="rounded-full border border-gray-600 bg-gray-800/60 px-3 py-1.5 text-sm text-gray-300 transition hover:border-sky-500/50 hover:bg-gray-800 hover:text-white"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            {ex}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
