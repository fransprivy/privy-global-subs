"use client";

import { useParams } from "next/navigation";
import { SettingsHeader } from "@/components/SettingsHeader";
import { IconSliders } from "@/components/Icons";

const TITLES: Record<string, [string, string]> = {
  security: ["Security", "Password, two-factor authentication and sessions"],
  signatures: ["Signatures", "Your saved signatures and initials"],
  "app-preferences": ["App preferences", "Language, time zone and defaults"],
  activities: ["Activities", "Everything that happened in your account"],
  contacts: ["Contacts", "People you send envelopes to"],
  "workspace-preferences": ["Workspace preferences", "Roles, defaults and branding"],
  "cloud-connections": ["Cloud connections", "Google Drive and OneDrive"],
  privypal: ["PrivyPal (AI Assistant)", "Document intelligence settings"],
  "document-categories": ["Document categories", "Organise your documents"],
  "email-templates": ["Email templates", "Customise the emails your recipients get"],
  notifications: ["Notifications", "What we email you about"],
  "auto-reminder": ["Auto-reminder", "Nudge signers automatically"],
};

export default function SettingsStub() {
  const { section } = useParams<{ section: string }>();
  const [title, subtitle] = TITLES[section] ?? ["Settings", ""];
  return (
    <div>
      <SettingsHeader icon={<IconSliders size={22} />} title={title} subtitle={subtitle} />
      <div className="px-6 py-10 text-sm text-muted sm:px-10">
        This section is outside the scope of the subscription prototype. Everything under <strong className="text-ink">Billing</strong> is fully working.
      </div>
    </div>
  );
}
