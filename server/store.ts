import fs from "fs/promises";
import type { AppConfig, DifficultyOption, FlavorItem, IngredientItem } from "../shared/types";
import { paths } from "./paths.js";

export async function readJson<T>(file: string): Promise<T> {
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as T;
}

export async function loadAppConfig(): Promise<AppConfig> {
  const file = await readJson<AppConfig>(paths.appConfig);
  const base = process.env.OHMYGPT_BASE_URL?.trim() || file.aiBaseUrl;
  return {
    ...file,
    aiBaseUrl: base,
    aiModel: process.env.OHMYGPT_RECIPE_MODEL?.trim() || file.aiModel,
  };
}

export async function mergedIngredients(): Promise<IngredientItem[]> {
  const [fridge, seasonings] = await Promise.all([
    loadFridgeIngredients(),
    loadSeasoningsIngredients(),
  ]);
  const byId = new Map<string, IngredientItem>();
  for (const x of fridge) byId.set(x.id, x);
  for (const x of seasonings) byId.set(x.id, x);
  return [...byId.values()];
}

/** `ingredients.builtin.json` 全量，用于首页「冰箱」区块与「至少选一种主料」校验 */
export async function loadFridgeIngredients(): Promise<IngredientItem[]> {
  return readJson<IngredientItem[]>(paths.builtinIngredients);
}

/** `seasonings.builtin.json` 全量，用于首页「调味料」区块 */
export async function loadSeasoningsIngredients(): Promise<IngredientItem[]> {
  return readJson<IngredientItem[]>(paths.seasoningsBuiltin).catch(() => []);
}

export async function loadFlavors(): Promise<FlavorItem[]> {
  return readJson(paths.flavors);
}

export async function loadDifficulties(): Promise<DifficultyOption[]> {
  return readJson(paths.difficulties);
}
