import { NextResponse } from "next/server";
import { decomposeWorkflow } from "@/lib/orchestrator";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const convexUrl = () => (process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? "").trim();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = typeof body?.input === "string" ? body.input.trim() : null;
    if (!input) {
      return NextResponse.json({ error: "Missing input" }, { status: 400 });
    }

    const url = convexUrl();
    if (!url) return NextResponse.json({ error: "Convex not configured: set NEXT_PUBLIC_CONVEX_URL or CONVEX_URL in .env" }, { status: 500 });

    const workflowId = await fetchMutation(api.workflows.createWorkflow, { input }, { url }) as Id<"workflows">;
    const tasks = await decomposeWorkflow(input, workflowId);

    await fetchMutation(
      api.tasks.createTasks,
      {
        workflowId,
        tasks: tasks.map((t) => ({
          logicalId: t.id,
          description: t.description,
          targetUrl: t.targetUrl,
          dependencies: t.dependencies,
          priority: t.priority,
          requiredCapabilities: "requiredCapabilities" in t && Array.isArray((t as { requiredCapabilities?: string[] }).requiredCapabilities)
            ? (t as { requiredCapabilities: string[] }).requiredCapabilities
            : [],
        })),
      },
      { url }
    );

    return NextResponse.json({ workflowId, taskCount: tasks.length });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    const causeMessage = e.cause instanceof Error ? e.cause.message : undefined;
    const raw = causeMessage ?? e.message ?? String(err);
    const message = raw.trim() || "Workflow creation failed (check server logs and env: Convex URL, ANTHROPIC_API_KEY)";
    console.error("[POST /api/workflow]", e.message || message, e.cause ?? e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
