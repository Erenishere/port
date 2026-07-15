import { disconnectPrismaClient } from "@/lib/database/prisma";
import { createWebhookNotifier } from "@/lib/sales/notifications";
import { NotificationOutboxWorker } from "@/lib/sales/outbox-worker";
import { getLeadRepository } from "@/lib/sales/repository";

const pollMs = Math.max(100, Number(process.env.LEAD_OUTBOX_POLL_MS ?? 1_000));
const worker = new NotificationOutboxWorker(
  getLeadRepository(),
  createWebhookNotifier(),
);
let stopping = false;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

while (!stopping) {
  try {
    const results = await worker.processDue();
    if (!results.length) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  } catch {
    console.error("Lead notification worker iteration failed.");
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

await disconnectPrismaClient();
