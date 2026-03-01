"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { motion } from "framer-motion";
import { Monitor, Loader2 } from "lucide-react";

interface LiveBrowserGridProps {
  workflowId: Id<"workflows"> | null;
}

type TaskRow = {
  _id: Id<"tasks">;
  logicalId: string;
  description: string;
  targetUrl?: string;
  status: string;
  assignedAgentId?: Id<"agents">;
  liveUrl?: string | null;
};

type LogRow = {
  taskId: Id<"tasks">;
  action: string;
  details?: string;
};

function getLiveUrlFromLogs(
  taskId: Id<"tasks">,
  logs: LogRow[] | undefined
): string | null {
  if (!logs) return null;
  const log = logs.find((l) => l.taskId === taskId && l.action === "browser_session_started");
  if (!log?.details) return null;
  try {
    const d = JSON.parse(log.details) as { liveUrl?: string };
    const url = d.liveUrl ?? null;
    return url && !url.includes("browser-placeholder") ? url : null;
  } catch {
    return null;
  }
}

export function LiveBrowserGrid({ workflowId }: LiveBrowserGridProps) {
  const tasks = useQuery(
    api.tasks.getTasksByWorkflow,
    workflowId ? { workflowId } : "skip"
  ) as TaskRow[] | undefined;

  const logs = useQuery(
    api.executionLogs.getLogsForWorkflow,
    workflowId ? { workflowId } : "skip"
  ) as LogRow[] | undefined;

  const agents = useQuery(api.agents.getAllAgents, {}) as Array<{ _id: string; name: string; isExternal?: boolean }> | undefined;
  const agentNames = new Map((agents ?? []).map((a) => [a._id, a.name]));
  const agentIsExternal = new Map((agents ?? []).map((a) => [a._id, !!a.isExternal]));

  const showTasks = (tasks ?? [])
    .filter(
      (t) =>
        t.status === "executing" ||
        (t.liveUrl && (t.status === "completed" || t.status === "failed" || t.status === "executing"))
    )
    .sort((a, b) => {
      if (a.status === "executing" && b.status !== "executing") return -1;
      if (b.status === "executing" && a.status !== "executing") return 1;
      return 0;
    });
  const maxCells = 9;
  const slice = showTasks.slice(0, maxCells);

  if (!workflowId || slice.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-gray-800 bg-gray-900/50 p-8 text-center">
        <Monitor className="mb-3 h-12 w-12 text-gray-600" />
        <p className="text-sm font-medium text-gray-500">Live browser view</p>
        <p className="mt-1 text-xs text-gray-600">Run a workflow and approve execution to see agents in live browser iframes</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {slice.map((task, i) => {
        const agentName = task.assignedAgentId ? agentNames.get(task.assignedAgentId) ?? "Agent" : "Agent";
        const isExternal = task.assignedAgentId ? agentIsExternal.get(task.assignedAgentId) ?? false : false;
        const rawUrl = task.liveUrl ?? getLiveUrlFromLogs(task._id, logs);
        const isRealStream = !!rawUrl && !String(rawUrl).includes("browser-placeholder");
        const isExecuting = task.status === "executing";

        return (
          <motion.div
            key={task._id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.06, 0.3) }}
            className="browser-window flex flex-col overflow-hidden rounded-xl border border-gray-700/80 bg-gray-900/80 shadow-xl"
          >
            <div className="browser-chrome flex flex-wrap items-center gap-2 border-b border-gray-700/80 bg-gray-800/90 px-3 py-2">
              <div
                className={`h-2 w-2 flex-shrink-0 rounded-full ${
                  isExecuting ? "animate-pulse bg-emerald-400 ring-2 ring-emerald-400/30" : "bg-gray-500"
                }`}
              />
              <span className="truncate text-sm font-medium text-white">{agentName}</span>
              {isExternal && (
                <span className="rounded bg-amber-600/80 px-1.5 py-0.5 text-[10px] font-medium text-amber-100">
                  External
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-xs text-gray-400" title={task.targetUrl ?? task.description}>
                {task.targetUrl ?? task.logicalId}
              </span>
            </div>
            <div className="relative min-h-[220px] flex-1 bg-gray-950">
              {isRealStream ? (
                <iframe
                  src={rawUrl}
                  title={`${agentName} – ${task.logicalId}`}
                  className="h-full min-h-[220px] w-full border-none"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                  allow="clipboard-read; clipboard-write"
                />
              ) : isExternal ? (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 p-6">
                  <Monitor className="h-10 w-10 text-amber-500/70" />
                  <p className="text-center text-sm text-gray-500">External agent — no live stream</p>
                  <p className="text-center text-xs text-gray-600">Output in Live activity below</p>
                </div>
              ) : (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 p-6">
                  <Loader2 className="h-10 w-10 animate-spin text-sky-500/70" />
                  <p className="text-center text-sm text-gray-500">Connecting to browser…</p>
                  <p className="text-center text-xs text-gray-600">Live stream will appear when the execution engine provides a URL</p>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
