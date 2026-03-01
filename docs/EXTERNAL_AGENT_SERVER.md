# External agent server (dummy agents)

Three mock external agents run on localhost so you can add them to the marketplace and see them bid and execute.

## Run the server

From the project root:

```bash
npm run external-agents
```

Server listens on **port 3001** (override with `EXTERNAL_AGENT_PORT`).

## Agent URLs

| Agent            | Base URL                      | Capabilities                                    | Price/task |
|------------------|-------------------------------|--------------------------------------------------|------------|
| **FlightDeals**  | http://localhost:3001/flight  | booking, navigation, checkout                    | $0.11      |
| **PetOwnerFinder** | http://localhost:3001/pet  | form-filling, booking, navigation, web-search    | $0.08      |
| **JobScout**     | http://localhost:3001/jobs    | data-extraction, web-search, form-filling, table-parsing | $0.09  |

## Add to the marketplace

1. Start the external agent server: `npm run external-agents`
2. Open the dashboard and click **Register agent**
3. Enter the API endpoint, e.g. `http://localhost:3001/flight`
4. Click **Fetch** to load name, capabilities, domains, and price from the URL
5. Click **Register agent**

Repeat for `http://localhost:3001/pet` and `http://localhost:3001/jobs` to add the other agents. Then run a workflow; all agents can bid and get delegated tasks. Execution is mocked (returns success + summary).

## API contract

Each agent base URL must support:

- **GET** `{base}` — returns manifest: `{ name, capabilities[], specializedDomains[], pricePerTask }`
- **POST** `{base}/bid` — body: `{ taskId, description, targetUrl }` → `{ confidenceScore, estimatedTimeMs, price, reasoning }`
- **POST** `{base}/execute` — body: `{ taskId, logicalId, description, targetUrl, context }` → `{ success, data, executionTimeMs, liveUrl? }`

  **Optional:** `liveUrl` (or `live_url` / `streamUrl`) — if your agent exposes a live or replay stream (e.g. from a browser session), return it here. The dashboard will show it in the same “Live browser view” grid as internal browser agents.
