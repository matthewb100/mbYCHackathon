"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";

export function AgentPanel() {
  const agents = useQuery(api.agents.getAllAgents, {}) as Array<{
    _id: string;
    name: string;
    capabilities: string[];
    reputationScore: number;
    currentLoad: number;
    maxConcurrency: number;
    isOnline: boolean;
    pricePerTask?: number;
    isExternal?: boolean;
  }> | undefined;

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
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 max-w-[80px] overflow-hidden rounded-full bg-gray-700">
                  <motion.div
                    className="h-full rounded-full bg-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${agent.reputationScore}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-xs text-gray-500">{agent.reputationScore}</span>
                <span className="text-xs text-gray-500">
                  {agent.currentLoad}/{agent.maxConcurrency}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
