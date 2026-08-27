"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const host = process.env.SQUIGGLE_SAGE_SMOKE_HOST || "127.0.0.1";
const port = Number(process.env.SQUIGGLE_SAGE_SMOKE_PORT || 8765);
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"]
]);

function reply(response, status, body) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
}

const server = http.createServer((request, response) => {
  if (!request.url || !["GET", "HEAD"].includes(request.method)) {
    reply(response, 405, "Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname);
  } catch (_error) {
    reply(response, 400, "Invalid request path");
    return;
  }
  const relativePath = pathname.replace(/^\/+/, "") || "test/manual-smoke.html";
  const filePath = path.resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    reply(response, 403, "Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      reply(response, 404, "Not found");
      return;
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": stats.size,
      "Content-Type": contentTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream"
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(filePath).pipe(response);
  });
});

server.listen(port, host, () => {
  console.log(`SquiggleSage smoke server listening on http://${host}:${port}/`);
});
