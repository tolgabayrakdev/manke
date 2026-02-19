export async function processEmailJob(job) {
  const { name, email, type } = job.data;
  if (type === "welcome") {
    console.log(`[EmailWorker] Sending welcome email to ${name} <${email}>`);
    // Production: call SendGrid / Nodemailer here
  }
}
