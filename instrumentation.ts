/**
 * Next.js instrumentation — runs once when the Node.js runtime starts.
 * Laminar is initialized lazily on first use (see lib/observability/laminar-workflow.ts)
 * so the build does not parse @lmnr-ai/lmnr and its esbuild dependency.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Optional: other instrumentation (e.g. OpenTelemetry) can go here.
}
