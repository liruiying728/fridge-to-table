import ConfirmModal from "./ConfirmModal";

export interface UnfavoriteConfirmModalProps {
  open: boolean;
  /** 菜谱标题，嵌入正文「…」中 */
  recipeTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** 取消收藏确认：文案与按钮固定，避免各页重复拼装 ConfirmModal */
export default function UnfavoriteConfirmModal({
  open,
  recipeTitle,
  onCancel,
  onConfirm,
}: UnfavoriteConfirmModalProps) {
  return (
    <ConfirmModal
      open={open}
      message={`确定不继续收藏「${recipeTitle}」了吗？`}
      cancelLabel="保留"
      confirmLabel="取消收藏"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
