export async function processReportJob(job) {
  const { userId, deletedAt } = job.data;
  console.log(`[ReportWorker] Generating deletion report for userId: ${userId}`);
  console.log(`[ReportWorker] User ${userId} was deleted at ${deletedAt}`);
  // Production: PDF/CSV oluştur, admin'e e-posta gönder veya S3'e kaydet
}
