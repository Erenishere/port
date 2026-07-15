import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

type PrismaGlobal = typeof globalThis & {
  webnexusPrisma?: PrismaClient;
  webnexusPrismaUrl?: string;
};

function requiredDatabaseUrl() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for durable lead persistence.");
  }
  return connectionString;
}

export function createPrismaClient(connectionString = requiredDatabaseUrl()) {
  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    max: 10,
  });
  return new PrismaClient({ adapter });
}

export function getPrismaClient() {
  const connectionString = requiredDatabaseUrl();
  const shared = globalThis as PrismaGlobal;
  if (!shared.webnexusPrisma || shared.webnexusPrismaUrl !== connectionString) {
    shared.webnexusPrisma = createPrismaClient(connectionString);
    shared.webnexusPrismaUrl = connectionString;
  }
  return shared.webnexusPrisma;
}

export async function disconnectPrismaClient() {
  const shared = globalThis as PrismaGlobal;
  if (!shared.webnexusPrisma) return;
  await shared.webnexusPrisma.$disconnect();
  delete shared.webnexusPrisma;
  delete shared.webnexusPrismaUrl;
}
