"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ENVELOPE_LIMIT } from "@/lib/catalog";
import { currentTier } from "@/lib/engine";
import { useAppState } from "@/lib/store";
import { HeartAvatar, PrivyLogo } from "./Logo";
import { IconBell, IconChat, IconEnvelope, IconGear, IconHome, IconSparkle, IconTemplates } from "./Icons";
import { Spec } from "./ui";

const NAV = [
  { href: "/home", label: "Home", icon: IconHome },
  { href: "/envelopes", label: "Envelopes", icon: IconEnvelope },
  { href: "/templates", label: "Templates", icon: IconTemplates },
  { href: "/chat", label: "Chat", icon: IconChat },
];

export function TopNav() {
  const { s } = useAppState();
  const path = usePathname();
  const tier = currentTier(s);
  const limit = ENVELOPE_LIMIT[tier];
  const left = limit === null ? null : Math.max(0, limit - s.usage.envelopesSent);
  const cta = tier === "business" || tier === "enterprise" ? { label: "Manage plan", href: "/settings/billing" } : { label: "Upgrade plan", href: "/plans" };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="mx-auto flex h-[68px] max-w-[1600px] items-center gap-4 px-4 sm:px-8">
        <PrivyLogo />
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[15px] font-medium ${active ? "text-ink" : "text-ink-2 hover:bg-page"}`}
              >
                <n.icon size={20} className={active ? "text-brand" : "text-ink-2"} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <span className={`whitespace-nowrap text-[15px] text-ink-2 ${(s.ui.guideOpen ?? true) ? "hidden 2xl:inline" : "hidden sm:inline"}`}>
            {left === null ? "Unlimited sends" : `${left} sends left`}
          </span>
          <Link href={cta.href} className="btn-primary !py-2 text-[15px] whitespace-nowrap">
            {cta.label}
          </Link>
          <Spec id="UX-13" />
          <button className="hidden rounded-lg p-2 text-[#e8477a] hover:bg-page sm:inline-flex" aria-label="PrivyPal">
            <IconSparkle size={20} />
          </button>
          <button className="rounded-lg p-2 text-ink-2 hover:bg-page" aria-label="Notifications">
            <IconBell size={20} />
          </button>
          <Link href="/settings/personal-info" className={`rounded-lg p-2 text-ink-2 hover:bg-page ${path.startsWith("/settings") ? "bg-[#eeeeee]" : ""}`} aria-label="Settings">
            <IconGear size={20} />
          </Link>
          <Link href="/settings/personal-info" aria-label="Profile">
            <HeartAvatar size={40} />
          </Link>
        </div>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-line px-2 md:hidden no-scrollbar">
        {NAV.map((n) => {
          const active = path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={`flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-medium ${active ? "text-brand" : "text-ink-2"}`}>
              <n.icon size={16} />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
