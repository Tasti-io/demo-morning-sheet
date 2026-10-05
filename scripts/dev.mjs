#!/usr/bin/env node
// Local preview without pulling in the Vercel CLI: serves public/ and routes
// the /api routes through the same handlers Vercel will run.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sheetHandler from "../api/sheet.js";
import costsHandler from "../api/costs.js";

import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const api = { "/api/sheet": sheetHandler, "/api/costs": costsHandler }[url.pathname];
  if (api) {
    const shim = {
      setHeader: (k, v) => res.setHeader(k, v),
      status: (c) => ({ end: (b) => { res.statusCode = c; res.end(b); } }),
    };
    return api({ query: Object.fromEntries(url.searchParams) }, shim);
  }
  const file = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\//, "");
  try {
    const body = await readFile(path.join(ROOT, "public", file));
    res.setHeader("Content-Type", TYPES[path.extname(file)] ?? "application/octet-stream");
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end("not found");
  }
}).listen(3010, () => console.log("morning sheet on http://localhost:3010"));
