import { NextResponse } from "next/server";
import { AgentCoordinator } from "@/lib/agents";

function getApiKey(): string {
  return (process.env.BROWSER_USE_API_KEY ?? process.env.BROWSER_USE_KEY ?? "").trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workflowId = body?.workflowId;
    if (!workflowId) {
      return NextResponse.json({ error: "Missing workflowId" }, { status: 400 });
    }

    const key = getApiKey();
    if (!key) {
      return NextResponse.json(
        {
          error:
            "BROWSER_USE_API_KEY is not set. Add it to .env or .env.local (e.g. BROWSER_USE_API_KEY=your_key) and restart the dev server.",
        },
        { status: 500 }
      );
    }

    const coordinator = new AgentCoordinator(key);
    await coordinator.executeApprovedWorkflow(workflowId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    const message = e.cause instanceof Error ? `${e.message}: ${e.cause.message}` : e.message;
    return NextResponse.json({ error: message || "Execution failed" }, { status: 500 });
  }
}
