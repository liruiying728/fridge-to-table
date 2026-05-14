import type { GeneratedRecipe } from "@shared/types";

const NETWORK_HINT =
  "无法连接后端。请在项目根目录执行 npm run dev（会同时启动页面与 API），或单独启动 API：npm run dev:server（端口 8787），再打开开发页。";

/** 生产环境若前端与 API 不同源（如 GitHub Pages + 独立 API），构建前设置 VITE_API_BASE_URL。留空则请求相对路径 /api（与页面同源）。 */
function apiUrl(path: string): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const base = raw?.replace(/\/$/, "") ?? "";
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

/** 包装 fetch：避免浏览器只报模糊的 “Failed to fetch” */
async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(apiUrl(path), init);
  } catch (e) {
    if (e instanceof TypeError && (e.message.includes("fetch") || e.message.includes("Load failed"))) {
      throw new Error(NETWORK_HINT);
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `请求失败 ${res.status}`;
    try {
      const err = JSON.parse(text) as { error?: string };
      if (err.error) msg = err.error;
    } catch {
      const snippet = text.replace(/\s+/g, " ").trim().slice(0, 240);
      if (snippet) msg = `${msg} · ${snippet}`;
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function generateRecipesApi(body: {
  ingredientIds: string[];
  flavorIds: string[];
  difficultyId: string;
}): Promise<{ recipes: GeneratedRecipe[] }> {
  return postJson<{ recipes: GeneratedRecipe[] }>("/api/recipes/generate", body);
}

export async function simplifyRecipe(body: {
  ingredientIds: string[];
  flavorIds: string[];
  currentDifficultyId: string;
}): Promise<GeneratedRecipe> {
  return postJson<GeneratedRecipe>("/api/recipes/simplify", body);
}
