import "./load-env.js";
import path from "path";
import cors from "cors";
import express from "express";
import type { NextFunction } from "express";
import { HttpError, executeRecipesGenerate, executeRecipesSimplify } from "./recipe-request-handlers.js";
import { paths } from "./paths.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.post("/api/recipes/generate", async (req, res) => {
  try {
    const recipes = await executeRecipesGenerate(req.body);
    res.json({ recipes });
  } catch (e) {
    console.error(e);
    if (e instanceof HttpError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    res.status(500).json({ error: e instanceof Error ? e.message : "生成失败" });
  }
});

app.post("/api/recipes/simplify", async (req, res) => {
  try {
    const recipe = await executeRecipesSimplify(req.body);
    res.json(recipe);
  } catch (e) {
    console.error(e);
    if (e instanceof HttpError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    res.status(500).json({ error: e instanceof Error ? e.message : "生成失败" });
  }
});

/**
 * 自托管生产：Express 托管 dist。Vercel 上静态页由 CDN 出 dist，见
 * https://vercel.com/guides/using-express-with-vercel#serving-static-assets
 */
if (process.env.NODE_ENV === "production" && process.env.VERCEL !== "1") {
  app.use(express.static(paths.dist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(paths.dist, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: NextFunction) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({ error: err instanceof Error ? err.message : "服务器错误" });
});

export { app };
