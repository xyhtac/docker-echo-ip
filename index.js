"use strict";

const http = require("node:http");
const net = require("node:net");
const { timingSafeEqual } = require("node:crypto");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8080);
const API_TOKEN = process.env.API_TOKEN || null;
const TRUST_PROXY = process.env.TRUST_PROXY === "true";

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be a valid TCP port");
}

function authorized(header) {
  // Authentication is optional.
  // If no token is configured, allow anonymous requests.
  if (!API_TOKEN) return true;

  if (!header || !header.startsWith("Bearer ")) return false;

  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(API_TOKEN);

  return supplied.length === expected.length &&
    timingSafeEqual(supplied, expected);
}

function normalizeIP(ip) {
  if (ip && ip.startsWith("::ffff:")) {
    return ip.substring(7);
  }
  return ip;
}

function detectIP(req) {
  const proxyHeader = req.headers["x-real-ip"];

  let ip = req.socket.remoteAddress || "";

  if (TRUST_PROXY && typeof proxyHeader === "string") {
    ip = proxyHeader.trim();
  }

  ip = normalizeIP(ip);

  return {
    success: net.isIP(ip) !== 0,
    ip: net.isIP(ip) !== 0 ? ip : null,
    proxy_header: typeof proxyHeader === "string"
      ? proxyHeader
      : null
  };
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET") {
    res.writeHead(404);
    return res.end("Not found\n");
  }

  if (!authorized(req.headers.authorization)) {
    res.writeHead(401, {
      "Content-Type": "text/plain",
      "WWW-Authenticate": "Bearer",
      "Cache-Control": "no-store"
    });
    return res.end("Unauthorized\n");
  }

  const result = detectIP(req);

  if (req.url === "/myip") {
    if (!result.success) {
      res.writeHead(400, {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store"
      });
      return res.end("Unable to determine client IP\n");
    }

    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });

    return res.end(result.ip + "\n");
  }

  if (req.url === "/json") {
    res.writeHead(result.success ? 200 : 400, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });

    return res.end(JSON.stringify(result, null, 2) + "\n");
  }

  res.writeHead(404);
  res.end("Not found\n");
});

server.listen(PORT, HOST, () => {
  console.log(`IP service listening on ${HOST}:${PORT}`);
  console.log("Endpoints: /myip, /json");
  console.log(`Authentication: ${API_TOKEN ? "enabled" : "disabled"}`);
});
