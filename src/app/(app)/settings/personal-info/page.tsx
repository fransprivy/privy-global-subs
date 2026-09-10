"use client";

import { HeartAvatar } from "@/components/Logo";
import { SettingsHeader } from "@/components/SettingsHeader";
import { IconCamera, IconCheckCircle, IconPlus, IconQr, IconUser } from "@/components/Icons";
import { useAppState } from "@/lib/store";

export default function PersonalInfoPage() {
  const { s } = useAppState();
  return (
    <div>
      <SettingsHeader icon={<IconUser size={22} />} title="Personal info" subtitle="Your name and contact details" />
      <div className="px-6 py-6 sm:px-10">
        <div className="border-b border-line">
          <button className="flex items-center gap-2 border-b-2 border-maroon px-2 pb-3 text-[15px] text-ink">
            <IconUser size={18} /> Account Information
          </button>
        </div>

        <div className="card mt-5 flex flex-col gap-8 p-6 md:flex-row">
          <div className="flex flex-col items-start">
            <div className="relative">
              <HeartAvatar size={132} />
              <span className="absolute bottom-1 right-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#333] text-white">
                <IconCamera size={16} />
              </span>
            </div>
            <p className="mt-4 text-[17px] font-semibold text-ink">{s.user.name}</p>
            <p className="text-[15px] text-muted">{s.user.email}</p>
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <p className="text-[17px] font-semibold text-ink">Contact information</p>
              <button className="rounded-md border border-line p-1.5 text-ink-2" aria-label="QR code">
                <IconQr size={18} />
              </button>
            </div>
            <p className="mt-6 text-[15px] text-muted">Email address</p>
            <p className="mt-1 flex items-center gap-3 text-[17px] text-ink">
              {s.user.maskedEmail}
              <span className="flex items-center gap-1 text-[15px] font-medium text-success">
                <IconCheckCircle size={16} /> Verified
              </span>
            </p>
            <p className="mt-5 text-[15px] text-muted">Mobile number</p>
            <button className="btn-secondary mt-2 !py-3 text-[15px]">
              <IconPlus size={16} /> Add phone number
            </button>
          </div>
        </div>

        <div className="card mt-5 p-6">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-3 text-[17px] font-semibold text-ink">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-page text-ink-2">
                <IconUser size={18} />
              </span>
              Personal information
            </p>
            <button className="btn-secondary !py-3 !px-6 text-[15px]">Change</button>
          </div>
          <div className="mt-5 flex gap-16 text-[15px]">
            <span className="w-40 text-muted">Full name</span>
            <span className="text-ink">{s.user.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
