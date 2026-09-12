"use client";

import { X } from "lucide-react";

export type ToastMessage = {
  kind: "error" | "success";
  text: string;
};

export function Toast({
  message,
  onDismiss,
}: {
  message: ToastMessage | null;
  onDismiss: () => void;
}) {
  if (!message) return null;

  return (
    <div
      className={`fixed right-4 top-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-xl ${
        message.kind === "error"
          ? "border-red-400/40 bg-red-950 text-red-100"
          : "border-green-400/40 bg-green-950 text-green-100"
      }`}
      role="status"
      aria-live="polite"
    >
      <span className="flex-1">{message.text}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-current opacity-70 hover:opacity-100"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
