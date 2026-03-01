/**
 * Laminar observability tracing for multi-agent workflows.
 * Non-blocking: all calls wrapped in try/catch, failures ignored.
 */

import type { Task, TaskResult } from "@/types";

export interface TraceContext {
  traceId: string;
  workflowId: string;
  startedAt: number;
}

export interface SpanContext {
  spanId: string;
  taskId: string;
  traceId: string;
}

const DEFAULT_BASE = "https://api.laminar.sh/v1";

export class WorkflowTracer {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey ?? process.env.LAMINAR_API_KEY ?? "";
    this.baseUrl = baseUrl ?? process.env.LAMINAR_API_URL ?? DEFAULT_BASE;
  }

  async startWorkflowTrace(workflowId: string, input: string): Promise<TraceContext> {
    const traceId = `trace-${workflowId}-${Date.now()}`;
    if (!this.apiKey) return { traceId, workflowId, startedAt: Date.now() };
    try {
      await fetch(`${this.baseUrl}/traces`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ traceId, workflowId, input, startedAt: Date.now() }),
      });
    } catch {
      // ignore
    }
    return { traceId, workflowId, startedAt: Date.now() };
  }

  async startTaskSpan(traceContext: TraceContext, task: Task): Promise<SpanContext> {
    const spanId = `span-${task.id}-${Date.now()}`;
    if (!this.apiKey) return { spanId, taskId: task.id, traceId: traceContext.traceId };
    try {
      await fetch(`${this.baseUrl}/traces/${traceContext.traceId}/spans`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ spanId, taskId: task.id, description: task.description, targetUrl: task.targetUrl }),
      });
    } catch {
      // ignore
    }
    return { spanId, taskId: task.id, traceId: traceContext.traceId };
  }

  async logAgentAction(spanContext: SpanContext, action: string, details?: unknown): Promise<void> {
    if (!this.apiKey) return;
    try {
      await fetch(`${this.baseUrl}/traces/${spanContext.traceId}/spans/${spanContext.spanId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ action, details, timestamp: Date.now() }),
      });
    } catch {
      // ignore
    }
  }

  async endTaskSpan(spanContext: SpanContext, result: TaskResult): Promise<void> {
    if (!this.apiKey) return;
    try {
      await fetch(`${this.baseUrl}/traces/${spanContext.traceId}/spans/${spanContext.spanId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ success: result.success, executionTimeMs: result.executionTimeMs }),
      });
    } catch {
      // ignore
    }
  }

  async endWorkflowTrace(traceContext: TraceContext, status: string): Promise<void> {
    if (!this.apiKey) return;
    try {
      await fetch(`${this.baseUrl}/traces/${traceContext.traceId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ status, completedAt: Date.now() }),
      });
    } catch {
      // ignore
    }
  }
}
