import { Link, useLocation, useNavigate } from "react-router-dom";
import type { GeneratedRecipe, IngredientItem } from "@shared/types";
import { useEffect, useMemo, useState } from "react";
import { getStaticCatalog, ingredientItemMapFromCatalog } from "../catalog";

const RECIPES_STORAGE_KEY = "ftt:lastRecipes";
const RECIPE_STORAGE_KEY = "ftt:lastRecipe";

export default function ResultsPage() {
  const loc = useLocation() as { state?: { recipes?: GeneratedRecipe[] } };
  const nav = useNavigate();
  const [recipes, setRecipes] = useState<GeneratedRecipe[]>(loc.state?.recipes ?? []);
  const [ingredientMap, setIngredientMap] = useState<Map<string, IngredientItem>>(new Map());

  useEffect(() => {
    if (recipes.length) return;
    const raw = sessionStorage.getItem(RECIPES_STORAGE_KEY);
    if (raw) {
      try {
        setRecipes(JSON.parse(raw) as GeneratedRecipe[]);
      } catch {
        /* ignore */
      }
    }
  }, [recipes.length]);

  useEffect(() => {
    setIngredientMap(ingredientItemMapFromCatalog(getStaticCatalog()));
  }, []);

  const labelForIds = useMemo(
    () => (ids: string[] | undefined) =>
      (ids ?? [])
        .map((id) => ingredientMap.get(id)?.name ?? id)
        .filter(Boolean)
        .join("、"),
    [ingredientMap]
  );

  if (!recipes.length) {
    return (
      <div className="app-shell">
        <div className="card empty">暂无推荐结果，请从首页重新生成。</div>
        <Link to="/" className="primary-btn" style={{ display: "block", textAlign: "center", marginTop: 12 }}>
          回首页
        </Link>
      </div>
    );
  }

  return (
    <div className="app-shell app-shell--fixed-header">
      <header className="site-header">
        <div className="site-header__inner site-header__inner--stacked">
          <div className="site-header__toolbar-row">
            <button type="button" className="site-header__back ghost-btn" onClick={() => nav("/")}>
              ← 重选食材
            </button>
            <h1 className="site-header__title site-header__title--results">菜谱推荐 · {recipes.length} 道菜</h1>
          </div>
        </div>
      </header>

      <div className="results-page-body">
        <div className="results-grid">
          {recipes.map((r) => (
            <button
              key={r.id}
              type="button"
              className="result-card"
              onClick={() => {
                sessionStorage.setItem(RECIPE_STORAGE_KEY, JSON.stringify(r));
                nav("/recipe", { state: { recipe: r } });
              }}
            >
              <div className="result-body">
                <h3>{r.title}</h3>
                {r.summary && <p className="result-sum">{r.summary}</p>}
                <p className="result-uses">本菜用到：{labelForIds(r.usesIngredients) || "—"}</p>
                <small className="result-meta">
                  耗时约需 {r.estimatedMinutes ? `${r.estimatedMinutes} 分钟` : ""}
                </small>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
