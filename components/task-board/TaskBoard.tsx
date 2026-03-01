"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";

const COLS = ["pending", "bidding", "assigned", "approved", "executing", "completed", "failed"] as const;
const COL_LABELS: Record<string, string> = {
  pending: "Pending",
  bidding: "Bidding",
  assigned: "Planned",
  approved: "Approved",
  executing: "Executing",
  completed: "Completed",
  failed: "Failed",
};
const COL_COLORS: Record<string, string> = {
  pending: "bg-gray-600",
  bidding: "bg-blue-600",
  assigned: "bg-amber-600",
  approved: "bg-emerald-700",
  executing: "bg-amber-500",
  completed: "bg-emerald-600",
  failed: "bg-red-600",
};

interface TaskBoardProps {
  workflowId: Id<"workflows"> | null;
}

export function TaskBoard({ workflowId }: TaskBoardProps) {
  const tasks = useQuery(
    api.tasks.getTasksByWorkflow,
    workflowId ? { workflowId } : "skip"
  ) as Array<{
    _id: Id<"tasks">;
    logicalId: string;
    description: string;
    targetUrl?: string;
    status: string;
    assignedAgentId?: Id<"agents">;
    result?: { executionTimeMs?: number };
    dependencies: string[];
  }> | undefined;

  const completed = tasks?.filter((t) => t.status === "completed").length ?? 0;
  const total = tasks?.length ?? 0;

  if (!workflowId) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-gray-800 bg-gray-900/50 p-6 text-gray-500">
        Run a workflow to see tasks
      </div>
    );
  }

  const byStatus = (status: string) => tasks?.filter((t) => t.status === status) ?? [];

  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-400">Task Board</span>
        {total > 0 && (
          <div className="h-2 flex-1 max-w-[120px] overflow-hidden rounded-full bg-gray-700">
            <motion.div
              className="h-full rounded-full bg-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${total ? (completed / total) * 100 : 0}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        )}
        {total > 0 && (
          <span className="ml-2 text-xs text-gray-500">
            {completed}/{total}
          </span>
        )}
      </div>
      <div className="grid flex-1 grid-cols-3 gap-2 overflow-auto lg:grid-cols-4 xl:grid-cols-7">
        {COLS.map((status) => (
          <div key={status} className="flex min-w-[140px] flex-col rounded-lg bg-gray-800/50 p-2">
            <div className={`mb-2 rounded px-2 py-0.5 text-xs font-medium ${COL_COLORS[status]} text-white`}>
              {COL_LABELS[status]}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <AnimatePresence>
                {byStatus(status).map((task) => (
                  <motion.div
                    key={task._id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-lg border border-gray-700 bg-gray-900 p-2 text-xs"
                  >
                    <p className="line-clamp-2 text-gray-200">{task.description}</p>
                    {task.targetUrl && (
                      <p className="mt-1 truncate text-[10px] text-gray-500">{task.targetUrl}</p>
                    )}
                    {task.result?.executionTimeMs != null && (
                      <p className="mt-1 text-[10px] text-emerald-400">{task.result.executionTimeMs}ms</p>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
