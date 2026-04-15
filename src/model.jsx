import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export default function Modal({ children, onClose, title, modalId }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialogNode = dialogRef.current;
    if (!dialogNode) {
      return undefined;
    }

    const previousActiveElement = document.activeElement;
    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ");

    const focusableElements = Array.from(dialogNode.querySelectorAll(focusableSelector));
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    if (firstFocusable) {
      firstFocusable.focus();
    } else {
      dialogNode.focus();
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    dialogNode.addEventListener("keydown", handleKeyDown);
    return () => {
      dialogNode.removeEventListener("keydown", handleKeyDown);
      if (previousActiveElement && typeof previousActiveElement.focus === "function") {
        previousActiveElement.focus();
      }
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <motion.div
        id={modalId}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${modalId}-title`}
        tabIndex={-1}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-80 rounded-2xl border border-orange-200 bg-white p-6 shadow-xl"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id={`${modalId}-title`} className="text-xl font-bold text-[#111827]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title} modal`}
            className="rounded p-1 text-[#111827] transition hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-300"
          >
            ✖
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}