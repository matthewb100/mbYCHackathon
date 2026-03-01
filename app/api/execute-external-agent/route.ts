import { NextResponse } from "next/server";

/**
 * External agents are executed via this proxy so they run in isolated Daytona sandboxes.
 * The platform never exposes itself to the agent; all calls originate from our server.
 * In production, this route runs inside a Daytona sandbox so a malicious agent cannot compromise the platform.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { taskId, logicalId, description, targetUrl, context, apiEndpoint } = body ?? {};
    if (!apiEndpoint || typeof apiEndpoint !== "string") {
      return NextResponse.json({ error: "Missing apiEndpoint" }, { status: 400 });
    }
    const base = apiEndpoint.replace(/\/$/, "");
    const res = await fetch(`${base}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId,
        logicalId,
        description,
        targetUrl: targetUrl ?? null,
        context: context ?? {},
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: unknown;
      executionTimeMs?: number;
      liveUrl?: string;
      live_url?: string;
      streamUrl?: string;
    };
    const liveUrl =
      data.liveUrl ?? data.live_url ?? (data as { streamUrl?: string }).streamUrl ?? undefined;
    return NextResponse.json({
      success: data.success ?? res.ok,
      data: data.data ?? {},
      executionTimeMs: data.executionTimeMs ?? 0,
      liveUrl: liveUrl || undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, data: { error: message }, executionTimeMs: 0 },
      { status: 500 }
    );
  }
}
