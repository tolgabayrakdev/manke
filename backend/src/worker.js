import dotenv from "dotenv";
dotenv.config();
import { Worker } from "bullmq";
import { processEmailJob } from "./jobs/processors/email.js";
import { processAuditJob } from "./jobs/processors/audit.js";
import { processReportJob } from "./jobs/processors/report.js";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
};

function createWorker(queueName, processor) {
  const worker = new Worker(queueName, processor, { connection });
  worker.on("completed", (job) => console.log(`[${queueName}Worker] Job ${job.id} completed`));
  worker.on("failed", (job, err) => console.error(`[${queueName}Worker] Job ${job.id} failed:`, err.message));
  return worker;
}

createWorker("email", processEmailJob);
createWorker("audit", processAuditJob);
createWorker("report", processReportJob);

console.log("[Worker] All workers started...");
