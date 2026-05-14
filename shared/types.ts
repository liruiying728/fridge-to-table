/** 与前端/服务端共用的菜谱与配置类型 */

export type DifficultyId = "quick" | "home" | "pro";

export interface DifficultyOption {
  id: DifficultyId;
  label: string;
  /** 给 AI / 用户看的定义说明 */
  description: string;
  /** 大致时间上限（分钟），供 prompt 约束 */
  maxMinutesHint?: number;
}

export interface IngredientItem {
  id: string;
  name: string;
  emoji?: string;
  /** 可选：同一份 JSON 内的细分标签（如蔬菜/肉、酱类/干香料），仅用于展示分组 */
  category?: string;
  /** 0 = 系统内置，1 = 用户自定义（可删除）；builtin 数据文件中建议显式写出 0 或 1 */
  source?: 0 | 1;
}

export interface FlavorItem {
  id: string;
  label: string;
  prompts?: string;
}

export interface RecipeIngredient {
  name: string;
  amount?: string;
  note?: string;
}

export interface RecipeStep {
  title?: string;
  detail: string;
}

export interface GeneratedRecipe {
  id: string;
  title: string;
  summary?: string;
  /** 成品图 URL（已废弃，保留兼容旧收藏 JSON） */
  coverImageUrl?: string;
  prepIngredients: RecipeIngredient[];
  /** 提前处理：焯水、腌制等 */
  prepWork: RecipeStep[];
  cookSteps: RecipeStep[];
  tips: string[];
  difficulty: DifficultyId;
  /** 总耗时估算（分钟） */
  estimatedMinutes?: number;
  flavorTags?: string[];
  /** 本次点选的全部食材 id（简化/换菜时上下文一致） */
  sourceIngredients: string[];
  /** 本道菜实际用到的点选食材 id（子集） */
  usesIngredients?: string[];
  createdAt: string;
}

export interface AppConfig {
  /** OhMyGPT / OpenAI 兼容：菜谱 chat/completions */
  aiBaseUrl: string;
  aiModel: string;
}
