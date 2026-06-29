import { fileURLToPath } from "node:url";
import path from "node:path";
import { startUtmBuilderServer } from "../src/utm-builder-server.js";

process.on("unhandledRejection", (reason) => {
  process.stderr.write(`Unhandled rejection: ${reason?.stack ?? reason}\n`);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  process.stderr.write(`Uncaught exception: ${error?.stack ?? error}\n`);
  process.exit(1);
});

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { port } = await startUtmBuilderServer(projectRoot);
process.stdout.write(`JF UTM Builder listening on port ${port}\n`);
