"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useState } from "react";

export function AgentPanel() {
  const agents = useQuery(api.agents.getAllAgents, {}) as Array<{
    _id: string;
    name: string;
    capabilities: string[];
    reputationScore: number;
    reputationScorePrev?: number;
    currentLoad: number;
    maxConcurrency: number;
    isOnline: boolean;
    pricePerTask?: number;
    isExternal?: boolean;
    tasksCompleted?: number;
    earnings?: number;
    lastLearnedDomain?: string;
  }> | undefined;

  const removeAgent = useMutation(api.agents.removeAgent);
  const [removingId, setRemovingId] = useState<Id<"agents"> | null>(null);

  const handleRemove = async (agentId: Id<"agents">, agentName: string) => {
    if (!confirm(`Remove "${agentName}" from the marketplace? They will no longer receive tasks.`)) return;
    setRemovingId(agentId);
    try {
      await removeAgent({ agentId });
    } finally {
      setRemovingId(null);
    }
  };

  if (!agents?.length) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-gray-800 bg-gray-900/50 p-6 text-gray-500">
        No agents. Seed agents from dashboard.
      </div>
    );
  }

  const sorted = [...agents].sort((a, b) => b.reputationScore - a.reputationScore);

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-400">Agents</span>
        <span className="text-xs text-gray-500">Cost per task</span>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        {sorted.map((agent, i) => (
          <motion.div
            key={agent._id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-3"
          >
            <div className="relative">
              <div
                className="h-10 w-10 rounded-full bg-emerald-600/80 flex items-center justify-center text-white font-semibold"
                style={{ backgroundColor: `hsl(${(agent.reputationScore / 100) * 120}, 60%, 40%)` }}
              >
                {agent.name.charAt(0)}
              </div>
              {agent.isOnline && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-gray-900" />
              )}
              {agent.isExternal && (
                <span className="absolute -bottom-0.5 -right-0.5 rounded bg-amber-600 px-1 text-[9px] font-medium text-white">
                  External
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white">{agent.name}</p>
              <p className="text-xs text-amber-400/90">
                ${(agent.pricePerTask ?? 0.1).toFixed(2)}/task
              </p>
              <p className="text-xs text-emerald-400/90">
                {(agent.tasksCompleted ?? 0)} tasks · ${(agent.earnings ?? 0).toFixed(2)} earned
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {agent.capabilities.slice(0, 3).map((c) => (
                  <span
                    key={c}
                    className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-300"
                  >
                    {c}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="h-1.5 flex-1 max-w-[80px] overflow-hidden rounded-full bg-gray-700">
                  <motion.div
                    className="h-full rounded-full bg-emerald-500"
                    initial={false}
                    animate={{ width: `${agent.reputationScore}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-xs text-gray-500">
                  {agent.reputationScorePrev != null && agent.reputationScorePrev !== agent.reputationScore ? (
                    <span className="text-gray-400">
                      <span className={agent.reputationScore > agent.reputationScorePrev ? "text-emerald-400" : "text-amber-400/90"}>
                        {agent.reputationScorePrev} → {agent.reputationScore}
                      </span>
                    </span>
                  ) : (
                    agent.reputationScore
                  )}
                </span>
                <span className="text-xs text-gray-500">
                  {agent.currentLoad}/{agent.maxConcurrency}
                </span>
              </div>
              {agent.lastLearnedDomain && (
                <p className="mt-1 text-[10px] text-sky-400/90">Learned: {agent.lastLearnedDomain}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleRemove(agent._id as Id<"agents">, agent.name)}
              disabled={removingId === agent._id}
              title="Remove from marketplace"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
              aria-label={`Remove ${agent.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
