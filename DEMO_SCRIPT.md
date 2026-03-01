# Demo script (Phase 7)

## Perfect demo workflow

**Input (paste into Command bar):**

```
Research the top 3 Y Combinator AI companies from the latest batch, find their websites and pricing, and create a comparison
```

This should decompose into:

1. **Task 1** — Search for YC latest batch AI companies (e.g. Google)
2. **Tasks 2–4** — Visit each company’s website, find pricing (run in parallel)
3. **Task 5** — Compile comparison (depends on 2–4)

## Beats to hit (60–90 seconds)

1. User types → decomposition runs → tasks appear on the board  
2. Five tasks show in Pending/Bidding columns  
3. Agents bid on task 1 (e.g. WebScout wins)  
4. Task 1 runs and completes  
5. Tasks 2–4 unlock together → three agents bid in parallel  
6. Three “browser” activity lines in Live Feed  
7. Those tasks complete → task 5 unlocks  
8. ContentBot (or similar) runs task 5  
9. Results summary appears  

## Setup before demo

1. `npx convex dev` — create/link Convex project, get `NEXT_PUBLIC_CONVEX_URL`
2. Copy `.env.example` to `.env.local`, set:
   - `ANTHROPIC_API_KEY`
   - `CONVEX_URL` / `NEXT_PUBLIC_CONVEX_URL`
   - `BROWSER_USE_API_KEY` (optional; without it execution will fail but orchestration + UI still demo)
3. Open `/dashboard`, click **Seed agents**
4. Run the demo input above and narrate as tasks and bids update

## Contingency

- **Browser Use failing** — Keep orchestration + Convex real-time updates; mock execution if needed  
- **Daytona** — Omit sandboxing; describe it as supported in the architecture  
- **HUD slow** — Use local scoring or a screenshot of HUD in the deck  
- **Laminar** — If tracing breaks, show Laminar dashboard in a screenshot  

Core demo: real-time Convex task board + parallel agent coordination. Protect that flow first.
