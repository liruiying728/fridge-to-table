import "./load-env.js";
import { generateRecipe, generateRecipes, stepDownDifficulty } from "./recipe-ai.js";
import {
  loadDifficulties,
  loadFlavors,
  loadFridgeIngredients,
  loadSeasoningsIngredients,
  mergedIngredients,
} from "./store.js";
import type { DifficultyId, FlavorItem, GeneratedRecipe } from "../shared/types";

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function pickFlavors(flavorIds: string[] | undefined, flavors: FlavorItem[]): FlavorItem[] {
  const picked =
    flavorIds && flavorIds.length > 0 ? flavors.filter((x) => flavorIds.includes(x.id)) : [];
  if (picked.length) return picked;
  const homey = flavors.find((x) => x.id === "homey");
  return [homey ?? flavors[0]].filter(Boolean) as FlavorItem[];
}

export async function executeRecipesGenerate(body: unknown): Promise<GeneratedRecipe[]> {
  const { ingredientIds, flavorIds, difficultyId } = body as {
    ingredientIds?: string[];
    flavorIds?: string[];
    difficultyId?: string;
  };
  if (!ingredientIds?.length) throw new HttpError(400, "至少选一个食材");
  const [ingredients, fridgeOnly, flavors, difficulties] = await Promise.all([
    mergedIngredients(),
    loadFridgeIngredients(),
    loadFlavors(),
    loadDifficulties(),
  ]);
  const selected = ingredients.filter((i) => ingredientIds.includes(i.id));
  if (!selected.length) throw new HttpError(400, "未匹配到食材");
  const fridgeIdSet = new Set(fridgeOnly.map((i) => i.id));
  const hasMainIngredient = ingredientIds.some((id) => fridgeIdSet.has(id));
  if (!hasMainIngredient) throw new HttpError(400, "至少选一个主要食材（不能只选调味料）");
  const flavorList = pickFlavors(flavorIds, flavors);
  const d = difficulties.find((x) => x.id === difficultyId) ?? difficulties[1];
  return generateRecipes({
    selected,
    flavors: flavorList,
    difficulty: d,
  });
}

export async function executeRecipesSimplify(body: unknown): Promise<GeneratedRecipe> {
  const { ingredientIds, flavorIds, currentDifficultyId } = body as {
    ingredientIds?: string[];
    flavorIds?: string[];
    currentDifficultyId?: string;
  };
  if (!ingredientIds?.length) throw new HttpError(400, "缺少食材上下文");
  const [ingredients, flavors, difficulties] = await Promise.all([
    mergedIngredients(),
    loadFlavors(),
    loadDifficulties(),
  ]);
  const selected = ingredients.filter((i) => ingredientIds.includes(i.id));
  if (!selected.length) throw new HttpError(400, "未匹配到食材");
  const cur = (currentDifficultyId as DifficultyId) ?? "home";
  const { difficulty: nextD, loweredTier, previousLabel } = stepDownDifficulty(cur, difficulties);
  const simplifyExtra = loweredTier
    ? `- 用户反馈上一版太难，已将难度从「${previousLabel}」降为「${nextD.label}」：请显著减少步骤与预处理，技法更基础，总耗时更短，少用专业术语，步骤尽量合并。`
    : `- 用户反馈上一版仍然太复杂；当前已是「${nextD.label}」档位：请**不要**再提高难度档，进一步缩短步骤、减少预处理，合并可合并的操作，确保新手能一眼跟做。`;

  const flavorList = pickFlavors(flavorIds, flavors);
  return generateRecipe({
    selected,
    flavors: flavorList,
    difficulty: nextD,
    simplifyExtra,
  });
}
