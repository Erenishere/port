import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";

const defaultTestDatabaseUrl =
  "postgresql://webnexus_test:webnexus_test@127.0.0.1:5432/webnexus_test?schema=public";
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim() || defaultTestDatabaseUrl;
const databaseName = new URL(testDatabaseUrl).pathname.replace(/^\//, "").toLowerCase();

if (!databaseName.includes("test")) {
  throw new Error("TEST_DATABASE_URL must identify a dedicated database whose name contains 'test'.");
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} failed (${signal ?? code ?? "unknown"}).`));
    });
  });
}

const env: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: testDatabaseUrl,
  TEST_DATABASE_URL: testDatabaseUrl,
  WEBNEXUS_USE_IN_MEMORY_REPOSITORY: "true",
};

await run("npx", ["prisma", "migrate", "deploy"], env);
const testFiles = (await readdir("tests"))
  .filter((file) => file.endsWith(".test.ts"))
  .map((file) => `tests/${file}`)
  .sort();
await run("npx", ["tsx", "--test", ...testFiles], env);
