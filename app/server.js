import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { listLayers, listScenarios, run, matrix } from "./prod.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");
const PORT = process.env.PORT ?? 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": type });
  res.end(body);
}
const json = (res, data) => send(res, 200, JSON.stringify(data));

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const path = url.pathname;

  if (path === "/health") return send(res, 200, "ok", "text/plain");
  if (path === "/api/layers") return json(res, listLayers());
  if (path === "/api/scenarios") return json(res, listScenarios());
  if (path === "/api/run") {
    const enabled = (url.searchParams.get("enabled") ?? "").split(",").filter(Boolean);
    const out = run(url.searchParams.get("scenario") ?? "", enabled.length ? enabled : null);
    if (!out) return send(res, 404, JSON.stringify({ error: "unknown scenario" }));
    return json(res, out);
  }
  if (path === "/api/matrix") return json(res, matrix());

  if (path === "/app/prod.mjs") {
    const body = await readFile(join(__dirname, "prod.mjs"), "utf8");
    return send(res, 200, body, MIME[".mjs"]);
  }

  let filePath = join(PUBLIC_DIR, path === "/" ? "index.html" : path);
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, "forbidden", "text/plain");
  filePath = normalize(filePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, "forbidden", "text/plain");

  try {
    const body = await readFile(filePath);
    send(res, 200, body, MIME[extname(filePath)] ?? "application/octet-stream");
  } catch {
    send(res, 404, "not found", "text/plain");
  }
});

server.listen(PORT, () => {
  console.log(`demo listening on http://localhost:${PORT}`);
});
