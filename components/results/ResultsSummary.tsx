"use client";

import { motion } from "framer-motion";

interface ResultsSummaryProps {
  workflowId: string | null;
  input: string;
  taskCount: number;
  completedAt?: number;
  createdAt?: number;
  synthesizedResult?: string;
  laminarTraceId?: string | null;
  onClose: () => void;
}

export function ResultsSummary({
  input,
  taskCount,
  completedAt,
  createdAt,
  synthesizedResult,
  laminarTraceId,
  onClose,
}: ResultsSummaryProps) {
  const durationSec = completedAt && createdAt ? ((completedAt - createdAt) / 1000).toFixed(1) : null;

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="rounded-xl border border-emerald-500/30 bg-gray-900/95 p-4 shadow-lg"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-emerald-400">Workflow completed</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-500 hover:text-white"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      {durationSec && (
        <p className="mt-2 text-sm text-gray-300">Completed in {durationSec}s</p>
      )}
      <p className="mt-1 text-xs text-gray-500">{input}</p>
      <p className="mt-2 text-xs text-gray-500">{taskCount} tasks</p>
      {synthesizedResult && (
        <div className="mt-3 rounded-lg border border-gray-700 bg-gray-800/50 p-3 text-sm text-gray-200">
          {synthesizedResult}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <a
          href={
            laminarTraceId
              ? `https://app.lmnr.ai/traces/${laminarTraceId}`
              : "https://laminar.sh"
          }
          target="_blank"
          rel="noopener noreferrer"
          className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
        >
          {laminarTraceId ? "View trace (Laminar)" : "Laminar"}
        </a>
      </div>
    </motion.div>
  );
}
