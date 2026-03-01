/**
 * External agent server: mock agents for the marketplace.
 * GET /flight, /pet, /jobs → manifest
 * POST /flight/bid, /pet/bid, /jobs/bid → bid response
 * POST /flight/execute, /pet/execute, /jobs/execute → execute response
 *
 * Run: npm run external-agents
 * Port: 3001 (or EXTERNAL_AGENT_PORT)
 */

const http = require("http");

const PORT = parseInt(process.env.EXTERNAL_AGENT_PORT || "3001", 10);

const AGENTS = {
  flight: {
    name: "FlightDeals",
    capabilities: ["booking", "navigation", "checkout"],
    specializedDomains: ["google.com/travel", "kayak.com", "skyscanner.com"],
    pricePerTask: 0.11,
  },
  pet: {
    name: "PetOwnerFinder",
    capabilities: ["form-filling", "booking", "navigation", "web-search"],
    specializedDomains: ["rover.com", "wag.com", "chewy.com", "petfinder.com"],
    pricePerTask: 0.08,
  },
  jobs: {
    name: "JobScout",
    capabilities: ["data-extraction", "web-search", "form-filling", "table-parsing"],
    specializedDomains: ["linkedin.com", "indeed.com", "glassdoor.com"],
    pricePerTask: 0.09,
  },
};

// JobScout: fail once per taskId then succeed (for rebid demo)
const executedTaskIds = new Set();

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function send(res, statusCode, data, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extraHeaders,
  };
  res.writeHead(statusCode, headers);
  res.end(typeof data === "string" ? data : JSON.stringify(data));
}

function handleRequest(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    send(res, 204, "", { "Access-Control-Max-Age": "86400" });
    return;
  }
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const path = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "") || "";
  const [prefix, action] = path.split("/").filter(Boolean);

  const agentKey = prefix in AGENTS ? prefix : null;
  if (!agentKey) {
    if (req.method === "GET" && (path === "" || path === "flight" || path === "pet" || path === "jobs")) {
      const key = path || "flight";
      send(res, 200, AGENTS[key]);
      return;
    }
    send(res, 404, { error: "Not found" });
    return;
  }

  const agent = AGENTS[agentKey];

  // GET → manifest
  if (req.method === "GET" && (!action || action === "")) {
    send(res, 200, agent);
    return;
  }

  // POST /bid
  if (req.method === "POST" && action === "bid") {
    parseBody(req)
      .then(() => {
        send(res, 200, {
          confidenceScore: 0.85,
          estimatedTimeMs: 15000,
          price: agent.pricePerTask,
          reasoning: `Eligible for task. Specialized in ${agent.specializedDomains.join(", ")}.`,
        });
      })
      .catch(() => send(res, 400, { error: "Invalid JSON" }));
    return;
  }

  // POST /execute
  if (req.method === "POST" && action === "execute") {
    parseBody(req)
      .then((body) => {
        const taskId = body.taskId != null ? String(body.taskId) : null;
        const logicalId = body.logicalId != null ? String(body.logicalId) : taskId;
        const key = `${agentKey}:${taskId || logicalId || "unknown"}`;

        // JobScout: fail once per task then succeed (for rebid demo)
        let success = true;
        if (agentKey === "jobs" && key) {
          if (executedTaskIds.has(key)) {
            success = true;
          } else {
            executedTaskIds.add(key);
            success = false;
          }
        }

        const executionTimeMs = 800 + Math.floor(Math.random() * 400);
        send(res, 200, {
          success,
          data: success
            ? { summary: `Completed: ${body.description || "task"}.`, executionTimeMs }
            : { error: "Simulated failure (retry will succeed)." },
          executionTimeMs,
        });
      })
      .catch(() => send(res, 400, { error: "Invalid JSON" }));
    return;
  }

  send(res, 404, { error: "Not found" });
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`External agent server on http://localhost:${PORT}`);
  console.log("  /flight → FlightDeals (booking, navigation, checkout)");
  console.log("  /pet    → PetOwnerFinder (form-filling, booking, navigation, web-search)");
  console.log("  /jobs   → JobScout (data-extraction, web-search, form-filling, table-parsing)");
});
