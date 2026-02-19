import { Queue } from "bullmq";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
};

export const emailQueue = new Queue("email", { connection });
export const auditQueue = new Queue("audit", { connection });
export const reportQueue = new Queue("report", { connection });
