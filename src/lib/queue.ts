import { Queue } from "bullmq";
import { redis } from "./redis";

export const discoveryQueue = new Queue("discovery", { connection: redis });
export const researchQueue = new Queue("research", { connection: redis });
export const scoringQueue = new Queue("scoring", { connection: redis });
export const approvalPrepQueue = new Queue("approval-prep", { connection: redis });
export const copywriterQueue = new Queue("copywriter", { connection: redis });
export const outreachQueue = new Queue("outreach", { connection: redis });
export const responseClassificationQueue = new Queue("response-classification", { connection: redis });
export const hubspotSyncQueue = new Queue("hubspot-sync", { connection: redis });
