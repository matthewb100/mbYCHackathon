# Swarm — End-to-end test

## Prerequisites

- Convex dev running: `npx convex dev` (and configured with `NEXT_PUBLIC_CONVEX_URL`)
- Next.js dev: `npm run dev`
- `.env` (or `swarm/.env` symlink) with:
  - `NEXT_PUBLIC_CONVEX_URL`
  - `ANTHROPIC_API_KEY` (for decomposition, plan, synthesis)
  - `BROWSER_USE_API_KEY` (optional; internal agents will still bid without it, but execution will need it for Browser Use)

## Steps

1. **Seed agents**  
   Open `/dashboard`, click **Seed agents**. You should see FlightBooker, PetCare, HomeServices, DataMiner, ExternalAgent (with **External** badge and price).

2. **Create workflow**  
   Enter a prompt (e.g. “Research top 3 AI startups on Crunchbase”) and click **Execute**.  
   - Workflow is created and tasks are decomposed.  
   - **Orchestrate** runs: “Collecting bids and building plan…”.

3. **Execution plan**  
   When orchestration finishes, the **Execution plan** card appears with:
   - Reasoning, total estimated cost/time, per-task assignments (task → agent, price, time).  
   - **[Approve & Execute]** button.

4. **Approve & Execute**  
   Click **Approve & Execute**.  
   - Workflow status becomes **approved**, then **executing**.  
   - Task board: tasks move from **Planned** → **Approved** → **Executing** → **Completed** (or **Failed**).

5. **Results**  
   When execution finishes:
   - **Workflow completed** summary appears.  
   - **Synthesized result** (Claude summary of task outcomes) is shown if synthesis ran.  
   - Agent reputations are updated (HUD + completion + reliability formula).

6. **External agent**  
   ExternalAgent has empty `apiEndpoint` in seed; it will bid with fallback values but will not receive real POST /bid or /execute. To test a real external agent, register one with a mock server that implements `POST /bid` and `POST /execute`.

## API checks

- `POST /api/workflow` — creates workflow + tasks.  
- `POST /api/orchestrate` — collects bids, calls Claude for plan, sets workflow to **planned**, returns `{ plan }`.  
- `POST /api/execute` — requires workflow to be **approved**; runs `executeApprovedWorkflow` (plan-only execution, HUD, reputation, synthesis).

## Quick verification

```bash
# From swarm/
npm run build   # must pass
npx convex dev  # in one terminal
npm run dev     # in another; open http://localhost:3000/dashboard
```

Then run through steps 1–5 above.
