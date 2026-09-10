"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { Banners } from "./Banners";
import { FlowProvider } from "./flows";
import { PrototypeControls } from "./PrototypeControls";
import { TestGuide } from "./TestGuide";
import { TopNav } from "./TopNav";
import { IconCheckCircle, IconClose, IconInfo } from "./Icons";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, ready } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (ready && !state) router.replace("/");
  }, [ready, state, router]);

  if (!ready || !state) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Loading prototype…
      </div>
    );
  }

  const guideOpen = state.ui.guideOpen ?? true;
  return (
    <FlowProvider>
      {/* On large screens the test guide docks on the right and the app narrows to make room. */}
      <div className={`flex min-h-screen flex-col transition-[padding] ${guideOpen ? "lg:pr-[360px]" : ""}`}>
        <TopNav />
        <Banners />
        <main className="flex-1">{children}</main>
        <PrototypeControls />
        <Toast />
      </div>
      <TestGuide />
    </FlowProvider>
  );
}

function Toast() {
  const { state, dismissToast } = useStore();
  const t = state?.ui.toast;
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(dismissToast, 5000);
    return () => clearTimeout(id);
  }, [t, dismissToast]);
  if (!t) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[80] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 animate-fade">
      <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm text-white shadow-2xl ${t.tone === "success" ? "bg-[#1f7a48]" : t.tone === "warn" ? "bg-[#9a5b00]" : "bg-ink"}`}>
        {t.tone === "success" ? <IconCheckCircle size={20} /> : <IconInfo size={20} />}
        <span className="flex-1">{t.text}</span>
        <button onClick={dismissToast} aria-label="Dismiss" className="opacity-80 hover:opacity-100">
          <IconClose size={16} />
        </button>
      </div>
    </div>
  );
}
