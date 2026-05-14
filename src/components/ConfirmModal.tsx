import { useEffect } from "react";

export interface ConfirmModalProps {
  open: boolean;
  message: string;
  cancelLabel?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmModal({
  open,
  message,
  cancelLabel = "取消",
  confirmLabel = "确定",
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-backdrop modal-backdrop--message" role="presentation">
      <div
        className="modal modal-message modal-message--info modal-message--confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-desc"
      >
        <p id="confirm-modal-desc" className="modal-message-text">
          {message}
        </p>
        <div className="modal-confirm-actions">
          <button type="button" className="ghost-btn modal-confirm-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="primary-btn modal-confirm-btn" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
