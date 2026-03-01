"use client";

export default function BrowserPlaceholderPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-6 text-center">
      <div className="h-3 w-3 animate-pulse rounded-full bg-emerald-400 ring-4 ring-emerald-400/30" />
      <h1 className="mt-4 text-lg font-semibold text-white">Agent session active</h1>
      <p className="mt-2 max-w-sm text-sm text-gray-400">
        This agent is running in an isolated sandbox. Live stream will appear here when provided by the execution provider.
      </p>
      <p className="mt-4 text-xs text-gray-500">AgentExchange · Secure marketplace</p>
    </div>
  );
}
