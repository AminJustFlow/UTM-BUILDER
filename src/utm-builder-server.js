import http from "node:http";
import { createUtmBuilderApplication } from "./support/utm-builder-app-factory.js";
import { NodeRequest } from "./http/request.js";

export async function startUtmBuilderServer(projectRoot) {
  const app = await createUtmBuilderApplication(projectRoot);
  let stopPromise = null;
  const stopApp = () => {
    stopPromise ??= app.stop();
    return stopPromise;
  };
  const server = http.createServer(async (incomingMessage, serverResponse) => {
    const request = await NodeRequest.fromIncomingMessage(incomingMessage);
    const response = await app.handle(request);
    response.send(serverResponse);
  });

  server.on("close", () => stopApp().catch(() => {}));
  await new Promise((resolve) => server.listen(app.config.app.port, resolve));
  await app.start();

  return {
    app,
    server,
    port: app.config.app.port,
    async close() {
      if (server.listening) {
        const closePromise = new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        server.closeAllConnections?.();
        await closePromise;
      }
      await stopApp();
    }
  };
}
