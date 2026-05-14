import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { DifficultyOption, FlavorItem, IngredientItem } from "@shared/types";
import { generateRecipesApi } from "../api";
import { getStaticCatalog } from "../catalog";
import ConfirmModal from "../components/ConfirmModal";
import MessageModal, { type MessageModalVariant } from "../components/MessageModal";
import Toast from "../components/Toast";

const LOADING_EMOJIS = ["🥕", "🍅", "🧄", "🥚", "🌶️", "🍄", "🥬", "🍚"];

const RECIPES_STORAGE_KEY = "ftt:lastRecipes";
const HOME_SELECTIONS_KEY = "ftt:homeSelections";

/** 无 category 时归入「其他」 */
const UNCATEGORIZED_KEY = "__uncategorized__";

/** 冰箱区块分类顺序；未列出的（如蛋奶）排在之后，按名称排序；「其他」最后 */
const FRIDGE_CATEGORY_ORDER = ["蔬菜", "肉", "豆制品", "干货", "海鲜"] as const;

/** 调味料区块分类顺序；未列出的排在之后，按名称排序；「其他」最后 */
const SEASONING_CATEGORY_ORDER = ["基础调味", "香辣", "香油", "辛香", "酱类", "干香料"] as const;

function fridgeCategorySortRank(key: string): number {
  if (key === UNCATEGORIZED_KEY) return 10_000;
  const idx = FRIDGE_CATEGORY_ORDER.indexOf(key as (typeof FRIDGE_CATEGORY_ORDER)[number]);
  return idx >= 0 ? idx : 1000;
}

function seasoningCategorySortRank(key: string): number {
  if (key === UNCATEGORIZED_KEY) return 10_000;
  const idx = SEASONING_CATEGORY_ORDER.indexOf(key as (typeof SEASONING_CATEGORY_ORDER)[number]);
  return idx >= 0 ? idx : 1000;
}

function groupIngredientsByCategory(
  items: IngredientItem[],
  section: "fridge" | "seasoning"
): Array<{ key: string; label: string; items: IngredientItem[] }> {
  const byCat = new Map<string, IngredientItem[]>();
  for (const i of items) {
    const key = i.category?.trim() ? i.category.trim() : UNCATEGORIZED_KEY;
    const list = byCat.get(key) ?? [];
    list.push(i);
    byCat.set(key, list);
  }
  const groups = [...byCat.entries()].map(([key, groupItems]) => {
    const sorted = [...groupItems].sort((a, b) => a.name.localeCompare(b.name, "zh"));
    return {
      key,
      label: key === UNCATEGORIZED_KEY ? "其他" : key,
      items: sorted,
    };
  });
  groups.sort((a, b) => {
    const ra = section === "fridge" ? fridgeCategorySortRank(a.key) : seasoningCategorySortRank(a.key);
    const rb = section === "fridge" ? fridgeCategorySortRank(b.key) : seasoningCategorySortRank(b.key);
    if (ra !== rb) return ra - rb;
    return a.label.localeCompare(b.label, "zh");
  });
  return groups;
}

function readHomeSelections(
  validIngredientIds: Set<string>,
  validFlavorIds: Set<string>,
  validDifficultyIds: Set<string>,
  defaultDiffId: string
): { picked: Set<string>; flavorPick: Set<string>; diffId: string } | null {
  try {
    const raw = localStorage.getItem(HOME_SELECTIONS_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { picked?: string[]; flavorIds?: string[]; difficultyId?: string };
    const picked = new Set((o.picked ?? []).filter((id) => validIngredientIds.has(id)));
    const flavorPick = new Set((o.flavorIds ?? []).filter((id) => validFlavorIds.has(id)));
    const diffId =
      o.difficultyId && validDifficultyIds.has(o.difficultyId) ? o.difficultyId : defaultDiffId;
    return { picked, flavorPick, diffId };
  } catch {
    return null;
  }
}

export default function Home() {
  const nav = useNavigate();
  const location = useLocation();
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [seasonings, setSeasonings] = useState<IngredientItem[]>([]);
  const [flavors, setFlavors] = useState<FlavorItem[]>([]);
  const [difficulties, setDifficulties] = useState<DifficultyOption[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [flavorPick, setFlavorPick] = useState<Set<string>>(new Set());
  const [diffId, setDiffId] = useState<string>("home");
  const [loading, setLoading] = useState(false);
  const [messageModal, setMessageModal] = useState<{
    message: string;
    variant: MessageModalVariant;
  } | null>(null);
  const [loadTick, setLoadTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pickedSheetOpen, setPickedSheetOpen] = useState(false);
  const [pickedModalTab, setPickedModalTab] = useState<"ingredients" | "seasonings">("ingredients");
  const [clearSectionPicks, setClearSectionPicks] = useState<"fridge" | "seasoning" | null>(null);
  const [clearPrefsConfirmOpen, setClearPrefsConfirmOpen] = useState(false);
  const [pickedModalUncheckConfirm, setPickedModalUncheckConfirm] = useState<{ id: string; label: string } | null>(
    null
  );
  const pickedModalUncheckConfirmRef = useRef(false);
  pickedModalUncheckConfirmRef.current = pickedModalUncheckConfirm !== null;

  const pushToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const fridgeGroups = useMemo(
    () => groupIngredientsByCategory(ingredients, "fridge"),
    [ingredients]
  );
  const seasoningGroups = useMemo(
    () => groupIngredientsByCategory(seasonings, "seasoning"),
    [seasonings]
  );

  const ingredientNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of ingredients) m.set(i.id, i.name);
    for (const i of seasonings) m.set(i.id, i.name);
    return m;
  }, [ingredients, seasonings]);

  const hasMainPick = useMemo(() => ingredients.some((i) => picked.has(i.id)), [ingredients, picked]);

  const mainPickCount = useMemo(
    () => ingredients.filter((i) => picked.has(i.id)).length,
    [ingredients, picked]
  );

  const seasoningPickCount = useMemo(
    () => seasonings.filter((i) => picked.has(i.id)).length,
    [seasonings, picked]
  );

  const defaultPrefsDiffId = useMemo(
    () => difficulties[1]?.id ?? difficulties[0]?.id ?? "home",
    [difficulties]
  );

  const prefsClearDisabled = useMemo(
    () => flavorPick.size === 0 && diffId === defaultPrefsDiffId,
    [flavorPick, diffId, defaultPrefsDiffId]
  );

  const pickedPantryTotal = useMemo(
    () => mainPickCount + seasoningPickCount,
    [mainPickCount, seasoningPickCount]
  );

  const pickedMainItems = useMemo(
    () =>
      ingredients
        .filter((i) => picked.has(i.id))
        .sort((a, b) => a.name.localeCompare(b.name, "zh")),
    [ingredients, picked]
  );

  const pickedSeasoningItems = useMemo(
    () =>
      seasonings
        .filter((i) => picked.has(i.id))
        .sort((a, b) => a.name.localeCompare(b.name, "zh")),
    [seasonings, picked]
  );

  useEffect(() => {
    if (!pickedSheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pickedModalUncheckConfirmRef.current) setPickedSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickedSheetOpen]);

  useEffect(() => {
    try {
      const b = getStaticCatalog();
      const fridge = b.ingredients;
      const seas = b.seasonings;
      const validIng = new Set([...fridge, ...seas].map((i) => i.id));
      const validFlav = new Set(b.flavors.map((f) => f.id));
      const validDiff = new Set(b.difficulties.map((d) => d.id));
      const defaultDiffId = b.difficulties[1]?.id ?? "home";
      const cached = readHomeSelections(validIng, validFlav, validDiff, defaultDiffId);

      setIngredients(fridge);
      setSeasonings(seas);
      setFlavors(b.flavors);
      setDifficulties(b.difficulties);
      if (cached) {
        setPicked(cached.picked);
        setFlavorPick(cached.flavorPick);
        setDiffId(cached.diffId);
      } else {
        setDiffId(defaultDiffId);
        const firstFlavorId = b.flavors[0]?.id;
        setFlavorPick(firstFlavorId ? new Set([firstFlavorId]) : new Set());
      }
    } catch (e) {
      setMessageModal({
        message: e instanceof Error ? e.message : "加载失败",
        variant: "error",
      });
    }
  }, []);

  useEffect(() => {
    if (ingredients.length === 0 && seasonings.length === 0) return;
    try {
      localStorage.setItem(
        HOME_SELECTIONS_KEY,
        JSON.stringify({
          picked: [...picked],
          flavorIds: [...flavorPick],
          difficultyId: diffId,
        })
      );
    } catch {
      /* private mode / quota */
    }
  }, [ingredients.length, seasonings.length, picked, flavorPick, diffId]);

  useEffect(() => {
    if (!loading) return;
    const t = window.setInterval(() => setLoadTick((x) => x + 1), 420);
    return () => clearInterval(t);
  }, [loading]);

  const toggle = useCallback(
    (id: string) => {
      const willSelect = !picked.has(id);
      const label = ingredientNameById.get(id) ?? "该项";
      pushToast(willSelect ? `已加入 ${label}` : `已移除 ${label}`);
      setPicked((prev) => {
        const next = new Set(prev);
        if (willSelect) next.add(id);
        else next.delete(id);
        return next;
      });
    },
    [picked, pushToast, ingredientNameById]
  );

  const toggleFlavor = useCallback(
    (id: string) => {
      const willSelect = !flavorPick.has(id);
      const label = flavors.find((f) => f.id === id)?.label ?? "该项";
      pushToast(willSelect ? `已加入 ${label}` : `已移除 ${label}`);
      setFlavorPick((prev) => {
        const next = new Set(prev);
        if (willSelect) next.add(id);
        else next.delete(id);
        return next;
      });
    },
    [flavorPick, pushToast, flavors]
  );

  const onGenerate = async () => {
    setMessageModal(null);
    if (!hasMainPick) {
      setMessageModal({
        message: "先选一些主要食材吧；调味料可在下方一并勾选，会一并交给菜谱生成。",
        variant: "info",
      });
      return;
    }
    setLoading(true);
    try {
      const { recipes } = await generateRecipesApi({
        ingredientIds: [...picked],
        flavorIds: [...flavorPick],
        difficultyId: diffId,
      });
      sessionStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(recipes));
      nav("/results", { state: { recipes } });
    } catch (e) {
      setMessageModal({
        message: e instanceof Error ? e.message : "生成失败",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const requestPickedModalUncheck = useCallback(
    (id: string) => {
      const label = ingredientNameById.get(id) ?? "该项";
      setPickedModalUncheckConfirm({ id, label });
    },
    [ingredientNameById]
  );

  const confirmPickedModalUncheck = useCallback(() => {
    setPickedModalUncheckConfirm((cur) => {
      if (cur) {
        setPicked((prev) => {
          const next = new Set(prev);
          next.delete(cur.id);
          return next;
        });
        pushToast(`已移除 ${cur.label}`);
      }
      return null;
    });
  }, [pushToast]);

  return (
    <div className="app-shell app-shell--fixed-header app-shell--home-cart-bar">
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
                onClick={() => setPickedSheetOpen(false)}
              >
                准备阶段
              </Link>
              <Link
                to="/favorites"
                role="tab"
                aria-selected={location.pathname === "/favorites"}
                className={`home-header-tab${location.pathname === "/favorites" ? " active" : ""}`}
                onClick={() => setPickedSheetOpen(false)}
              >
                菜谱收藏
              </Link>
            </nav>
          </div>
        </div>
      </header>

          <section className="card" style={{ marginBottom: "0.85rem" }}>
            <div className="home-fridge-card-head">
              <p className="section-title home-fridge-card-head__title">冰箱中的食材</p>
              <div className="home-fridge-card-head__actions">
                <button
                  type="button"
                  className="home-fridge-clear-btn"
                  disabled={mainPickCount === 0}
                  onClick={() => setClearSectionPicks("fridge")}
                >
                  清空
                </button>
              </div>
            </div>
            {fridgeGroups.map((g) => (
              <div key={g.key} className="ingredient-group">
                {fridgeGroups.length > 1 && <p className="ingredient-group__label">{g.label}</p>}
                <div className="chip-grid">
                  {g.items.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      className={`chip ${picked.has(i.id) ? "selected" : ""}`}
                      onClick={() => toggle(i.id)}
                    >
                      {i.emoji && <span className="e">{i.emoji}</span>}
                      {i.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="card" style={{ marginBottom: "0.85rem" }}>
            <div className="home-fridge-card-head">
              <p className="section-title home-fridge-card-head__title">我的调味料</p>
              <div className="home-fridge-card-head__actions">
                <button
                  type="button"
                  className="home-fridge-clear-btn"
                  disabled={seasoningPickCount === 0}
                  onClick={() => setClearSectionPicks("seasoning")}
                >
                  清空
                </button>
              </div>
            </div>
            {seasoningGroups.map((g) => (
              <div key={g.key} className="ingredient-group">
                {seasoningGroups.length > 1 && <p className="ingredient-group__label">{g.label}</p>}
                <div className="chip-grid">
                  {g.items.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      className={`chip ${picked.has(i.id) ? "selected" : ""}`}
                      onClick={() => toggle(i.id)}
                    >
                      {i.emoji && <span className="e">{i.emoji}</span>}
                      {i.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="card" style={{ marginBottom: "0.85rem" }}>
            <div className="home-fridge-card-head">
              <p className="section-title home-fridge-card-head__title">我的喜好</p>
              <div className="home-fridge-card-head__actions">
                <button
                  type="button"
                  className="home-fridge-clear-btn"
                  disabled={prefsClearDisabled}
                  onClick={() => setClearPrefsConfirmOpen(true)}
                >
                  清空
                </button>
              </div>
            </div>
            <div className="ingredient-group">
              <p className="ingredient-group__label">口味</p>
              <div className="chip-grid">
                {flavors.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`chip ${flavorPick.has(f.id) ? "selected" : ""}`}
                    onClick={() => toggleFlavor(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ingredient-group">
              <p className="ingredient-group__label">时间与难度</p>
              <div className="select-grid">
                {difficulties.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`pill ${diffId === d.id ? "selected" : ""}`}
                    onClick={() => {
                      if (d.id === diffId) return;
                      setDiffId(d.id);
                      pushToast(`已切换到 ${d.label} 难度`);
                    }}
                  >
                    <div>
                      <strong>{d.label}</strong>
                      <span>{d.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

      <div className="home-bottom-float">
          <div className="home-bottom-bar">
            <button
              type="button"
              className="home-picked-btn"
              aria-label={`已选清单，共 ${pickedPantryTotal} 项`}
              onClick={() => {
                setPickedModalTab("ingredients");
                setPickedSheetOpen(true);
              }}
            >
              已选
              {pickedPantryTotal > 0 ? (
                <span className="home-picked-badge">{pickedPantryTotal > 99 ? "99+" : pickedPantryTotal}</span>
              ) : null}
            </button>
            <button
              type="button"
              className="primary-btn home-bottom-bar__generate"
              disabled={loading || !hasMainPick}
              onClick={onGenerate}
            >
              生成菜谱 · 已选 {mainPickCount} 样食材
            </button>
          </div>
        </div>

      {pickedSheetOpen && (
        <div
          className="modal-backdrop home-picked-modal-backdrop"
          role="presentation"
          onClick={() => setPickedSheetOpen(false)}
        >
          <div
            className="home-picked-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-picked-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="home-picked-modal__header">
              <h2 id="home-picked-modal-title" className="home-picked-modal__title">
                已选&nbsp;&nbsp;{pickedPantryTotal}
              </h2>
              <a
                href="#"
                className="home-picked-modal__close"
                aria-label="关闭"
                onClick={(e) => {
                  e.preventDefault();
                  setPickedSheetOpen(false);
                }}
              >
                ×
              </a>
            </div>
            <nav className="home-picked-modal-tabs" role="tablist" aria-label="已选分类">
              <button
                type="button"
                role="tab"
                id="picked-tab-ingredients"
                aria-selected={pickedModalTab === "ingredients"}
                aria-controls="picked-panel-ingredients"
                className={pickedModalTab === "ingredients" ? "active" : ""}
                onClick={() => setPickedModalTab("ingredients")}
              >
                食材&nbsp;&nbsp;{mainPickCount}
              </button>
              <button
                type="button"
                role="tab"
                id="picked-tab-seasonings"
                aria-selected={pickedModalTab === "seasonings"}
                aria-controls="picked-panel-seasonings"
                className={pickedModalTab === "seasonings" ? "active" : ""}
                onClick={() => setPickedModalTab("seasonings")}
              >
                配料&nbsp;&nbsp;{seasoningPickCount}
              </button>
            </nav>
            <div className="home-picked-modal__scroll">
              {pickedModalTab === "ingredients" ? (
                <div
                  id="picked-panel-ingredients"
                  role="tabpanel"
                  aria-labelledby="picked-tab-ingredients"
                  className="home-picked-modal__panel"
                >
                  {pickedMainItems.length === 0 ? (
                    <p className="home-picked-modal__empty">暂无</p>
                  ) : (
                    <div className="chip-grid">
                      {pickedMainItems.map((i) => (
                        <button
                          key={i.id}
                          type="button"
                          className={`chip ${picked.has(i.id) ? "selected" : ""}`}
                          onClick={() => requestPickedModalUncheck(i.id)}
                        >
                          {i.emoji && <span className="e">{i.emoji}</span>}
                          {i.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  id="picked-panel-seasonings"
                  role="tabpanel"
                  aria-labelledby="picked-tab-seasonings"
                  className="home-picked-modal__panel"
                >
                  {pickedSeasoningItems.length === 0 ? (
                    <p className="home-picked-modal__empty">暂无</p>
                  ) : (
                    <div className="chip-grid">
                      {pickedSeasoningItems.map((i) => (
                        <button
                          key={i.id}
                          type="button"
                          className={`chip ${picked.has(i.id) ? "selected" : ""}`}
                          onClick={() => requestPickedModalUncheck(i.id)}
                        >
                          {i.emoji && <span className="e">{i.emoji}</span>}
                          {i.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="modal-backdrop" role="status" aria-live="polite">
          <div className="modal">
            <div key={loadTick} className="emoji-slot">
              {LOADING_EMOJIS[loadTick % LOADING_EMOJIS.length]}
            </div>
            <p className="section-title" style={{ textAlign: "center", marginTop: 0 }}>
              菜谱设计中
            </p>
          </div>
        </div>
      )}

      <Toast message={toast} />

      <MessageModal
        open={!!messageModal}
        message={messageModal?.message ?? ""}
        variant={messageModal?.variant ?? "info"}
        onClose={() => setMessageModal(null)}
      />

      <ConfirmModal
        open={pickedModalUncheckConfirm !== null}
        message={
          pickedModalUncheckConfirm
            ? `移除「${pickedModalUncheckConfirm.label}」？`
            : ""
        }
        cancelLabel="保留"
        confirmLabel="移除"
        onCancel={() => setPickedModalUncheckConfirm(null)}
        onConfirm={confirmPickedModalUncheck}
      />

      <ConfirmModal
        open={clearSectionPicks !== null}
        message={
          clearSectionPicks === "seasoning"
            ? "确定清空所选的调味料吗？"
            : clearSectionPicks === "fridge"
              ? "确定清空所选的食材吗？"
              : ""
        }
        cancelLabel="取消"
        confirmLabel="清空"
        onCancel={() => setClearSectionPicks(null)}
        onConfirm={() => {
          const s = clearSectionPicks;
          setClearSectionPicks(null);
          if (!s) return;
          setPicked((prev) => {
            const next = new Set(prev);
            const ids = s === "fridge" ? ingredients.map((i) => i.id) : seasonings.map((i) => i.id);
            for (const id of ids) next.delete(id);
            return next;
          });
          pushToast(s === "fridge" ? "已清空食材勾选" : "已清空调味料勾选");
        }}
      />

      <ConfirmModal
        open={clearPrefsConfirmOpen}
        message="确定要清空口味多选，并把难度恢复为默认吗？"
        cancelLabel="取消"
        confirmLabel="清空"
        onCancel={() => setClearPrefsConfirmOpen(false)}
        onConfirm={() => {
          setClearPrefsConfirmOpen(false);
          setFlavorPick(new Set());
          setDiffId(difficulties[1]?.id ?? difficulties[0]?.id ?? "home");
          pushToast("已清空喜好");
        }}
      />
    </div>
  );
}
