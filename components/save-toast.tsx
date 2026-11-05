"use client";

export function SaveToast({ message, onDismiss, variant = "success" }: { message: string; onDismiss: () => void; variant?: "success" | "error" }) {
  const isError = variant === "error";
  return <aside className={`save-toast${isError ? " save-toast-error" : ""}`} aria-label={isError ? "Upload error" : "Save feedback"}>
    <p role={isError ? "alert" : "status"} aria-live={isError ? "assertive" : "polite"} aria-atomic="true">{message}</p>
    <button type="button" className="text-button" onClick={onDismiss} aria-label={isError ? "Dismiss upload error" : "Dismiss save confirmation"}>Dismiss</button>
  </aside>;
}
