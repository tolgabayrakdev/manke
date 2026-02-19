export async function processAuditJob(job) {
  const { action, userId, payload, performedAt } = job.data;
  console.log(`[AuditWorker] ${action.toUpperCase()} | userId: ${userId} | at: ${performedAt}`);
  if (payload) {
    console.log(`[AuditWorker] Payload:`, JSON.stringify(payload));
  }
  // Production: audit_logs tablosuna yaz veya Datadog/ELK gibi log servisine gönder
}
