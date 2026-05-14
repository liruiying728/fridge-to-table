import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 项目根目录：本机为仓库根；Vercel Serverless 下以 `process.cwd()` 为准（与构建产物 layout 一致） */
export const ROOT = process.env.VERCEL === "1" ? process.cwd() : path.resolve(__dirname, "..");

export const paths = {
  dist: path.join(ROOT, "dist"),
  config: path.join(ROOT, "config"),
  builtinIngredients: path.join(ROOT, "data", "ingredients.builtin.json"),
  seasoningsBuiltin: path.join(ROOT, "data", "seasonings.builtin.json"),
  flavors: path.join(ROOT, "data", "flavors.json"),
  difficulties: path.join(ROOT, "data", "difficulties.json"),
  appConfig: path.join(ROOT, "config", "app.json"),
  recipePrompt: path.join(ROOT, "config", "prompts", "recipe.zh.md"),
  recipeSimplifyPrompt: path.join(ROOT, "config", "prompts", "recipe-simplify.zh.md"),
};

