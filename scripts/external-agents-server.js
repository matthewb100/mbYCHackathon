/**
 * Mock external agent server — two dummy agents for the Swarm marketplace.
 * Run: node scripts/external-agents-server.js
 * Then register in the UI:
 *   - http://localhost:3001/flight  (FlightDeals — travel booking)
 *   - http://localhost:3001/pet     (PetOwnerFinder — find pet sitters, pet services)
 *
 * GET  {base}         → manifest (name, capabilities, specializedDomains, pricePerTask)
 * POST {base}/bid     → confidenceScore, estimatedTimeMs, price, reasoning
 * POST {base}/execute → success, data, executionTimeMs
 */

const http = require("http");

const PORT = Number(process.env.EXTERNAL_AGENT_PORT) || 3001;

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
};

function send(res, status, data) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.writeHead(status);
  res.end(JSON.stringify(data));
}

function handleBid(agentKey, body) {
  const agent = AGENTS[agentKey];
  const desc = (body.description || "").toLowerCase();
  const target = (body.targetUrl || "").toLowerCase();
  let confidence = 0.7;
  if (agentKey === "flight" && (desc.includes("flight") || desc.includes("travel") || desc.includes("book") && desc.includes("trip") || target.includes("kayak") || target.includes("travel")))
    confidence = 0.92;
  if (agentKey === "pet" && (desc.includes("pet") || desc.includes("dog") || desc.includes("cat") || desc.includes("sitter") || desc.includes("rover") || desc.includes("wag") || target.includes("rover") || target.includes("petfinder")))
    confidence = 0.90;
  return {
    confidenceScore: confidence,
    estimatedTimeMs: 12000 + Math.floor(Math.random() * 8000),
    price: agent.pricePerTask,
    reasoning: `${agent.name} can handle this task; capabilities and domains match.`,
  };
}

function handleExecute(agentKey, body) {
  const agent = AGENTS[agentKey];
  const start = Date.now();
  return {
    success: true,
    data: {
      message: `${agent.name} completed task`,
      taskId: body.taskId,
      logicalId: body.logicalId,
      summary: (body.description || "").slice(0, 100),
    },
    executionTimeMs: Math.max(500, Date.now() - start),
  };
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.writeHead(204);
    res.end();
    return;
  }

  const u = new URL(req.url || "/", `http://localhost:${PORT}`);
  const path = u.pathname.replace(/^\/+/, "").split("/");
  const base = path[0];
  const sub = path[1];

  if (!AGENTS[base]) {
    send(res, 404, { error: "Unknown agent. Use /flight or /pet." });
    return;
  }

  if (req.method === "GET" && !sub) {
    send(res, 200, AGENTS[base]);
    return;
  }

  if (req.method === "POST" && sub === "bid") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const data = body ? JSON.parse(body) : {};
        send(res, 200, handleBid(base, data));
      } catch (e) {
        send(res, 400, { error: "Invalid JSON" });
      }
    });
    return;
  }

  if (req.method === "POST" && sub === "execute") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const data = body ? JSON.parse(body) : {};
        send(res, 200, handleExecute(base, data));
      } catch (e) {
        send(res, 400, { error: "Invalid JSON" });
      }
    });
    return;
  }

  send(res, 404, { error: "Not found. Use GET /, POST /bid, POST /execute." });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`External agent server: http://localhost:${PORT}`);
  console.log("  FlightDeals:     http://localhost:" + PORT + "/flight");
  console.log("  PetOwnerFinder:  http://localhost:" + PORT + "/pet");
});
