import { createPortal } from "react-dom";
import CustomerOrderDeclinedBanner from "./CustomerOrderDeclinedBanner.jsx";

/**
 * Premium glass modal overlay for tailor decline (customer browse/map).
 */
export default function CustomerOrderDeclinedModal({
  open,
  notice,
  onDismiss,
  onChooseAnotherTailor,
}) {
  if (!open || !notice || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-decline-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[3px]"
        aria-label="Close"
        onClick={onDismiss}
      />
      <div className="relative z-10 w-full max-w-md">
        <CustomerOrderDeclinedBanner
          notice={notice}
          onDismiss={onDismiss}
          onChooseAnotherTailor={onChooseAnotherTailor}
          className="shadow-2xl shadow-rose-900/12"
          titleId="customer-decline-title"
        />
      </div>
    </div>,
    document.body
  );
}
