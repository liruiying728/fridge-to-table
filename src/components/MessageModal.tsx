import { useEffect, useId } from "react";

export type MessageModalVariant = "info" | "success" | "error";

export interface MessageModalProps {
  open: boolean;
  message: string;
  variant?: MessageModalVariant;
  onClose: () => void;
  /** 确认按钮文案 */
  confirmLabel?: string;
}

export default function MessageModal({
  open,
  message,
  variant = "info",
  onClose,
  confirmLabel = "知道了",
}: MessageModalProps) {
  const messageId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop modal-backdrop--message"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`modal modal-message modal-message--${variant}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={messageId}
        onClick={(e) => e.stopPropagation()}
      >
        <p id={messageId} className="modal-message-text">
          {message}
        </p>
        <button type="button" className="primary-btn modal-message-btn" onClick={onClose}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
