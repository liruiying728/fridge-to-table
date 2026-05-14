type ToastProps = {
  message: string | null;
};

/** 轻量提示条，由父组件控制显示时长 */
export default function Toast({ message }: ToastProps) {
  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
