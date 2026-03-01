"use client";

import { motion } from "framer-motion";
import type { ExecutionPlan } from "@/types";

interface ExecutionPlanCardProps {
  plan: ExecutionPlan;
  workflowId: string;
  onApproveAndExecute: () => void;
  isExecuting?: boolean;
}

export function ExecutionPlanCard({
  plan,
  onApproveAndExecute,
  isExecuting = false,
}: ExecutionPlanCardProps) {
  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="rounded-xl border border-amber-500/40 bg-gray-900/95 p-4 shadow-lg"
    >
      <h3 className="text-lg font-semibold text-amber-400">Execution plan</h3>
      <p className="mt-1 text-sm text-gray-400">{plan.reasoning}</p>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span className="text-gray-300">
          Est. cost: <strong className="text-white">${plan.totalEstimatedCost.toFixed(2)}</strong>
        </span>
        <span className="text-gray-300">
          Est. time: <strong className="text-white">{plan.totalEstimatedTime}</strong>
        </span>
      </div>
      <ul className="mt-4 space-y-2">
        {plan.tasks.map((t) => (
          <li
            key={t.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-xs"
          >
            <span className="font-medium text-amber-300/90">{t.id}</span>
            <span className="text-gray-400">→</span>
            <span className="text-white">{t.assignedAgent}</span>
            <span className="text-gray-500">${t.bidPrice.toFixed(2)}</span>
            <span className="text-gray-500">{t.estimatedTime}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onApproveAndExecute}
          disabled={isExecuting}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-amber-400 disabled:opacity-50"
        >
          {isExecuting ? "Executing…" : "Approve & Execute"}
        </button>
      </div>
    </motion.div>
  );
}
