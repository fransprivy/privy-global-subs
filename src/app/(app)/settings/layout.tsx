"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconActivity,
  IconBell,
  IconClock,
  IconCloud,
  IconContacts,
  IconFolder,
  IconMail,
  IconReceipt,
  IconShield,
  IconSignature,
  IconSliders,
  IconSparkle,
  IconUser,
  IconWrench,
} from "@/components/Icons";
import { useAppState } from "@/lib/store";

const ACCOUNT = [
  { href: "/settings/personal-info", label: "Personal info", icon: IconUser },
  { href: "/settings/security", label: "Security", icon: IconShield },
  { href: "/settings/signatures", label: "Signatures", icon: IconSignature },
  { href: "/settings/app-preferences", label: "App preferences", icon: IconWrench },
  { href: "/settings/activities", label: "Activities", icon: IconActivity },
  { href: "/settings/contacts", label: "Contacts", icon: IconContacts },
  { href: "/settings/billing", label: "Billing", icon: IconReceipt },
];
const WORKSPACE = [
  { href: "/settings/workspace-preferences", label: "Workspace preferences", icon: IconSliders },
  { href: "/settings/cloud-connections", label: "Cloud connections", icon: IconCloud },
  { href: "/settings/privypal", label: "PrivyPal (AI Assistant)", icon: IconSparkle, pink: true },
  { href: "/settings/document-categories", label: "Document categories", icon: IconFolder },
  { href: "/settings/email-templates", label: "Email templates", icon: IconMail },
  { href: "/settings/notifications", label: "Notifications", icon: IconBell },
  { href: "/settings/auto-reminder", label: "Auto-reminder", icon: IconClock },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { s } = useAppState();
  const Item = ({ href, label, icon: Icon, pink }: { href: string; label: string; icon: typeof IconUser; pink?: boolean }) => {
    const active = path === href || (href !== "/settings/billing" && path.startsWith(href)) || (href === "/settings/billing" && path.startsWith("/settings/billing"));
    return (
      <Link
        href={href}
        className={`relative flex shrink-0 items-center gap-3 rounded-lg px-4 py-2.5 text-[15px] lg:w-full ${active ? "bg-brand-tint font-medium text-brand" : "text-ink hover:bg-page"}`}
      >
        {active && <span className="absolute left-0 top-2 bottom-2 hidden w-1 rounded-r bg-maroon lg:block" />}
        <Icon size={20} className={pink ? "text-[#e8477a]" : active ? "text-brand" : "text-ink-2"} />
        <span className="whitespace-nowrap">{label}</span>
      </Link>
    );
  };

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col lg:flex-row">
      <aside className="border-b border-line bg-white lg:w-[300px] lg:shrink-0 lg:border-b-0 lg:border-r lg:pb-10">
        <div className="hidden px-6 pt-8 lg:block">
          <h2 className="font-display text-xl font-semibold text-ink">Settings</h2>
          <p className="mt-4 text-sm font-semibold text-ink-2">Your Account</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-2 no-scrollbar lg:mt-2 lg:flex-col lg:px-4 lg:py-0">
          {ACCOUNT.map((i) => (
            <Item key={i.href} {...i} />
          ))}
        </nav>
        <div className="hidden px-6 pt-6 lg:block">
          <p className="text-sm font-semibold text-ink-2">Current Workspace</p>
          <p className="text-sm text-ink">{s.workspace.name}</p>
        </div>
        <nav className="hidden flex-col gap-1 px-4 pt-4 lg:flex">
          {WORKSPACE.map((i) => (
            <Item key={i.href} {...i} />
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
