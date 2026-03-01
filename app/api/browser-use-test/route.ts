import { NextResponse } from "next/server";

const BASE = "https://api.browser-use.com/api/v2";

/**
 * GET /api/browser-use-test — verify Browser Use API key and v2 endpoint.
 * Returns the resolved URL, status, and a short message so you can confirm the endpoint is correct.
 */
export async function GET() {
  const key = (process.env.BROWSER_USE_API_KEY ?? process.env.BROWSER_USE_KEY ?? "").trim();
  if (!key) {
    return NextResponse.json({
      ok: false,
      error: "BROWSER_USE_API_KEY not set",
      endpoint: `${BASE}/tasks`,
      hint: "Add BROWSER_USE_API_KEY to .env and restart the dev server.",
    });
  }

  const url = `${BASE}/tasks`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Browser-Use-API-Key": key,
      },
      body: JSON.stringify({ task: "Open https://example.com and say done" }),
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    if (res.ok) {
      const id = (body as { id?: string })?.id;
      return NextResponse.json({
        ok: true,
        endpoint: url,
        status: res.status,
        message: "Browser Use v2 API is reachable. Task created.",
        taskId: id ?? null,
      });
    }

    return NextResponse.json({
      ok: false,
      endpoint: url,
      status: res.status,
      error: (body as { detail?: string })?.detail ?? text,
      body,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      endpoint: url,
      error: message,
    });
  }
}
