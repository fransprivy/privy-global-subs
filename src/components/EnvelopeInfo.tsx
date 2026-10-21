"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconInfo } from "./Icons";

/** Copy from the mobile app: what counts against the monthly envelope quota. */
export const ENVELOPE_INFO_TITLE = "What uses an envelope";
export const ENVELOPE_INFO_BODY = "Sending, signing or approving an envelope uses 1 of your monthly envelopes. Your envelopes reset on the 1st of every month.";
const UNLIMITED_BODY = "Sending, signing or approving an envelope uses 1 envelope. Your plan includes unlimited envelopes, so there is no monthly limit.";

/**
 * Small (i) button that opens the "What uses an envelope" sheet.
 * `unlimited` swaps the reset sentence for plans without a quota. `label` renders a text link instead of the icon.
 */
export function EnvelopeInfo({ unlimited = false, label, className = "", size = 16 }: { unlimited?: boolean; label?: string; className?: string; size?: number }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        className={label ? `text-xs font-medium text-maroon underline-offset-2 hover:underline ${className}` : `inline-flex shrink-0 items-center rounded-full align-middle text-muted hover:text-ink ${className}`}
        aria-label={ENVELOPE_INFO_TITLE}
        title={ENVELOPE_INFO_TITLE}
      >
        {label ?? <IconInfo size={size} />}
      </button>
      {open &&
        createPortal(
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-6"
          onMouseDown={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) setOpen(false);
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="animate-fade w-full max-w-[340px] whitespace-normal rounded-[28px] bg-white px-7 pb-5 pt-7 text-center font-normal shadow-2xl" role="dialog" aria-modal="true" aria-label={ENVELOPE_INFO_TITLE}>
            <h2 className="text-[20px] font-semibold text-ink">{ENVELOPE_INFO_TITLE}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{unlimited ? UNLIMITED_BODY : ENVELOPE_INFO_BODY}</p>
            <button type="button" className="mt-5 rounded-full px-6 py-2 text-[15px] font-medium text-maroon hover:bg-brand-tint" onClick={() => setOpen(false)}>
              Got it
            </button>
          </div>
        </div>,
          document.body
        )}
    </>
  );
}
