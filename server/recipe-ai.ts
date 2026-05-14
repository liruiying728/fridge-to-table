import fs from "fs/promises";
import { nanoid } from "nanoid";
import "./load-env.js";
import { aiOutboundFetch, outboundProxyUrl, stripJsonFence } from "./ai-fetch.js";
import type {
  AppConfig,
  DifficultyId,
  DifficultyOption,
  FlavorItem,
  GeneratedRecipe,
  IngredientItem,
} from "../shared/types";
import { paths } from "./paths.js";
import { loadAppConfig } from "./store.js";

function recipeApiKey(): string {
  return (
    process.env.OHMYGPT_RECIPE_API_KEY?.trim() ||
    process.env.OHMYGPT_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    ""
  );
}

/** 由简到难，用于「降低一档」 */
const DIFFICULTY_ORDER: DifficultyId[] = ["quick", "home", "pro"];

export function stepDownDifficulty(
  current: DifficultyId,
  all: DifficultyOption[]
): { difficulty: DifficultyOption; loweredTier: boolean; previousLabel: string } {
  const prev =
    all.find((d) => d.id === current) ?? all.find((d) => d.id === "home") ?? all[0];
  let idx = DIFFICULTY_ORDER.indexOf(current);
  if (idx < 0) idx = DIFFICULTY_ORDER.indexOf("home");
  if (idx < 0) idx = 0;
  if (idx <= 0) {
    const q = all.find((d) => d.id === "quick") ?? all[0];
    return { difficulty: q, loweredTier: false, previousLabel: prev.label };
  }
  const nextId = DIFFICULTY_ORDER[idx - 1]!;
  const next = all.find((d) => d.id === nextId) ?? all[0];
  return { difficulty: next, loweredTier: true, previousLabel: prev.label };
}

/** 一次生成几道菜：多种食材时多方案，单种时一道 */
export function targetRecipeCount(selectedLen: number): number {
  if (selectedLen <= 1) return 1;
  return Math.min(4, Math.max(2, Math.round(selectedLen / 2)));
}

function ingredientIdListBlock(selected: IngredientItem[]): string {
  return selected.map((s) => `- id: \`${s.id}\` · ${s.name}${s.emoji ? ` ${s.emoji}` : ""}`).join("\n");
}

interface RawRecipeJson {
  title: string;
  summary?: string;
  usedIngredientIds?: string[];
  prepIngredients: { name: string; amount?: string; note?: string }[];
  prepWork: { title?: string; detail: string }[];
  cookSteps: { title?: string; detail: string }[];
  tips: string[];
  estimatedMinutes?: number;
}

async function chatComplete(
  cfg: AppConfig,
  apiKey: string,
  system: string,
  user: string
): Promise<string> {
  const proxyHint = outboundProxyUrl()
    ? ""
    : "；若在受限网络下，请在 .env.local 中设置 HTTPS_PROXY（例如 http://127.0.0.1:7890，与本地代理软件的 HTTP 代理端口一致）";
  let res: Response;
  try {
    res = await aiOutboundFetch(`${cfg.aiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.aiModel,
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (e) {
    const hint =
      e instanceof TypeError
        ? `（无法建立 HTTPS 连接，常见于网络限制或未配置代理${proxyHint}；也可在终端执行 curl -I ${cfg.aiBaseUrl.replace(/\/v1$/, "")} 自测）`
        : "";
    throw new Error(`调用菜谱 AI 接口失败${hint}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI 请求失败 ${res.status}: ${err.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 返回为空");
  return content;
}

function normalizeUsedIngredientIds(
  selected: IngredientItem[],
  rawIds: string[] | undefined,
  prepNames: string[]
): string[] {
  const allowed = new Set(selected.map((s) => s.id));
  const out = new Set<string>();
  for (const id of rawIds ?? []) {
    if (allowed.has(id)) out.add(id);
  }
  if (out.size) return [...out];
  const nameToId = new Map(selected.map((s) => [s.name, s.id] as const));
  for (const row of prepNames) {
    const id = nameToId.get(row);
    if (id) out.add(id);
  }
  if (out.size) return [...out];
  return [selected[0]!.id];
}

function rawToRecipe(
  parsed: RawRecipeJson,
  selected: IngredientItem[],
  fullSessionIngredientIds: string[],
  flavorIds: string[],
  difficultyId: DifficultyId
): GeneratedRecipe {
  const prepNames = (parsed.prepIngredients ?? []).map((x) => x.name);
  const uses = normalizeUsedIngredientIds(selected, parsed.usedIngredientIds, prepNames);
  const id = nanoid(12);
  const createdAt = new Date().toISOString();
  return {
    id,
    title: parsed.title,
    summary: parsed.summary,
    prepIngredients: parsed.prepIngredients ?? [],
    prepWork: parsed.prepWork ?? [],
    cookSteps: parsed.cookSteps ?? [],
    tips: parsed.tips ?? [],
    difficulty: difficultyId,
    estimatedMinutes: parsed.estimatedMinutes,
    flavorTags: flavorIds,
    sourceIngredients: fullSessionIngredientIds,
    usesIngredients: uses,
    createdAt,
  };
}

/** 首页：一次生成多道菜谱（各用不同食材子集） */
export async function generateRecipes(params: {
  selected: IngredientItem[];
  flavors: FlavorItem[];
  difficulty: DifficultyOption;
}): Promise<GeneratedRecipe[]> {
  const cfg = await loadAppConfig();
  const tpl = await fs.readFile(paths.recipePrompt, "utf-8");
  const count = params.selected.length;
  const k = targetRecipeCount(count);
  const ingredientIdList = ingredientIdListBlock(params.selected);
  const flavorHints = params.flavors.map((f) => f.prompts ?? f.label).join("；");
  const system = tpl
    .replaceAll("{{targetRecipeCount}}", String(k))
    .replaceAll("{{difficultyLabel}}", params.difficulty.label)
    .replaceAll("{{difficultyDescription}}", params.difficulty.description)
    .replaceAll("{{maxMinutes}}", String(params.difficulty.maxMinutesHint ?? 60))
    .replaceAll("{{flavorHints}}", flavorHints || "按家常菜口味即可")
    .replaceAll("{{ingredientCount}}", String(count))
    .replaceAll("{{ingredientIdList}}", ingredientIdList);

  const rk = recipeApiKey();
  const fullIds = params.selected.map((s) => s.id);
  const flavorIds = params.flavors.map((f) => f.id);

  let list: RawRecipeJson[];
  if (!rk) {
    list = mockBatchRecipes(params.selected, params.flavors, params.difficulty, k);
  } else {
    const rawText = await chatComplete(
      cfg,
      rk,
      system,
      `请根据以上说明输出 JSON，recipes 数组长度必须为 ${k}。`
    );
    let outer: unknown;
    try {
      outer = JSON.parse(stripJsonFence(rawText));
    } catch {
      throw new Error("AI 返回的不是合法 JSON，请重试或换一个模型");
    }
    if (Array.isArray(outer)) {
      list = outer as RawRecipeJson[];
    } else if (outer && typeof outer === "object" && Array.isArray((outer as { recipes?: unknown }).recipes)) {
      list = (outer as { recipes: RawRecipeJson[] }).recipes;
    } else {
      throw new Error("AI 应返回 { recipes: [...] } 结构");
    }
    if (list.length < k) {
      throw new Error(`AI 只返回了 ${list.length} 道菜，需要 ${k} 道，请重试`);
    }
    if (list.length > k) list = list.slice(0, k);
  }

  return list.map((item) =>
    rawToRecipe(item, params.selected, fullIds, flavorIds, params.difficulty.id)
  );
}

function mockBatchRecipes(
  selected: IngredientItem[],
  flavors: FlavorItem[],
  difficulty: DifficultyOption,
  k: number
): RawRecipeJson[] {
  const ids = selected.map((s) => s.id);
  const groups = distributeIds(ids, k);

  return groups.map((used, idx) => {
    const names = selected.filter((s) => used.includes(s.id)).map((s) => s.name);
    const main = names[0] ?? "家常菜";
    return {
      title: `${main}家常方案 ${idx + 1}（示例）`,
      summary: `示例第 ${idx + 1} 道 · 配置 OHMYGPT_RECIPE_API_KEY 后见真实 AI。`,
      usedIngredientIds: used,
      prepIngredients: selected
        .filter((s) => used.includes(s.id))
        .map((s) => ({ name: s.name, amount: "适量" })),
      prepWork: [{ detail: "食材洗净切配；蒜片备好。" }],
      cookSteps: [
        { title: "炒制", detail: "中火少油炒香，下主料炒匀。" },
        { title: "出锅", detail: `按「${flavors[0]?.label ?? "家常"}」调味装盘。` },
      ],
      tips: [`难度：${difficulty.label}`, "此为多道示例之一。"],
      estimatedMinutes: 18,
    };
  });
}

function distributeIds(ids: string[], k: number): string[][] {
  const out: string[][] = Array.from({ length: k }, () => []);
  ids.forEach((id, i) => out[i % k]!.push(id));
  return out.map((g) => (g.length ? g : [ids[0]!]));
}

/** 详情页：换简单版，仅一道菜 */
export async function generateRecipe(params: {
  selected: IngredientItem[];
  flavors: FlavorItem[];
  difficulty: DifficultyOption;
  simplifyExtra?: string;
}): Promise<GeneratedRecipe> {
  const cfg = await loadAppConfig();
  const tpl = await fs.readFile(paths.recipeSimplifyPrompt, "utf-8");
  const ingredientIdList = ingredientIdListBlock(params.selected);
  const flavorHints = params.flavors.map((f) => f.prompts ?? f.label).join("；");
  const simplifyTrimmed = params.simplifyExtra?.trim() ?? "";
  const simplifyBlock = simplifyTrimmed ? `## 本轮说明\n${simplifyTrimmed}\n` : "";
  const system = tpl
    .replaceAll("{{difficultyLabel}}", params.difficulty.label)
    .replaceAll("{{difficultyDescription}}", params.difficulty.description)
    .replaceAll("{{maxMinutes}}", String(params.difficulty.maxMinutesHint ?? 60))
    .replaceAll("{{flavorHints}}", flavorHints || "按家常菜口味即可")
    .replaceAll("{{ingredientIdList}}", ingredientIdList)
    .replaceAll("{{simplifyExtra}}", simplifyBlock);

  const rk = recipeApiKey();
  const fullIds = params.selected.map((s) => s.id);
  const flavorIds = params.flavors.map((f) => f.id);

  let rawText: string;
  if (!rk) {
    rawText = JSON.stringify(mockSimplifyPayload(params));
  } else {
    rawText = await chatComplete(cfg, rk, system, "请根据以上系统说明，输出一道菜的完整 JSON。");
  }

  let parsed: RawRecipeJson;
  try {
    parsed = JSON.parse(stripJsonFence(rawText)) as RawRecipeJson;
  } catch {
    throw new Error("AI 返回的不是合法 JSON，请重试或换一个模型");
  }

  return rawToRecipe(parsed, params.selected, fullIds, flavorIds, params.difficulty.id);
}

function mockSimplifyPayload(params: {
  selected: IngredientItem[];
  flavors: FlavorItem[];
  difficulty: DifficultyOption;
}): RawRecipeJson {
  const main = params.selected[0]?.name ?? "家常菜";
  const use = params.selected.slice(0, Math.min(2, params.selected.length));
  return {
    title: `${main}简化示例`,
    summary: "未配置密钥时的简单版示例。",
    usedIngredientIds: use.map((s) => s.id),
    prepIngredients: use.map((s) => ({ name: s.name, amount: "适量" })),
    prepWork: [{ detail: "洗净切好即可。" }],
    cookSteps: [
      { title: "快炒", detail: "少油炒香，下料翻匀。" },
      { title: "出锅", detail: "调味装盘。" },
    ],
    tips: [`难度：${params.difficulty.label}`],
    estimatedMinutes: 15,
  };
}
