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
      <div className="px-6 py-6 sm:px-10">
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <p className="text-[17px] font-medium text-ink">Nothing to set up yet</p>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
