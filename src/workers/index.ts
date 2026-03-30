import { createDiscoveryWorker } from "./discovery.worker";
import { createResearchWorker } from "./research.worker";
import { createScoringWorker } from "./scoring.worker";
import { createApprovalPrepWorker } from "./approval-prep.worker";
import { createCopywriterWorker } from "./copywriter.worker";
import { createOutreachWorker } from "./outreach.worker";
import { createResponseWorker } from "./response.worker";
import { createHubspotSyncWorker } from "./hubspot-sync.worker";

console.log("[workers] Starting KO-SDR workers...");

const workers = [
  createDiscoveryWorker(),
  createResearchWorker(),
  createScoringWorker(),
  createApprovalPrepWorker(),
  createCopywriterWorker(),
  createOutreachWorker(),
  createResponseWorker(),
  createHubspotSyncWorker(),
];

console.log("[workers] All 8 workers started");

async function shutdown() {
  console.log("[workers] Shutting down...");
  await Promise.all(workers.map((w) => w.close()));
  console.log("[workers] All workers stopped");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
