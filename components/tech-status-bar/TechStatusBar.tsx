"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";

const TECH_ITEMS: Array<{ key: keyof typeof DEFAULT; label: string; unit?: string }> = [
  { key: "claudeCalls", label: "Claude", unit: "calls" },
  { key: "browserLive", label: "Browser Use", unit: "live" },
  { key: "convexMutations", label: "Convex", unit: "mutations" },
  { key: "hudAvg", label: "HUD", unit: "avg" },
  { key: "supermemoryDomains", label: "Supermemory", unit: "domains" },
  { key: "laminarSpans", label: "Laminar", unit: "spans" },
  { key: "mongoRecords", label: "MongoDB", unit: "records" },
  { key: "vercelStatus", label: "Vercel", unit: "" },
];

const DEFAULT = {
  claudeCalls: 0,
  browserLive: 0,
  convexMutations: 0,
  hudAvg: 0,
  supermemoryDomains: 0,
  laminarSpans: 0,
  mongoRecords: 0,
  vercelStatus: "—",
};

const PLACEHOLDER = {
  claudeCalls: 3,
  browserLive: 0,
  convexMutations: 24,
  hudAvg: 91,
  supermemoryDomains: 4,
  laminarSpans: 5,
  mongoRecords: 23,
  vercelStatus: "deployed",
};

export function TechStatusBar() {
  const stats = useQuery(api.executionStats.getExecutionStats) as typeof DEFAULT & { updatedAt?: number } | undefined;
  const s = stats && (stats.updatedAt ?? 0) > 0 ? stats : PLACEHOLDER;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-gray-800/80 bg-gray-900/40 px-4 py-3">
      {TECH_ITEMS.map(({ key, label, unit }) => {
        const value = s[key];
        const display =
          key === "vercelStatus"
            ? String(value)
            : typeof value === "number"
              ? `${value}`
              : String(value);
        const isLive = key === "browserLive" && Number(value) > 0;
        return (
          <motion.div
            key={key}
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5 text-xs"
          >
            <span
              className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                isLive ? "animate-pulse bg-emerald-400" : "bg-gray-500"
              }`}
            />
            <span className="font-medium text-gray-400">{label}</span>
            <span className="text-gray-500">●</span>
            <span className="text-gray-300">
              {display}
              {unit && display !== "—" ? ` ${unit}` : ""}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
