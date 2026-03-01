"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";

const EXAMPLES = [
  "Research top 3 AI startups on Crunchbase and compare funding",
  "Find pricing for Slack, Discord, and Teams, create comparison",
  "Search for YC W24 companies in AI, get their descriptions",
];

interface CommandInputProps {
  onExecute: (input: string) => Promise<void>;
  disabled?: boolean;
}

export function CommandInput({ onExecute, disabled }: CommandInputProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0 sm:flex-row sm:items-stretch sm:gap-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Describe your workflow..."
          className="min-w-0 flex-1 rounded-t-xl border border-gray-700 bg-gray-900/80 px-4 py-3 text-base text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 sm:rounded-b-xl sm:rounded-r-none sm:border-r-0"
          disabled={disabled}
        />
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
