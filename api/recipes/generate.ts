import type { VercelRequest, VercelResponse } from "@vercel/node";
import { HttpError, executeRecipesGenerate } from "../../server/recipe-request-handlers.js";

function applyCors(res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/** Vercel：文件路由 /api/recipes/generate，不经 Express + rewrite，避免 FUNCTION_INVOCATION_FAILED */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  applyCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const recipes = await executeRecipesGenerate(req.body);
    res.status(200).json({ recipes });
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : "生成失败" });
  }
}
