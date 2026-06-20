"use client";

import { useEffect } from "react";

/** Locks body scroll while a modal is open. */
export function useModalScrollLock() {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
}

type ModalDismissOptions = {
  /** Default true. Set false for payment / data-entry modals. */
  escape?: boolean;
};

/**
 * Scroll lock + optional Escape to close.
 * Do not put onClick={onClose} on the backdrop when escape is false.
 */
export function useModalDismiss(onClose: () => void, options?: ModalDismissOptions) {
  const closeOnEscape = options?.escape !== false;
  useModalScrollLock();

  useEffect(() => {
    if (!closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, closeOnEscape]);
}
