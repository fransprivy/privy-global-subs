"use client";

import React, { useEffect } from "react";
import { useStore } from "@/lib/store";
import { IconClose } from "./Icons";

/** Small blue chip that references the requirement id (UX-xx, R-xx, M-xx, N-xx). Toggled from Prototype controls. */
export function Spec({ id, className = "" }: { id: string; className?: string }) {
  const { state } = useStore();
  if (!state?.ui.showSpecTags) return null;
  return <span className={`spec-tag ${className}`}>{id}</span>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-lg",
  spec,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  spec?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`animate-fade w-full ${width} max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <h2 className="font-display text-xl font-semibold text-ink">
            {title} {spec && <Spec id={spec} className="ml-2 align-middle" />}
          </h2>
          <button className="rounded-md p-1 text-muted hover:bg-page hover:text-ink" onClick={onClose} aria-label="Close">
            <IconClose size={20} />
          </button>
        </div>
        <div className="px-6 py-4 text-sm text-ink-2">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, footer, spec }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; spec?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="animate-drawer absolute inset-y-0 right-0 flex w-full max-w-[660px] flex-col bg-white shadow-[var(--shadow-drawer)]" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between px-6 pt-7 pb-3 sm:px-8">
          <h2 className="font-display text-[22px] font-medium text-ink">
            {title} {spec && <Spec id={spec} className="ml-2 align-middle" />}
          </h2>
          <button className="rounded-md p-1 text-muted hover:bg-page hover:text-ink" onClick={onClose} aria-label="Close">
            <IconClose size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6 sm:px-8">{children}</div>
        {footer && <div className="border-t border-line bg-white px-6 py-4 sm:px-8">{footer}</div>}
      </aside>
    </div>
  );
}

export function Checkbox({ checked, onChange, children, id }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; id?: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line-2 bg-page px-3 py-3 text-sm text-ink-2 has-[:checked]:border-ink">
      <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-brand" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function Toggle({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="inline-flex rounded-full bg-[#ecebe9] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${value === o.value ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: "success" | "warn" | "danger" | "info" | "neutral"; children: React.ReactNode }) {
  const map = {
    success: "bg-success-tint text-success",
    warn: "bg-warn-tint text-warn",
    danger: "bg-danger-tint text-danger",
    info: "bg-info-tint text-info",
    neutral: "bg-[#eeeeee] text-muted",
  };
  return <span className={`chip ${map[tone]}`}>{children}</span>;
}
