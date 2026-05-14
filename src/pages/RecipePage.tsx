import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { GeneratedRecipe } from "@shared/types";
import { simplifyRecipe } from "../api";
import ConfirmModal from "../components/ConfirmModal";
import UnfavoriteConfirmModal from "../components/UnfavoriteConfirmModal";
import MessageModal, { type MessageModalVariant } from "../components/MessageModal";
import {
  readFavoritesFromStorage,
  removeFavoriteFromStorage,
  upsertFavoriteInStorage,
} from "../favoritesStorage";

const RECIPE_STORAGE_KEY = "ftt:lastRecipe";

const DIFF_LABEL: Record<string, string> = {
  quick: "快手出餐",
  home: "家常小炒",
  pro: "进阶技法",
};

const LOADING_EMOJIS = ["🥕", "🍅", "🧄", "🥚", "🌶️", "🍄", "🥬", "🍚"];

export default function RecipePage() {
  const loc = useLocation() as { state?: { recipe?: GeneratedRecipe } };
  const nav = useNavigate();
  const [recipe, setRecipe] = useState<GeneratedRecipe | null>(loc.state?.recipe ?? null);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ message: string; variant: MessageModalVariant } | null>(null);
  const [unfavConfirmOpen, setUnfavConfirmOpen] = useState(false);
  const [simplifyConfirmOpen, setSimplifyConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadTick, setLoadTick] = useState(0);

  useEffect(() => {
    if (recipe) return;
    const raw = sessionStorage.getItem(RECIPE_STORAGE_KEY);
    if (raw) {
      try {
        setRecipe(JSON.parse(raw) as GeneratedRecipe);
      } catch {
        /* ignore */
      }
    }
  }, [recipe]);

  useEffect(() => {
    setFavIds(new Set(readFavoritesFromStorage().map((r) => r.id)));
  }, []);

  useEffect(() => {
    if (!loading) return;
    const t = window.setInterval(() => setLoadTick((x) => x + 1), 420);
    return () => clearInterval(t);
  }, [loading]);

  const isFav = recipe && favIds.has(recipe.id);

  if (!recipe) {
    return (
      <div className="app-shell">
        <div className="card empty">没有找到菜谱，请从首页重新生成。</div>
        <Link to="/" className="primary-btn" style={{ display: "block", textAlign: "center", marginTop: 12 }}>
          回首页
        </Link>
      </div>
    );
  }

  const onFavorite = () => {
    setDialog(null);
    try {
      upsertFavoriteInStorage(recipe);
      setFavIds((p) => new Set(p).add(recipe.id));
      setDialog({ message: "已加入收藏夹", variant: "success" });
    } catch (e) {
      setDialog({
        message: e instanceof Error ? e.message : "收藏失败",
        variant: "error",
      });
    }
  };

  const performUnfavorite = () => {
    setDialog(null);
    try {
      removeFavoriteFromStorage(recipe.id);
      setFavIds((p) => {
        const n = new Set(p);
        n.delete(recipe.id);
        return n;
      });
      setDialog({ message: "已从收藏中移除", variant: "success" });
    } catch (e) {
      setDialog({
        message: e instanceof Error ? e.message : "取消收藏失败",
        variant: "error",
      });
    }
  };

  const performSimplify = async () => {
    setDialog(null);
    const prevDiff = recipe.difficulty;
    const ids = recipe.sourceIngredients?.length ? recipe.sourceIngredients : [];
    if (!ids.length) {
      setDialog({
        message: "这份菜谱没有记下当时选的食材，请回首页重新生成后再试。",
        variant: "info",
      });
      return;
    }
    setLoading(true);
    try {
      const next = await simplifyRecipe({
        ingredientIds: ids,
        flavorIds: recipe.flavorTags ?? [],
        currentDifficultyId: recipe.difficulty,
      });
      sessionStorage.setItem(RECIPE_STORAGE_KEY, JSON.stringify(next));
      setRecipe(next);
      setFavIds(new Set(readFavoritesFromStorage().map((r) => r.id)));
      if (next.difficulty !== prevDiff) {
        setDialog({
          message: `已换为「${DIFF_LABEL[next.difficulty] ?? next.difficulty}」更简单的一版，做法已更新。`,
          variant: "success",
        });
      } else {
        setDialog({ message: "已在当前最简单档位里再精简步骤，请看新版。", variant: "success" });
      }
    } catch (e) {
      setDialog({
        message: e instanceof Error ? e.message : "生成失败",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const onSimplifyClick = () => {
    setDialog(null);
    const ids = recipe.sourceIngredients?.length ? recipe.sourceIngredients : [];
    if (!ids.length) {
      setDialog({
        message: "这份菜谱没有记下当时选的食材，请回首页重新生成后再试。",
        variant: "info",
      });
      return;
    }
    setSimplifyConfirmOpen(true);
  };

  return (
    <div className="app-shell app-shell--fixed-header">
      <header className="site-header">
        <div className="site-header__inner site-header__inner--recipe">
          <button type="button" className="site-header__back ghost-btn" onClick={() => nav(-1)}>
            ← 返回
          </button>
          <h1 className="site-header__title">{recipe.title}</h1>
          {isFav ? (
            <button
              type="button"
              className="site-header__trailing ghost-btn"
              onClick={() => setUnfavConfirmOpen(true)}
            >
              取消收藏
            </button>
          ) : null}
        </div>
      </header>

      <div className="recipe-body">
        <div className="card list-block">
          <p className="section-title">准备食材</p>
          <ul>
            {recipe.prepIngredients.map((x, i) => (
              <li key={i}>
                <strong>{x.name}</strong>
                {x.amount ? ` · ${x.amount}` : ""}
                {x.note ? <span style={{ color: "var(--muted)" }}>（{x.note}）</span> : null}
              </li>
            ))}
          </ul>
        </div>

        {!!recipe.prepWork.length && (
          <div className="card list-block">
            <p className="section-title">提前处理</p>
            <div className="steps">
              {recipe.prepWork.map((s, i) => (
                <div key={i} className="step">
                  {s.title && <div className="t">{s.title}</div>}
                  <div className="d">{s.detail}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card list-block">
          <p className="section-title">烹饪步骤</p>
          <div className="steps">
            {recipe.cookSteps.map((s, i) => (
              <div key={i} className="step step--cook">
                <div className="step--cook__num">{i + 1}</div>
                <div className="step--cook__body">
                  {s.title ? (
                    <>
                      <div className="t">{s.title}</div>
                      <div className="d">{s.detail}</div>
                    </>
                  ) : (
                    <div className="d">{s.detail}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {!!recipe.tips.length && (
          <div className="card list-block">
            <p className="section-title">小贴士</p>
            <ul>
              {recipe.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="toolbar">
          <button
            type="button"
            className="ghost-btn"
            style={{ flex: 1 }}
            onClick={onSimplifyClick}
            disabled={loading}
          >
            基于同样食材，重新生成简单版的
          </button>
          {!isFav ? (
            <button type="button" className="primary-btn" style={{ flex: 1 }} onClick={() => onFavorite()}>
              收藏
            </button>
          ) : null}
        </div>
      </div>

      {loading && (
        <div className="modal-backdrop" role="status" aria-live="polite">
          <div className="modal">
            <div key={loadTick} className="emoji-slot">
              {LOADING_EMOJIS[loadTick % LOADING_EMOJIS.length]}
            </div>
            <p className="section-title" style={{ textAlign: "center", marginTop: 0 }}>
              正在设计简单版
            </p>
            <p style={{ marginTop: 0 }}>保留你的口味和偏好，构思更简单、更顺手的流程中……</p>
          </div>
        </div>
      )}

      <MessageModal
        open={!!dialog}
        message={dialog?.message ?? ""}
        variant={dialog?.variant ?? "info"}
        onClose={() => setDialog(null)}
      />

      <ConfirmModal
        open={simplifyConfirmOpen}
        message="将按当前所选的食材与口味，重新设计一版更简单的菜谱，确定继续吗？"
        cancelLabel="保留当前"
        confirmLabel="重新设计"
        onCancel={() => setSimplifyConfirmOpen(false)}
        onConfirm={() => {
          setSimplifyConfirmOpen(false);
          void performSimplify();
        }}
      />

      <UnfavoriteConfirmModal
        open={unfavConfirmOpen}
        recipeTitle={recipe.title}
        onCancel={() => setUnfavConfirmOpen(false)}
        onConfirm={() => {
          setUnfavConfirmOpen(false);
          performUnfavorite();
        }}
      />
    </div>
  );
}
