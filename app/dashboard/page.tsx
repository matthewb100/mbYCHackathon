"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CommandInput } from "@/components/command-input/CommandInput";
import { TaskBoard } from "@/components/task-board/TaskBoard";
import { AgentPanel } from "@/components/agent-panel/AgentPanel";
import { BrowserFeed } from "@/components/browser-view/BrowserFeed";
import { LiveBrowserGrid } from "@/components/browser-view/LiveBrowserGrid";
import { ResultsSummary } from "@/components/results/ResultsSummary";
import { ExecutionPlanCard } from "@/components/execution-plan/ExecutionPlanCard";
import { RegisterAgentModal } from "@/components/register-agent/RegisterAgentModal";
import { TechStatusBar } from "@/components/tech-status-bar/TechStatusBar";
import type { ExecutionPlan } from "@/types";
import { Zap, LayoutGrid, Users, Activity, Monitor, Plus } from "lucide-react";

const TECH_STACK = [
  "Anthropic",
  "Convex",
  "Browser Use",
  "Laminar",
  "HUD",
  "Next.js",
  "React",
  "TypeScript",
  "Framer Motion",
];

export default function DashboardPage() {
  const [workflowId, setWorkflowId] = useState<Id<"workflows"> | null>(null);
  const [workflowMeta, setWorkflowMeta] = useState<{
    input: string;
    taskCount: number;
    createdAt?: number;
    completedAt?: number;
  } | null>(null);
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const seedAgents = useMutation(api.agents.seedAgentsMutation);
  const approveWorkflow = useMutation(api.workflows.approveWorkflow);

  const workflow = useQuery(
    api.workflows.getWorkflow,
    workflowId ? { workflowId } : "skip"
  ) as { status: string; input: string; completedAt?: number; synthesizedResult?: string } | null | undefined;

  const handleExecute = async (input: string) => {
    const res = await fetch("/api/workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
    });
    const body = await res.json().catch(() => ({}));
    const errMessage =
      !res.ok && typeof body?.error === "string" && body.error.trim()
        ? body.error.trim()
        : !res.ok
          ? `Request failed (${res.status})`
          : null;
    if (!res.ok) {
      throw new Error(errMessage ?? "Failed to create workflow");
    }
    const data = body as { workflowId: Id<"workflows">; taskCount: number };
    if (!data.workflowId) {
      throw new Error("No workflowId in response");
    }
    setWorkflowId(data.workflowId);
    setWorkflowMeta({ input, taskCount: data.taskCount, createdAt: Date.now() });
    setPlan(null);
    setShowResults(false);

    setIsOrchestrating(true);
    try {
      const orchRes = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId: data.workflowId }),
      });
      if (!orchRes.ok) {
        const err = await orchRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Orchestration failed");
      }
      const orchData = (await orchRes.json()) as { plan: ExecutionPlan };
      setPlan(orchData.plan);
    } finally {
      setIsOrchestrating(false);
    }
  };

  const handleApproveAndExecute = async () => {
    if (!workflowId) return;
    setIsExecuting(true);
    try {
      await approveWorkflow({ workflowId });
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Execution failed");
      }
      setShowResults(true);
    } finally {
      setIsExecuting(false);
    }
  };

  const isRunning = workflow?.status === "executing" || isExecuting;
  const [registerModalOpen, setRegisterModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0d] text-gray-100">
      <RegisterAgentModal open={registerModalOpen} onClose={() => setRegisterModalOpen(false)} />
      <div
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:56px_56px]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/25">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">AgentExchange</h1>
              <p className="text-xs text-gray-500 sm:text-sm">Marketplace for all agents — parallel execution, self-improving</p>
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            {isRunning && (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                Executing…
              </span>
            )}
            <motion.button
              type="button"
              onClick={() => setRegisterModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-sky-500/50 bg-sky-500/10 px-4 py-2.5 text-sm font-medium text-sky-300 transition hover:border-sky-500/70 hover:bg-sky-500/20"
            >
              <Plus className="h-4 w-4" />
              Register agent
            </motion.button>
            <motion.button
              type="button"
              onClick={() => seedAgents({})}
              className="rounded-xl border border-gray-600 bg-gray-800/80 px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:border-gray-500 hover:bg-gray-700/80 hover:text-white"
            >
              Seed agents
            </motion.button>
          </div>
        </header>

        {/* Live agent browsers — parallel execution */}
        {workflowId && (
          <motion.section
            className="mb-8 w-full overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5 flex-shrink-0 text-emerald-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                  Parallel agent execution — live browsers
                </h2>
              </div>
              <span className="text-xs text-gray-500">Agents working together in real time</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60 shadow-xl">
              <LiveBrowserGrid workflowId={workflowId} />
            </div>
          </motion.section>
        )}

        {/* Main grid: 2 columns on lg, single column on small screens */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Workflow command */}
          <motion.section
            className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60 shadow-xl backdrop-blur"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex-shrink-0 border-b border-gray-800/80 px-6 py-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 flex-shrink-0 text-sky-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Workflow command</h2>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-6 pt-4">
              <CommandInput onExecute={handleExecute} disabled={isOrchestrating} />
              {isOrchestrating && (
                <p className="mt-3 text-sm text-amber-400">Collecting bids and building plan…</p>
              )}
              {plan && workflow?.status === "planned" && (
                <div className="mt-5">
                  <ExecutionPlanCard
                    plan={plan}
                    workflowId={workflowId!}
                    onApproveAndExecute={handleApproveAndExecute}
                    isExecuting={isExecuting}
                  />
                </div>
              )}
              {showResults && workflowMeta && (
                <div className="mt-5">
                  <ResultsSummary
                    workflowId={workflowId}
                    input={workflowMeta.input}
                    taskCount={workflowMeta.taskCount}
                    completedAt={workflow?.completedAt ?? workflowMeta.completedAt}
                    createdAt={workflowMeta.createdAt}
                    synthesizedResult={workflow?.synthesizedResult}
                    laminarTraceId={workflow?.laminarTraceId}
                    onClose={() => setShowResults(false)}
                  />
                </div>
              )}
            </div>
          </motion.section>

          {/* Task board */}
          <motion.section
            className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60 shadow-xl backdrop-blur"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            <div className="flex-shrink-0 border-b border-gray-800/80 px-6 py-4">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 flex-shrink-0 text-sky-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Task board</h2>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-6 pt-4">
              <TaskBoard workflowId={workflowId} />
            </div>
          </motion.section>

          {/* Agent marketplace */}
          <motion.section
            className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60 shadow-xl backdrop-blur"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <div className="flex-shrink-0 border-b border-gray-800/80 px-6 py-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 flex-shrink-0 text-sky-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Agent marketplace</h2>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-6 pt-4">
              <AgentPanel />
            </div>
          </motion.section>

          {/* Live activity */}
          <motion.section
            className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60 shadow-xl backdrop-blur"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <div className="flex-shrink-0 border-b border-gray-800/80 px-6 py-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 flex-shrink-0 text-sky-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Live activity</h2>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-6 pt-4">
              <BrowserFeed workflowId={workflowId} />
            </div>
          </motion.section>
        </div>

        {/* Live tech status row */}
        <div className="mt-10 w-full overflow-hidden">
          <TechStatusBar />
        </div>

        {/* Tech stack strip */}
        <footer className="mt-6 border-t border-gray-800/80 px-4 py-6">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-gray-600">
            Powered by
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {TECH_STACK.map((tech) => (
              <span
                key={tech}
                className="text-xs text-gray-500 transition hover:text-gray-400"
              >
                {tech}
              </span>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
