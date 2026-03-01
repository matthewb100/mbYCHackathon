/**
 * Laminar SDK integration: one trace per workflow, one span per task.
 * Non-blocking: all calls try/catch so tracing never breaks execution.
 * Laminar is initialized lazily on first use (avoids pulling esbuild into Next.js build).
 */

export type TraceIdResult = string | null;

let laminarInitialized = false;
async function ensureLaminar() {
  if (laminarInitialized) return;
  const key = process.env.LAMINAR_API_KEY ?? process.env.NEXT_PUBLIC_LAMINAR_API_KEY;
  if (typeof key !== "string" || !key.trim()) return;
  try {
    const { Laminar } = await import("@lmnr-ai/lmnr");
    Laminar.initialize({ projectApiKey: key.trim() });
    laminarInitialized = true;
  } catch {
    // skip
  }
}

/**
 * Run a workflow-level trace. Returns the trace ID after the callback completes
 * so the caller can store it in Convex for dashboard linking.
 * Non-blocking: if Laminar fails after the callback ran, we return the result without traceId.
 */
export async function runWithWorkflowTrace<T>(
  workflowId: string,
  fn: () => Promise<T>
): Promise<{ result: T; traceId: TraceIdResult }> {
  let traceId: TraceIdResult = null;
  let result: T | undefined;
  try {
    await ensureLaminar();
    const { Laminar, observe } = await import("@lmnr-ai/lmnr");
    if (!Laminar.initialized?.()) {
      result = await fn();
      return { result, traceId: null };
    }
    result = await observe(
      { name: `workflow-${workflowId}`, sessionId: String(workflowId) },
      async () => {
        const out = await fn();
        traceId = Laminar.getTraceId?.() ?? null;
        return out;
      }
    );
    if (traceId == null) traceId = Laminar.getTraceId?.() ?? null;
    return { result, traceId };
  } catch (err) {
    if (result !== undefined) return { result, traceId: null };
    throw err;
  }
}

/**
 * Run a task inside a span. Use inside the workflow trace so the span is a child.
 */
export async function runWithTaskSpan<T>(
  taskLogicalId: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    await ensureLaminar();
    const { observe } = await import("@lmnr-ai/lmnr");
    return await observe({ name: `task-${taskLogicalId}` }, fn);
  } catch {
    return await fn();
  }
}
