import { access, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = process.env.HOST || "0.0.0.0";
const START_PORT = Number.parseInt(process.env.PORT || "4173", 10) || 4173;
const MAX_PORT_ATTEMPTS = 25;
const DIST_DIR = resolve(fileURLToPath(new URL("..", import.meta.url)), "dist");

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

await access(DIST_DIR);

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${HOST}`);
  const pathname = requestUrl.pathname === "/" ? "/monster-mint.html" : requestUrl.pathname;
  const filePath = resolve(DIST_DIR, `.${pathname}`);

  if (!filePath.startsWith(DIST_DIR)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const contents = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": CONTENT_TYPES[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(contents);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

const port = await listenOnFirstFreePort(server, START_PORT, MAX_PORT_ATTEMPTS);
console.log(`Serving dist/ at http://${HOST}:${port}/monster-mint.html`);

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
  });
});

function listenOnFirstFreePort(httpServer, startPort, attempts) {
  return new Promise((resolvePromise, rejectPromise) => {
    var currentPort = startPort;
    var remaining = attempts;

    function tryListen() {
      httpServer.once("error", handleError);
      httpServer.listen(currentPort, HOST, () => {
        httpServer.off("error", handleError);
        resolvePromise(currentPort);
      });
    }

    function handleError(error) {
      httpServer.off("error", handleError);
      if (error && error.code === "EADDRINUSE" && remaining > 1) {
        remaining -= 1;
        currentPort += 1;
        tryListen();
        return;
      }

      rejectPromise(error);
    }

    tryListen();
  });
}
