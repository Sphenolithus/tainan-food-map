"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const host = "127.0.0.1";
const port = 8765;
const root = __dirname;
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const server = http.createServer((request, response) => {
  const urlPath = decodeURIComponent((request.url || "/").split("?")[0]);
  const relativePath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const filePath = path.resolve(root, relativePath);

  if (!filePath.startsWith(root + path.sep)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found");
      return;
    }
    response.setHeader("Content-Type", mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream");
    response.end(contents);
  });
});

server.on("error", (error) => {
  console.error(`無法啟動美食地圖：${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  const url = `http://${host}:${port}/`;
  console.log(`美食地圖已啟動：${url}`);
  console.log("請保留這個視窗；按 Ctrl+C 或關閉視窗即可停止。\n");
  if (process.platform === "win32" && process.env.FOOD_MAP_NO_OPEN !== "1") {
    execFile("cmd.exe", ["/c", "start", "", url], { windowsHide: true });
  }
});
