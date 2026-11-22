import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { POST } from "./src/server/youtubeRoute";

function youtubeApi(): Plugin {
  return {
    name: "youtube-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split("?")[0];
        if (path !== "/api/youtube") {
          next();
          return;
        }
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          const response = await POST(
            new Request("http://127.0.0.1/api/youtube", {
              method: req.method,
              headers: { "content-type": String(req.headers["content-type"] ?? "application/json") },
              body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks),
            }),
          );
          const bytes = Buffer.from(await response.arrayBuffer());
          res.statusCode = response.status;
          const type = response.headers.get("content-type");
          if (type) res.setHeader("content-type", type);
          res.setHeader("cache-control", "no-store");
          res.end(bytes);
        } catch {
          res.statusCode = 502;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: "Ссылка не открылась. Ролик может быть закрыт или недоступен." }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), youtubeApi()],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
