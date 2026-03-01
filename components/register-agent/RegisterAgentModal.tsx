"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Link2, CheckCircle, Download } from "lucide-react";

const CAPABILITY_OPTIONS = [
  "web-search",
  "navigation",
  "form-filling",
  "data-extraction",
  "table-parsing",
  "booking",
  "checkout",
  "authentication",
  "content-creation",
  "data-synthesis",
  "screenshot",
  "comparison",
  "monitoring",
];

interface RegisterAgentModalProps {
  open: boolean;
  onClose: () => void;
}

function isValidHttpUrl(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function RegisterAgentModal({ open, onClose }: RegisterAgentModalProps) {
  const [name, setName] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [capabilitiesInput, setCapabilitiesInput] = useState("");
  const [domainsInput, setDomainsInput] = useState("");
  const [pricePerTask, setPricePerTask] = useState("0.10");
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registerAgent = useMutation(api.agents.registerAgent);

  type Manifest = { name?: string; capabilities?: string[]; specializedDomains?: string[]; pricePerTask?: number };
  const fetchFromUrl = async () => {
    const endpoint = apiEndpoint.trim();
    if (!endpoint || !isValidHttpUrl(endpoint)) {
      setError("Enter a valid API endpoint URL first.");
      return;
    }
    setError(null);
    setFetching(true);
    try {
      const res = await fetch("/api/fetch-agent-manifest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: endpoint }),
      });
      const data = (await res.json()) as Manifest | { error?: string };
      if (!res.ok) {
        throw new Error(typeof data === "object" && data && "error" in data ? data.error : `HTTP ${res.status}`);
      }
      const manifest = data as Manifest;
      if (manifest.name) setName(manifest.name);
      if (Array.isArray(manifest.capabilities) && manifest.capabilities.length > 0)
        setCapabilitiesInput(manifest.capabilities.join(", "));
      if (Array.isArray(manifest.specializedDomains) && manifest.specializedDomains.length > 0)
        setDomainsInput(manifest.specializedDomains.join(", "));
      if (typeof manifest.pricePerTask === "number" && manifest.pricePerTask >= 0)
        setPricePerTask(String(manifest.pricePerTask.toFixed(2)));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not fetch from URL. Is the external agent server running? (e.g. npm run external-agents)"
      );
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const endpoint = apiEndpoint.trim();
    const caps = capabilitiesInput
      .split(/[\s,]+/)
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    const domains = domainsInput
      .split(/[\s,]+/)
      .map((d) => d.trim())
      .filter(Boolean);
    const price = parseFloat(pricePerTask);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!endpoint) {
      setError("API endpoint is required for external agents.");
      return;
    }
    if (!isValidHttpUrl(endpoint)) {
      setError("API endpoint must be a valid HTTP or HTTPS URL (e.g. https://api.example.com).");
      return;
    }
    if (caps.length === 0) {
      setError("Add at least one capability.");
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      setError("Price per task must be a non-negative number.");
      return;
    }
    setSubmitting(true);
    try {
      await registerAgent({
        name: name.trim(),
        apiEndpoint: endpoint.replace(/\/$/, ""),
        capabilities: caps,
        specializedDomains: domains,
        pricePerTask: price,
        isExternal: true,
      });
      setName("");
      setApiEndpoint("");
      setCapabilitiesInput("");
      setDomainsInput("");
      setPricePerTask("0.10");
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const addCapability = (cap: string) => {
    const current = capabilitiesInput.split(/[\s,]+/).filter(Boolean);
    if (current.includes(cap)) return;
    setCapabilitiesInput([...current, cap].join(", "));
  };

  return (
    <AnimatePresence>
      {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      >
        <motion.div
          role="dialog"
          aria-modal
          aria-labelledby="register-agent-title"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl outline-none flex flex-col"
        >
          <div className="flex-shrink-0 p-6 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-sky-500/20">
                  <Link2 className="h-6 w-6 text-sky-400" />
                </div>
                <div className="min-w-0">
                  <h2 id="register-agent-title" className="text-lg font-semibold text-white">
                    Register external agent
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Add any agent via API to the marketplace
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {success ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 px-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <p className="text-lg font-medium text-white">Agent registered</p>
              <p className="text-sm text-gray-500">The agent will appear in the marketplace and can bid on tasks.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
                <div>
                  <label htmlFor="agent-name" className="mb-1.5 block text-sm font-medium text-gray-400">
                    Agent name
                  </label>
                  <input
                    id="agent-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. My Custom Agent"
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>
                <div>
                  <label htmlFor="api-endpoint" className="mb-1.5 block text-sm font-medium text-gray-400">
                    API endpoint
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="api-endpoint"
                      type="url"
                      value={apiEndpoint}
                      onChange={(e) => setApiEndpoint(e.target.value)}
                      placeholder="https://api.example.com or http://localhost:3001/flight"
                      className="flex-1 min-w-0 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={fetchFromUrl}
                      disabled={fetching || !apiEndpoint.trim()}
                      className="flex-shrink-0 rounded-xl border border-sky-500/50 bg-sky-500/10 px-3 py-2.5 text-sm font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Download className="h-4 w-4" />
                      {fetching ? "…" : "Fetch"}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    Base URL of your agent. Must expose <strong>GET</strong> (manifest), <strong>POST /execute</strong> and <strong>POST /bid</strong>. Use &quot;Fetch&quot; to load name, capabilities, and price from the URL.
                  </p>
                </div>
                <div>
                  <label htmlFor="capabilities" className="mb-1.5 block text-sm font-medium text-gray-400">
                    Capabilities
                  </label>
                  <input
                    id="capabilities"
                    type="text"
                    value={capabilitiesInput}
                    onChange={(e) => setCapabilitiesInput(e.target.value)}
                    placeholder="navigation, booking, data-extraction"
                    className="mb-2 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {CAPABILITY_OPTIONS.map((cap) => (
                      <button
                        key={cap}
                        type="button"
                        onClick={() => addCapability(cap)}
                        className="rounded-full border border-gray-600 bg-gray-800/80 px-2.5 py-1 text-xs text-gray-300 transition hover:border-sky-500/50 hover:text-white"
                      >
                        + {cap}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="domains" className="mb-1.5 block text-sm font-medium text-gray-400">
                    Specialized domains
                  </label>
                  <input
                    id="domains"
                    type="text"
                    value={domainsInput}
                    onChange={(e) => setDomainsInput(e.target.value)}
                    placeholder="google.com, kayak.com"
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>
                <div>
                  <label htmlFor="price" className="mb-1.5 block text-sm font-medium text-gray-400">
                    Price per task ($)
                  </label>
                  <input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricePerTask}
                    onChange={(e) => setPricePerTask(e.target.value)}
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-white focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>
                {error && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 flex gap-3 p-6 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-gray-600 py-2.5 font-medium text-gray-300 transition hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 py-2.5 font-medium text-white transition hover:bg-sky-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                >
                  <Plus className="h-5 w-5" />
                  {submitting ? "Registering…" : "Register agent"}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
