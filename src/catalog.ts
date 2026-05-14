import type { DifficultyOption, FlavorItem, IngredientItem } from "@shared/types";
import ingredientsData from "../data/ingredients.builtin.json";
import seasoningsData from "../data/seasonings.builtin.json";
import flavorsData from "../data/flavors.json";
import difficultiesData from "../data/difficulties.json";

const sortZh = (a: IngredientItem, b: IngredientItem) =>
  (a.name ?? "").localeCompare(b.name ?? "", "zh");

export type CatalogPayload = {
  ingredients: IngredientItem[];
  seasonings: IngredientItem[];
  flavors: FlavorItem[];
  difficulties: DifficultyOption[];
};

/** 构建时从仓库根目录 `data/*.json` 打包进前端，无需请求后端。 */
export function getStaticCatalog(): CatalogPayload {
  const ingredients = [...(ingredientsData as IngredientItem[])].sort(sortZh);
  const seasonings = [...(seasoningsData as IngredientItem[])].sort(sortZh);
  return {
    ingredients,
    seasonings,
    flavors: flavorsData as FlavorItem[],
    difficulties: difficultiesData as DifficultyOption[],
  };
}

export function ingredientItemMapFromCatalog(c: CatalogPayload): Map<string, IngredientItem> {
  const m = new Map<string, IngredientItem>();
  for (const i of c.ingredients) m.set(i.id, i);
  for (const i of c.seasonings) m.set(i.id, i);
  return m;
}

export function ingredientNamesFromCatalog(c: CatalogPayload): Map<string, string> {
  const m = new Map<string, string>();
  for (const i of c.ingredients) m.set(i.id, i.name);
  for (const i of c.seasonings) m.set(i.id, i.name);
  return m;
}
