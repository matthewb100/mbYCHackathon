"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, CheckCircle, XCircle, Copy, ChevronDown, ChevronRight } from "lucide-react";

type TaskResult = {
  success: boolean;
  data?: unknown;
  executionTimeMs?: number;
};

export interface ResultsSummaryTask {
  logicalId: string;
  description: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  result?: TaskResult;
  assignedPrice?: number;
}

interface ResultsSummaryProps {
  workflowId: string | null;
  input: string;
  taskCount: number;
  completedAt?: number;
  createdAt?: number;
  totalEstimatedCost?: number;
  totalEstimatedTime?: string;
  synthesizedResult?: string;
  laminarTraceId?: string | null;
  workflowArchived?: boolean;
  tasks?: ResultsSummaryTask[];
  onClose: () => void;
}

export function ResultsSummary({
  input,
  taskCount,
  completedAt,
  createdAt,
  totalEstimatedCost,
  totalEstimatedTime,
  synthesizedResult,
  laminarTraceId,
  workflowArchived,
  tasks = [],
  onClose,
}: ResultsSummaryProps) {
  const [traceExpanded, setTraceExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const durationSec = completedAt && createdAt ? ((completedAt - createdAt) / 1000).toFixed(1) : null;
  const successCount = tasks.filter((t) => t.result?.success).length;
  const totalCost = totalEstimatedCost ?? tasks.reduce((sum, t) => sum + (t.assignedPrice ?? 0), 0);

  const copyTraceId = () => {
    if (!laminarTraceId) return;
    void navigator.clipboard.writeText(laminarTraceId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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

      {/* Total time & cost */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-300">
        {durationSec != null && <span>Total time: <strong className="text-white">{durationSec}s</strong></span>}
        {totalEstimatedTime != null && durationSec == null && (
          <span>Estimated time: <strong className="text-white">{totalEstimatedTime}</strong></span>
        )}
        {totalEstimatedCost != null && (
          <span>Total cost: <strong className="text-emerald-400">${totalEstimatedCost.toFixed(2)}</strong></span>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">{input}</p>
      <p className="mt-1 text-xs text-gray-500">{taskCount} tasks</p>

      {/* Per-agent accomplishments */}
      {tasks.length > 0 && (
        <div className="mt-3 space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wider text-gray-500">What each agent did</h4>
          <ul className="space-y-1.5">
            {tasks.map((t) => (
              <li key={t.logicalId} className="rounded border border-gray-700/80 bg-gray-800/50 px-2 py-1.5 text-xs">
                <span className="font-medium text-gray-300">{t.assignedAgentName ?? "Unassigned"}</span>
                <span className="text-gray-500"> — </span>
                <span className="text-gray-400">{t.description}</span>
                {t.result != null && (
                  <span className="ml-1 text-emerald-400/90">
                    {t.result.success ? `✓ ${(t.result.executionTimeMs ?? 0) / 1000}s` : "✗ failed"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Synthesized summary */}
      {synthesizedResult && (
        <div className="mt-3 rounded-lg border border-gray-700 bg-gray-800/50 p-3 text-sm text-gray-200">
          <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-gray-500">Summary</h4>
          {synthesizedResult}
        </div>
      )}

      {/* Trace & observability — in-page, no external link */}
      <div className="mt-3 rounded-lg border border-gray-700/80 bg-gray-800/40 overflow-hidden">
        <button
          type="button"
          onClick={() => setTraceExpanded((e) => !e)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-gray-300 hover:bg-gray-700/50"
        >
          <span className="flex items-center gap-2">
            {traceExpanded ? (
              <ChevronDown className="h-4 w-4 text-sky-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-sky-400" />
            )}
            <Activity className="h-4 w-4 text-sky-400" />
            Trace & observability
          </span>
          <span className="text-xs text-gray-500">
            {successCount}/{tasks.length} tasks · {durationSec != null ? `${durationSec}s` : "—"} · ${(totalCost ?? 0).toFixed(2)}
          </span>
        </button>
        {traceExpanded && (
          <div className="border-t border-gray-700/80 px-3 py-2.5 space-y-3">
            {/* Metrics row */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="text-gray-400">Success: <strong className="text-emerald-400">{successCount}/{tasks.length}</strong></span>
              {durationSec != null && (
                <span className="text-gray-400">Total time: <strong className="text-white">{durationSec}s</strong></span>
              )}
              <span className="text-gray-400">Cost: <strong className="text-emerald-400">${(totalCost ?? 0).toFixed(2)}</strong></span>
              {laminarTraceId && (
                <span className="flex items-center gap-1.5 text-gray-500">
                  Trace ID: <code className="rounded bg-gray-900/80 px-1.5 py-0.5 font-mono text-[10px]">{laminarTraceId.slice(0, 12)}…</code>
                  <button
                    type="button"
                    onClick={copyTraceId}
                    className="rounded p-0.5 text-gray-400 hover:bg-gray-600 hover:text-white"
                    title="Copy trace ID"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  {copied && <span className="text-emerald-400 text-[10px]">Copied</span>}
                </span>
              )}
            </div>
            {/* Task timeline */}
            {tasks.length > 0 && (
              <ul className="space-y-1.5">
                {tasks.map((t, i) => (
                  <li
                    key={t.logicalId}
                    className="flex items-start gap-2 rounded border border-gray-700/60 bg-gray-900/60 px-2 py-1.5 text-xs"
                  >
                    <span className="flex-shrink-0 w-5 text-gray-500 font-mono">{i + 1}</span>
                    <span className="min-w-0 flex-1 text-gray-300 truncate" title={t.description}>{t.description}</span>
                    <span className="flex-shrink-0 text-gray-500">{t.assignedAgentName ?? "—"}</span>
                    {t.result != null ? (
                      t.result.success ? (
                        <span className="flex flex-shrink-0 items-center gap-1 text-emerald-400">
                          <CheckCircle className="h-3.5 w-3.5" />
                          {(t.result.executionTimeMs ?? 0) / 1000}s
                          {t.assignedPrice != null && <span className="text-gray-500">${t.assignedPrice.toFixed(2)}</span>}
                        </span>
                      ) : (
                        <span className="flex flex-shrink-0 items-center gap-1 text-red-400">
                          <XCircle className="h-3.5 w-3.5" /> failed
                        </span>
                      )
                    ) : (
                      <span className="flex-shrink-0 text-gray-500">—</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Footer: archived only */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {workflowArchived && (
          <span className="rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-400">Workflow archived</span>
        )}
      </div>
    </motion.div>
  );
}
