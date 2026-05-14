import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { GeneratedRecipe } from "@shared/types";
import UnfavoriteConfirmModal from "../components/UnfavoriteConfirmModal";
import { readFavoritesFromStorage, removeFavoriteFromStorage } from "../favoritesStorage";

const RECIPE_STORAGE_KEY = "ftt:lastRecipe";

export default function FavoritesPage() {
  const nav = useNavigate();
  const location = useLocation();
  const [favorites, setFavorites] = useState<GeneratedRecipe[]>([]);
  const [unfavConfirm, setUnfavConfirm] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    setFavorites(readFavoritesFromStorage());
  }, []);

  const removeFavorite = useCallback((id: string) => {
    removeFavoriteFromStorage(id);
    setFavorites((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const confirmRemoveFavorite = useCallback(() => {
    setUnfavConfirm((cur) => {
      if (cur) removeFavorite(cur.id);
      return null;
    });
  }, [removeFavorite]);

  return (
    <div className="app-shell app-shell--fixed-header">
      <header className="site-header site-header--home">
        <div className="site-header__inner">
          <div className="home-header__title-row">
            <p className="home-header__brand-text">冰箱到餐桌</p>
            <nav className="home-header-tabs" role="tablist" aria-label="首页分区">
              <Link
                to="/"
                role="tab"
                aria-selected={location.pathname === "/"}
                className={`home-header-tab${location.pathname === "/" ? " active" : ""}`}
              >
                准备阶段
              </Link>
              <Link
                to="/favorites"
                role="tab"
                aria-selected={location.pathname === "/favorites"}
                className={`home-header-tab${location.pathname === "/favorites" ? " active" : ""}`}
              >
                菜谱收藏
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <section>
        {favorites.length === 0 ? (
          <div className="card empty">还没有菜谱呢，生成第一道菜后才可以收藏</div>
        ) : (
          <div className="fav-grid">
            {favorites.map((r) => (
              <div key={r.id} className="fav-card-row">
                <button
                  type="button"
                  className="fav-card"
                  onClick={() => {
                    sessionStorage.setItem(RECIPE_STORAGE_KEY, JSON.stringify(r));
                    nav("/recipe", { state: { recipe: r } });
                  }}
                >
                  <div className="fav-body">
                    <h3>{r.title}</h3>
                    {r.estimatedMinutes ? <small>耗时约需 {r.estimatedMinutes} 分钟</small> : null}
                  </div>
                </button>
                <button
                  type="button"
                  className="ghost-btn fav-card-unfav"
                  aria-label={`取消收藏「${r.title}」`}
                  onClick={() => setUnfavConfirm({ id: r.id, title: r.title })}
                >
                  取消收藏
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <UnfavoriteConfirmModal
        open={!!unfavConfirm}
        recipeTitle={unfavConfirm?.title ?? ""}
        onCancel={() => setUnfavConfirm(null)}
        onConfirm={confirmRemoveFavorite}
      />
    </div>
  );
}
