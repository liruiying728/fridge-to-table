import type { GeneratedRecipe } from "@shared/types";

const KEY = "ftt:favorites";

export function readFavoritesFromStorage(): GeneratedRecipe[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as GeneratedRecipe[];
  } catch {
    return [];
  }
}

export function writeFavoritesToStorage(list: GeneratedRecipe[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode / quota */
  }
}

export function upsertFavoriteInStorage(recipe: GeneratedRecipe): void {
  const list = readFavoritesFromStorage();
  writeFavoritesToStorage([recipe, ...list.filter((r) => r.id !== recipe.id)]);
}

export function removeFavoriteFromStorage(id: string): void {
  const list = readFavoritesFromStorage();
  writeFavoritesToStorage(list.filter((r) => r.id !== id));
}
