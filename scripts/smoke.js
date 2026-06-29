import { startUtmBuilderServer } from "../src/utm-builder-server.js";

const databasePath = "storage/database/utm-builder-smoke.sqlite";
process.env.DATABASE_CLIENT = "sqlite";
process.env.DATABASE_PATH = databasePath;
process.env.PORT = "3199";
process.env.LIBRARY_AUTH_ENABLED = "false";

const instance = await startUtmBuilderServer(process.cwd());
try {
  const health = await (await fetch("http://127.0.0.1:3199/health")).json();
  const builderResponse = await fetch("http://127.0.0.1:3199/new");
  const builderHtml = await builderResponse.text();
  if (health.status !== "ok" || builderResponse.status !== 200 || !builderHtml.includes('id="builder-form"')) {
    throw new Error("Standalone UTM Builder smoke test failed.");
  }
  process.stdout.write("Standalone UTM Builder smoke test passed.\n");
} finally {
  await instance.close();
}
