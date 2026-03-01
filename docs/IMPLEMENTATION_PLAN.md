# Swarm — Implementation Plan (Full System Description)

## Current vs Target Flow

| Step | Current | Target (from Full System Description) |
|------|---------|--------------------------------------|
| 1 | User submits → decompose → create workflow + tasks | Same |
| 2 | Coordinator does bidding internally, selects winner by score | Orchestrator broadcasts to **all** eligible agents (internal + external); each submits bid with **price**; bids stored in Convex |
| 3 | Winner accepted immediately, no plan | **One Claude call**: user request + marketplace agents + all bids → **optimal execution plan** (who wins each task, cost, reasoning) |
| 4 | Execute immediately | **User sees plan** → **Approves** → then Execute |
| 5 | Execute with Browser Use only | Execute: internal agents via Browser Use; **external** agents via **POST their /execute** |
| 6 | No reputation update after task | **HUD** evaluates → **reputation formula** (completion 40% + HUD quality 40% + reliability 20%) → **real-time update in Convex** |
| 7 | No synthesis | **Synthesis task**: Claude compiles all results into summary after execution |

## Implementation Steps

### Phase 1: Schema & types
- [ ] **1.1** Convex: add `executionPlanJson`, `totalEstimatedCost`, `totalEstimatedTime` to workflows; add status `"planned" | "approved"`.
- [ ] **1.2** Convex: add `pricePerTask` (number), `isExternal` (boolean), `apiEndpoint` (optional string) to agents.
- [ ] **1.3** Convex: add `price` (number) to bids.
- [ ] **1.4** Convex: add task statuses `"planned" | "approved"` (keep existing).
- [ ] **1.5** TypeScript types: add `price` to Bid; add `pricePerTask`, `isExternal`, `apiEndpoint?` to Agent; add ExecutionPlan type.

### Phase 2: Orchestrator — plan from marketplace + bids
- [ ] **2.1** New Convex mutation: `setExecutionPlan(workflowId, plan)` and `approveWorkflow(workflowId)`.
- [ ] **2.2** New lib: `createExecutionPlan(workflowId)` — fetch agents, tasks, bids from Convex; one Claude call with system prompt (reputation 40%, confidence 30%, price 15%, speed 15%); return plan; write to workflow + assign tasks.
- [ ] **2.3** API: `POST /api/orchestrate` — collect bids (internal + external), then call `createExecutionPlan`, store plan, set status `"planned"`, return plan.

### Phase 3: Bidding with price and external agents
- [ ] **3.1** Internal agents: add `price` to bid (from agent.pricePerTask); store in Convex.
- [ ] **3.2** External agents: call `POST {apiEndpoint}/bid` with task; parse response (confidenceScore, estimatedTimeMs, price, reasoning); store bid in Convex with agentId.
- [ ] **3.3** Convex: `submitBid` accepts `price`; seed agents get `pricePerTask`, `isExternal: false`, `apiEndpoint` null.

### Phase 4: Reputation system
- [ ] **4.1** New agents start at reputation **50**.
- [ ] **4.2** After each task: **HUD** evaluate → get quality 0–100; compute **reliability** (actualTime <= estimatedTime ? 100 : decay); **task_score** = completion*0.4 + hud_quality*0.4 + reliability*0.2; **new_reputation** = old*0.8 + task_score*0.2. Convex mutation `updateAgentReputationFromTask(agentId, taskScore)`.

### Phase 5: Execution uses plan only (no re-bidding)
- [ ] **5.1** Coordinator: when executing, **do not** bid again; read `assignedAgentId` from each task (set from plan); internal agent → Browser Use; **external** agent → `POST {apiEndpoint}/execute` with task + context.
- [ ] **5.2** After each task complete: call HUD, compute task_score, update reputation (Phase 4).

### Phase 6: Result synthesis
- [ ] **6.1** When all tasks complete: call Claude with user input + all task results → compile summary (flight, dog sitter, security guard, total cost, etc.); store in workflow or return to frontend; show in results panel.

### Phase 7: UI
- [ ] **7.1** Execution Plan card: show plan (task → agent, rep, cost, est time), total cost/time, reasoning; **[Approve & Execute]** and **[Modify Plan]**.
- [ ] **7.2** Task board columns: Pending → Bidding → **Planned** → **Approved** → Executing → Completed.
- [ ] **7.3** Agent panel: show **price** per agent, **External** badge when `isExternal`, reputation with formula.
- [ ] **7.4** Register External Agent modal: name, API endpoint, capabilities, domains, price; Convex mutation `registerExternalAgent`.

### Phase 8: Seed agents (match doc)
- [ ] **8.1** Seed: FlightBooker (rep 92, booking, checkout, google.com/travel, kayak.com, $0.12), PetCare (88, rover, wag, $0.08), HomeServices (85, thumbtack, taskrabbit, $0.10), DataMiner (94, crunchbase, linkedin, $0.10), one External (rep 50, $0.07).

### Phase 9: End-to-end test
- [ ] **9.1** Submit workflow → verify bidding → plan appears → approve → execution → reputation updates → synthesis shown.
- [ ] **9.2** Optional: register external agent (mock endpoint) and see it bid.

---

## API Flow Summary

1. **POST /api/workflow** `{ input }` → create workflow + tasks (status `"bidding"`), return `{ workflowId, taskCount }`.
2. **POST /api/orchestrate** `{ workflowId }` → collect bids (internal + external), Claude create plan, store plan, set status `"planned"`, return `{ plan }`.
3. Frontend shows plan card; user clicks **Approve & Execute**.
4. **POST /api/execute** `{ workflowId }` → set status `"executing"`, run execution (from plan only), HUD + reputation after each task, synthesis at end.

## Differentiation (from doc)

- **vs OpenClaw:** Many agents + marketplace + bidding; OpenClaw is one agent with tools.
- **vs CrewAI/AutoGen:** Browser agents on live sites, parallel execution, sandboxing, real-time reputation.
- **Unique:** Open marketplace (any LLM), competitive bidding, real-time reputation, human-in-the-loop approval, self-improving feedback loop.
