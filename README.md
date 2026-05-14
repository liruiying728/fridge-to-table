# Fridge to Table

## 这是什么

打开冰箱，有点东西，但不知道做什么——Fridge to Table 帮你解决这个问题。

勾选冰箱里现有的食材和调味料，选好口味偏好和难易程度，AI 给你生成几道能做的菜谱。觉得太难？可以让它再出一个更简单的版本。

## 适合谁用

- 会一点厨艺，但每次面对冰箱都要发呆五分钟
- 不缺食材，缺的是「做什么」的主意
- 选择困难，需要有人替你拍板

## 技术栈

- 前端：React 18、Vite 5、React Router  
- 后端：Express（TypeScript，`tsx` 运行）  
- 数据：`data/` 下 JSON（**只读**：内置食材、调味料、口味与难度）；构建时由 `src/catalog.ts` 一并打入前端静态资源，**首屏列表不请求后端**；提示词在 `config/prompts/`  
- **个人数据（仅浏览器）**：勾选过的食材/调味料、口味与难度、收藏菜谱存在本机 `localStorage`（换浏览器或清站点数据会丢失）；生成结果列表、点进某道菜详情时还会用 **`sessionStorage`**（关标签或新开会话后可能需重新从首页生成）。部署到 **GitHub + Vercel** 时后端无需也不应写入仓库里的 JSON。

## 环境要求

- Node.js 18+（建议使用当前 LTS）

## 本地开发

```bash
npm install
cp .env.example .env.local
# 编辑 .env.local，填入菜谱生成 API 密钥（见 .env.example 注释）
npm run dev
```

## 构建与生产启动

```bash
npm run build
npm run start
```

`npm run start` 在生产模式下会同时托管 `dist/` 静态页与 `/api`（与 Vercel 上一体部署时行为一致）。若前端与 API 不同域，构建前可设置 `VITE_API_BASE_URL`（见 `.env.example`）。

## 目录说明

| 路径 | 作用 |
|------|------|
| `src/` | 前端页面与组件；`src/catalog.ts` 打包 `data/*.json`；`src/favoritesStorage.ts` 为收藏本地缓存 |
| `server/` | Express API、菜谱 AI |
| `shared/` | 前后端共用的类型 |
| `data/` | 内置食材、调味料、口味、难度等 **静态** JSON（扩充列表请直接改文件后重新部署） |
| `config/` | `app.json`、菜谱与简化用的提示词模板 |

## data 里 JSON 大概是啥样（示例）

以下为 **单条/结构示意**，便于改数据时对齐字段名；类型定义见 `shared/types.ts`。

**`ingredients.builtin.json`**（冰箱主料数组）：每项一条食材，`category` 用于首页分组。

```json
{
  "id": "tomato",
  "name": "西红柿",
  "emoji": "🍅",
  "category": "蔬菜",
  "source": 0
}
```

**`seasonings.builtin.json`**（调味料数组）：字段与主料相同（`id` / `name` / `emoji` / `category` 等）。

```json
{
  "id": "soy_sauce",
  "name": "生抽",
  "emoji": "🫗",
  "category": "基础调味",
  "source": 0
}
```

**`flavors.json`**（口味多选）：`prompts` 会进生成/简化时的提示词。

```json
{
  "id": "homey_savory",
  "label": "咸鲜家常",
  "prompts": "咸鲜适口，生抽、蚝油、葱姜为主……"
}
```

**`difficulties.json`**（难度档位）：`id` 与 `shared` 里 `DifficultyId` 一致（如 `quick` / `home` / `pro` 等）。

```json
{
  "id": "home",
  "label": "家常小炒",
  "description": "20–45 分钟；常见炒、焖、煮……",
  "maxMinutesHint": 45
}
```

## 部署到 Vercel

- 仓库需包含 `npm run build` 能产出的 `dist/`，并在平台上配置菜谱 API 环境变量（与 `.env.example` 中 OhMyGPT 相关项一致）。  
- **菜谱 API** 使用 Vercel 原生文件路由 **`api/recipes/generate.ts`**、**`api/recipes/simplify.ts`**（各对应 `POST /api/recipes/generate` 与 `POST /api/recipes/simplify`），**不再**用单文件 Express + `rewrites` 转发，避免 `FUNCTION_INVOCATION_FAILED`。本地开发仍用 `server/` 里的 Express（`npm run dev` / `npm run start`）。
- **`vercel.json` → `functions`**：为上述两个文件分别配置 **`includeFiles`: `data/**,config/**`**（单字符串），把 `fs` 要读的目录打进函数包，否则 **ENOENT**。  
- **`maxDuration`: `60`**：AI 较慢时减少超时；若 Hobby 部署报配置不合法，删掉或改成套餐允许值。
- **食材/口味列表**：由前端打包的 JSON 提供；仅「生成 / 简化菜谱」走上述 API。  
- 用户勾选与收藏均在浏览器本地完成。

## 许可

本项目采用 [MIT License](LICENSE) 开源。

Copyright (c) 2026 [Li Ruiying](https://www.ruiying.li/)