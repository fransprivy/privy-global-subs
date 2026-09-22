"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { activeWorkspaceId, allWorkspaces, type WorkspaceView } from "@/lib/engine";
import { useAppState } from "@/lib/store";
import { useFlows } from "./flows";
import { IconCheck, IconGear, IconInfo } from "./Icons";
import { HeartAvatar } from "./Logo";
import { Spec } from "./ui";

/** Avatar menu: workspace switcher (current + others), Settings, Help centre, Log out. Mirrors production (R-76). */
export function WorkspaceMenu() {
  const { s, api } = useAppState();
  const flows = useFlows();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = activeWorkspaceId(s);
  const all = allWorkspaces(s);
  const cur = all.find((w) => w.id === current)!;
  const others = all.filter((w) => w.id !== current);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(id: string) {
    setOpen(false);
    if (id === current) return;
    api.switchWorkspace(id);
    router.push("/home");
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-label="Workspace menu" aria-expanded={open} className={`rounded-full ring-offset-2 ${open ? "ring-2 ring-ink" : ""}`}>
        <HeartAvatar size={40} />
      </button>
      {open && (
        <div className="absolute right-0 top-[52px] z-[60] w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-white shadow-2xl animate-fade" role="menu">
          <p className="px-5 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Current workspace</p>
          <WorkspaceRow w={cur} current onClick={() => pick(cur.id)} />
          {cur.role === "member" && (
            <button
              className="mx-5 mb-2 text-xs font-medium text-danger underline underline-offset-2"
              onClick={() => {
                setOpen(false);
                flows.open({ type: "leave", id: cur.id });
              }}
            >
              Leave this workspace
            </button>
          )}
          {others.length > 0 && (
            <>
              <div className="border-t border-line" />
              <p className="px-5 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Other workspaces</p>
              {others.map((w) => (
                <WorkspaceRow key={w.id} w={w} onClick={() => pick(w.id)} />
              ))}
            </>
          )}
          <div className="border-t border-line" />
          <div className="py-2">
            <Link href="/settings/personal-info" onClick={() => setOpen(false)} className="flex items-center gap-3 px-5 py-2.5 text-[15px] text-ink hover:bg-page" role="menuitem">
              <IconGear size={20} className="text-ink-2" /> Settings
            </Link>
            <button className="flex w-full items-center gap-3 px-5 py-2.5 text-left text-[15px] text-ink hover:bg-page" role="menuitem" onClick={() => setOpen(false)}>
              <IconInfo size={20} className="text-ink-2" /> Help centre
            </button>
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-3 px-5 py-2.5 text-[15px] text-brand hover:bg-page" role="menuitem">
              <LogoutIcon /> Log out
            </Link>
          </div>
          <p className="border-t border-line px-5 py-2 text-[11px] text-muted">
            Your plan follows you: only a Business workspace you own changes your Individual plan. <Spec id="R-71" />
          </p>
        </div>
      )}
    </div>
  );
}

function WorkspaceRow({ w, current, onClick }: { w: WorkspaceView; current?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 px-5 py-3 text-left ${current ? "bg-[#fbf3ee]" : "hover:bg-page"}`} role="menuitem">
      <WorkspaceAvatar w={w} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-medium text-ink">{w.name}</span>
        <span className="block text-sm text-muted">
          {w.kind === "individual" ? "Individual" : w.kind === "business" ? "Business" : "Enterprise"}
          {w.status === "expired" && <span className="ml-2 rounded bg-danger-tint px-1.5 py-0.5 text-[11px] font-medium text-danger">Expired</span>}
          {w.role === "member" && w.status !== "expired" && <span className="ml-2 text-[12px] text-muted">· member</span>}
        </span>
      </span>
      {current && <IconCheck size={18} className="text-ink" />}
    </button>
  );
}

export function WorkspaceAvatar({ w, size = 44 }: { w: WorkspaceView; size?: number }) {
  if (w.kind === "individual") return <HeartAvatar size={size} />;
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: w.color, fontSize: size * 0.34 }} aria-hidden="true">
      {w.initials}
    </span>
  );
}

function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M21 4v16" />
    </svg>
  );
}
