"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { Monitor, CheckCircle, XCircle, Loader2 } from "lucide-react";

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  started: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, label: "Working", color: "text-amber-400" },
  step: { icon: <Monitor className="h-3.5 w-3.5" />, label: "Step", color: "text-sky-400" },
  output: { icon: <Monitor className="h-3.5 w-3.5" />, label: "Output", color: "text-violet-400" },
  browser_session_started: { icon: <Monitor className="h-3.5 w-3.5" />, label: "Live session", color: "text-emerald-400" },
  completed: { icon: <CheckCircle className="h-3.5 w-3.5" />, label: "Done", color: "text-emerald-400" },
  failed: { icon: <XCircle className="h-3.5 w-3.5" />, label: "Failed", color: "text-red-400" },
};

interface BrowserFeedProps {
  workflowId?: Id<"workflows"> | null;
}

export function BrowserFeed({ workflowId }: BrowserFeedProps) {
  const workflowLogs = useQuery(
    api.executionLogs.getLogsForWorkflow,
    workflowId ? { workflowId } : "skip"
  ) as Array<{
    _id: string;
    taskId: string;
    agentId: string;
    action: string;
    timestamp: number;
    details?: string;
    screenshot?: string;
  }> | undefined;

  // Only show logs for the current workflow — when no workflow is selected, show empty state so it's clear there's no activity yet
  const logs = workflowId ? (workflowLogs ?? []) : [];

  const agents = useQuery(api.agents.getAllAgents, {}) as Array<{ _id: string; name: string }> | undefined;
  const agentNames = new Map((agents ?? []).map((a) => [a._id, a.name]));

  const tasks = useQuery(
    api.tasks.getTasksByWorkflow,
    workflowId ? { workflowId } : "skip"
  ) as Array<{ _id: Id<"tasks">; logicalId: string; description: string; status: string }> | undefined;
  const taskById = new Map((tasks ?? []).map((t) => [t._id, t]));

  const recent = (logs ?? []).slice(0, 50);

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-700/80 bg-gray-900/60 shadow-lg">
      <div className="flex items-center gap-2 border-b border-gray-700/80 px-4 py-3">
        <Monitor className="h-4 w-4 text-sky-400" />
        <span className="text-sm font-semibold text-gray-200">Live agent activity</span>
        {workflowId && (
          <span className="rounded bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">This workflow</span>
        )}
      </div>
      <div className="flex-1 overflow-auto p-3">
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Monitor className="mb-2 h-10 w-10 text-gray-600" />
            <p className="text-sm font-medium text-gray-500">
              {workflowId ? "No activity yet" : "No workflow running"}
            </p>
            <p className="mt-1 text-xs text-gray-600">
              {workflowId
                ? "Agents will appear here when execution starts"
                : "Describe a workflow above and run it to see live agent activity here"}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence>
              {recent.map((log, i) => {
                const config = ACTION_CONFIG[log.action] ?? {
                  icon: <Monitor className="h-3.5 w-3.5" />,
                  label: log.action,
                  color: "text-gray-400",
                };
                const task = taskById.get(log.taskId as Id<"tasks">);
                const agentName = agentNames.get(log.agentId) ?? "Agent";
                return (
                  <motion.li
                    key={log._id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="flex gap-3 rounded-lg border border-gray-700/60 bg-gray-800/40 p-3 transition hover:border-gray-600"
                  >
                    <div className={`flex-shrink-0 ${config.color}`}>{config.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-white">{agentName}</span>
                        <span className="text-xs text-gray-500">·</span>
                        <span className="text-xs text-gray-400">{config.label}</span>
                        {task && (
                          <>
                            <span className="text-xs text-gray-500">·</span>
                            <span className="truncate text-xs text-gray-500">{task.logicalId}</span>
                          </>
                        )}
                      </div>
                      {log.details && (
                        <p className="mt-1 line-clamp-2 font-mono text-xs text-gray-400">{log.details}</p>
                      )}
                    </div>
                    {log.screenshot && (
                      <a
                        href={log.screenshot}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 overflow-hidden rounded border border-gray-600"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={log.screenshot}
                          alt="Screenshot"
                          className="h-12 w-20 object-cover"
                        />
                      </a>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
